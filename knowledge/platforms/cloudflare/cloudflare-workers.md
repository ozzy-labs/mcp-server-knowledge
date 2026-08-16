---
reviewed: 2026-08-16
tags: [cloudflare, cloud-hosted, typescript, javascript]
---

# Cloudflare Workers

Cloudflare's serverless runtime. Code runs in **V8 isolates** on Cloudflare's global network rather than in containers, so there is effectively no cold start and no region to choose. A Worker is a JavaScript/TypeScript (or Wasm/Python/Rust) module that exports handlers and receives every external resource through **bindings** on `env`. This article covers the runtime; see [`wrangler.md`](wrangler.md) for the CLI and configuration file, [`cloudflare-storage.md`](cloudflare-storage.md) for the data products, and [`cloudflare.md`](cloudflare.md) for the platform overview.

Official: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)

## Execution model

- **V8 isolates, not containers**: one runtime process hosts many isolates; an isolate starts roughly 100× faster than a Node process on a VM and uses an order of magnitude less memory
- **Cold start**: the Worker is loaded on the first TLS handshake packet, and load (~5 ms) finishes before the request body arrives — effectively zero cold start, with no configuration
- **`workerd`**: the runtime is open source (Apache-2.0, [cloudflare/workerd](https://github.com/cloudflare/workerd)) and is the same binary Wrangler/Miniflare run locally
- **Preemptible and sandboxed**: isolates + process sandboxing + "cordons" separating low-trust from high-trust Workers. No threads, no shared memory
- **Containers** (Workers Paid) run arbitrary images alongside a Worker: a class extending `Container` from `@cloudflare/containers`, registered as a SQLite-backed Durable Object

## Handlers

Module syntax (ES modules) is the only form to use for new code. Service Worker syntax (`addEventListener("fetch", ...)`, bindings as globals) is **deprecated but still supported** — new features are not added to it.

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response("ok");
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {},
  async queue(batch: MessageBatch<T>, env: Env, ctx: ExecutionContext) {},
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {},
  async tail(events: TraceItem[], env: Env, ctx: ExecutionContext) {},
} satisfies ExportedHandler<Env>;
```

| Handler | Trigger | Notes |
|---|---|---|
| `fetch` | HTTP request | Must return a `Response`. `XMLHttpRequest` is not available |
| `scheduled` | Cron Trigger (`triggers.crons`) | `controller.cron` must match the configured string exactly; `controller.scheduledTime` is ms epoch |
| `queue` | Queues consumer | `batch.messages[]` with `ack()` / `retry()`, plus `batch.ackAll()` / `retryAll()` |
| `email` | Email Routing (public beta) | `message.forward()` / `reply()` / `setReject()` |
| `tail` | Tail Workers | Receives the producer Worker's logs, exceptions, and `outcome` |

### Class entrypoints and RPC

`compatibility_date >= 2024-04-03` enables Workers RPC. Public methods of a `WorkerEntrypoint` become callable from another Worker through a Service binding — no HTTP framing, no manual serialization.

```ts
import { WorkerEntrypoint, DurableObject, WorkflowEntrypoint } from "cloudflare:workers";

export default class extends WorkerEntrypoint<Env> {
  async fetch(req: Request) {
    return new Response(String(await this.env.WORKER_B.add(1, 2))); // RPC over a Service binding
  }
  add(a: number, b: number) { return a + b; } // exposed as an RPC method
}
```

- Passable over RPC: structured-cloneable values, functions (become stubs), `RpcTarget` subclasses, streams, `Request`/`Response`, other stubs. **Max 32 MiB serialized payload** — stream anything larger
- Smart Placement is ignored for RPC calls; private class members are never exposed
- `DurableObject` and `WorkflowEntrypoint` follow the same shape (`this.env`, `this.ctx`)

### `ExecutionContext`

| Member | Behavior |
|---|---|
| `ctx.waitUntil(promise)` | Continues work after the response is returned. **30 s cap** after the invocation ends, shared across all calls |
| `ctx.passThroughOnException()` | Fails open to the origin on an unhandled exception. Not a substitute for `try`/`catch`, and cannot resend an already-consumed body |
| `ctx.props` | Arbitrary JSON injected by a Service binding's configuration; only settable by someone who can deploy the Worker, so it is trustworthy |
| `ctx.exports` | Loopback bindings to the Worker's own entrypoints, incl. dynamic props (`enable_ctx_exports`, default on from 2025-11-17) |

Do **not** destructure `ctx` (`const { waitUntil } = ctx`) — the method loses its receiver and throws `Illegal invocation`.

## Bindings

Everything a Worker can reach is a binding declared in configuration and read off `env`. There is no ambient network credential, no environment inheritance from the host, no filesystem-based config.

| Category | Bindings |
|---|---|
| Config | Environment variables (`vars`), Secrets, Secrets Store, Version metadata |
| Data | KV, R2, D1, Durable Objects, Queues, Hyperdrive, Vectorize, Analytics Engine |
| Compute | Service bindings (RPC), Workflows, Containers, Dispatcher (Workers for Platforms), Dynamic Worker Loaders |
| AI/media | Workers AI (`ai`), AI Search, Browser Run (formerly Browser Rendering), Images, Media Transformations, Stream |
| Platform | Assets, Rate Limiting, mTLS certificates, Email sending (`send_email`) |

Generate the `Env` type with `wrangler types` instead of hand-writing it. Config key shapes are listed in [`wrangler.md`](wrangler.md#bindings).

Rate limiting is worth calling out because it is unusual — the `period` may only be `10` or `60` seconds:

```jsonc
{ "ratelimits": [{ "name": "RL", "namespace_id": "1001", "simple": { "limit": 100, "period": 60 } }] }
```

```ts
const { success } = await env.RL.limit({ key: clientIp });
```

## Compatibility dates and flags

`compatibility_date` pins runtime behavior; setting it enables every flag whose default-on date is at or before it. Cloudflare supports old dates indefinitely, so the only real risk is being stuck on stale behavior. **Set it to today's date on a new project.** The latest date documented as of 2026-08-16 is `2026-08-04`.

### Node.js compatibility (changed on 2026-08-04)

| `compatibility_date` | Behavior |
|---|---|
| `>= 2026-08-04` | `nodejs_compat` **and** `nodejs_compat_v2` are on by default — nothing to configure |
| `2024-09-23` – `2026-08-03` | Must add `"compatibility_flags": ["nodejs_compat"]` explicitly |
| Opt out on a new date | Set **both** `no_nodejs_compat` and `no_nodejs_compat_v2` |

Fully supported `node:` modules include `assert`, `buffer`, `crypto`, `diagnostics_channel`, `events`, `fs`, `http`, `https`, `net`, `path`, `process`, `querystring`, `stream`, `string_decoder`, `timers`, `url`, `util`, `zlib`. Partial: `console`, `dns`, `module`, `os`, `perf_hooks`, `test`, `tls`. Import-but-non-functional stubs (added over 2025-09 → 2026-03) include `child_process`, `cluster`, `dgram`, `http2`, `inspector`, `readline`, `repl`, `sqlite`, `tty`, `v8`, `vm`, `worker_threads`, `wasi`. Treat a stub import that "works" at build time as a runtime failure waiting to happen.

## Limits

| Limit | Free | Paid |
|---|---|---|
| Requests | 100,000/day | Unlimited |
| CPU time per invocation | 10 ms | 5 min max (default 30 s, set via `limits.cpu_ms`) |
| Memory | 128 MB | 128 MB |
| Worker size (compressed) | 3 MB | 10 MB |
| Subrequests per request | 50 | 10,000 (raised from 1,000 on 2026-02-11; `limits.subrequests` goes to 10M) |
| Simultaneous outgoing connections | 6 | 6 |
| Environment variables | 64/Worker, 5 KB each | 128/Worker, 5 KB each |
| Cron Triggers per account | 5 | 250 |
| Startup CPU (global scope) | 1 s | 1 s |

- **CPU time is not wall time**: waiting on `fetch`, KV, or a database does not count. Wall-clock duration is unlimited for HTTP, and capped at 15 min for Cron Triggers, Queue consumers, and Durable Object alarms
- Startup CPU is a deploy-time failure: heavy top-level work (large JSON parse, big Wasm init) fails with `Script startup exceeded CPU time limit`

## Pricing

- **Free**: 100,000 requests/day, 10 ms CPU per invocation, no duration charge
- **Paid** ($5/month minimum): 10M requests/month included, then $0.30/M; 30M CPU-milliseconds/month included, then $0.02/M CPU-ms. No charge for wall-clock duration and **no bandwidth/egress charge**
- The same $5 covers Workers, Pages Functions, Workers KV, and Hyperdrive
- Error `1027` means the Free daily request limit was exceeded

## Static assets

A Worker can serve a static site and an API from one deployment. Assets are served from the location nearest the user (Smart Placement does not move them) and are free — asset requests are not billed as Worker requests when they never reach the Worker.

```jsonc
{
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "!/api/docs/*"]
  }
}
```

| Key | Values |
|---|---|
| `html_handling` | `auto-trailing-slash` (default), `force-trailing-slash`, `drop-trailing-slash`, `none` |
| `not_found_handling` | `none` (default), `single-page-application` (serves `/index.html` with **200**), `404-page` |
| `run_worker_first` | `false` (default), `true`, or an array of globs with `!` negation — use for auth, A/B tests, API routes |
| `binding` | Exposes `env.ASSETS.fetch(request)` for programmatic serving |

`.assetsignore` (gitignore syntax) excludes files from upload. Cloudflare's best-practices page states that Workers Static Assets is the recommended way to deploy static sites, SPAs, and full-stack apps, and that a **new project should use Workers rather than Pages** — see [`cloudflare-pages.md`](cloudflare-pages.md) for the comparison and migration path.

## Local development and testing

- `wrangler dev` runs **locally by default** in `workerd` via Miniflare; all bindings are simulated and start empty, and the local runtime forces `TZ=UTC`
- **Remote bindings** are the recommended hybrid: add `"remote": true` to a single binding so code still executes locally while that resource is the real one. `wrangler dev --remote` (full remote) is the legacy path
- Local state lives in `.wrangler/state` (gitignore it); `--persist-to <dir>` moves it
- Some bindings have no local emulation (Vectorize, Workers AI, Browser Rendering, mTLS) and require `remote: true`; Durable Objects, Queues, and Workflows are local-only

Vitest integration (`@cloudflare/vitest-pool-workers`, requires Vitest 4.1+) now uses a plugin rather than `defineWorkersConfig`:

```ts
// vitest.config.ts
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
```

```ts
import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src";

const ctx = createExecutionContext();
const res = await worker.fetch(new Request("http://example.com/"), env, ctx);
await waitOnExecutionContext(ctx);          // unit style

const res2 = await exports.default.fetch("http://example.com/404"); // integration style
```

`cloudflare:test` also exports `createScheduledController`, `createMessageBatch`, `getQueueResult`, `runInDurableObject`, `runDurableObjectAlarm`, `applyD1Migrations`, and workflow introspection helpers. For non-Vitest runners, `createTestHarness()` (2026-07) replaces the deprecated `unstable_dev` / `unstable_startWorker`; `getPlatformProxy()` remains the way to reach bindings from a Node.js framework.

## Observability

```jsonc
{ "observability": { "enabled": true, "head_sampling_rate": 1 } }
```

- **Workers Logs**: queryable in the dashboard; 3-day retention on Free, 7-day on Paid. Free 200,000 logs/day; Paid 20M/month included, then $0.60/M
- **`wrangler tail`**: live log stream for a deployed Worker
- **Tail Workers**: `tail_consumers = [{ service = "<worker>" }]` on the producer; the consumer implements `tail()`. Billed by CPU time, Paid/Enterprise only
- **Logpush**: `"logpush": true` ships trace events to R2, S3, or a third party
- **Tracing**: fetch calls, binding operations, and handler invocations are instrumented automatically, with OTLP export to Honeycomb/Grafana/Axiom/Sentry
- **Smart Placement**: `"placement": { "mode": "smart" }` relocates the Worker near its backend after ~15 minutes of analysis. Affects `fetch` handlers only — not RPC or named entrypoints. Verify with the `cf-placement` response header

## Pitfalls

1. **No request state in module scope.** Isolates are reused; a module-level variable written during one request is visible to the next. Pass state through arguments or `env`
2. **`Cannot perform I/O on behalf of a different request`** — an I/O object (stream, `Request`, socket) created in one invocation leaked into another. Never cache them globally
3. **`Date.now()` does not advance during execution**; it updates only on I/O, and `performance.now()` equals it. This is a deliberate timing-side-channel mitigation, so in-process microbenchmarks always read 0 ms
4. **Timers only run inside the request context.** No background work after the invocation except `ctx.waitUntil()` (30 s), Cron Triggers, Durable Object alarms, or Workflows
5. **`eval()`, `new Function`, and dynamic `WebAssembly.compile/instantiate` are disallowed.** Wasm must be a static module import
6. **`fetch()` to a raw IP address is rejected** — use a hostname with a DNS record. Error `1024` for Cloudflare IPs, `1042` for another Worker on the same zone
7. **Floating promises silently disappear.** Always `await`, `return`, or hand them to `ctx.waitUntil()`; enable `@typescript-eslint/no-floating-promises`
8. **Buffering large bodies blows the 128 MB memory cap** — pass `response.body` straight through instead of `await response.text()`
9. **Use `crypto.randomUUID()` / `crypto.getRandomValues()`**, never `Math.random()`, for anything security-relevant, and compare secrets with `crypto.subtle.timingSafeEqual()` on hashed inputs
10. **Error codes worth memorizing**: `1101` JS exception, `1102` CPU exceeded, `1019` Worker recursion limit (>16 hops), `1027` Free daily limit, `10021` startup CPU/memory on upload, `10027` size limit

## References

- [Workers docs](https://developers.cloudflare.com/workers/) — [how Workers works](https://developers.cloudflare.com/workers/reference/how-workers-works/) / [handlers](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/) / [context](https://developers.cloudflare.com/workers/runtime-apis/context/) / [RPC](https://developers.cloudflare.com/workers/runtime-apis/rpc/)
- [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/) / [compatibility dates](https://developers.cloudflare.com/workers/configuration/compatibility-dates/) / [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/) / [Node.js compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [Limits](https://developers.cloudflare.com/workers/platform/limits/) / [pricing](https://developers.cloudflare.com/workers/platform/pricing/) / [errors](https://developers.cloudflare.com/workers/observability/errors/) / [best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
- [Static assets](https://developers.cloudflare.com/workers/static-assets/) / [development and testing](https://developers.cloudflare.com/workers/development-testing/) / [Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/get-started/write-your-first-test/) / [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement/)
- Related: [`cloudflare.md`](cloudflare.md), [`wrangler.md`](wrangler.md), [`cloudflare-storage.md`](cloudflare-storage.md), [`cloudflare-ai.md`](cloudflare-ai.md), [`cloudflare-pages.md`](cloudflare-pages.md), [`../../languages/js/hono.md`](../../languages/js/hono.md)
