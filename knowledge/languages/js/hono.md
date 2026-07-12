---
reviewed: 2026-07-12
tags: [framework, javascript, typescript]
---

# Hono

A small, simple, and ultrafast web framework built on **Web Standards** (`Request` / `Response` / `fetch`). Because it depends only on standard APIs, the same code runs on Cloudflare Workers, Deno, Bun, Vercel, Netlify, AWS Lambda, Lambda@Edge, Fastly Compute, and Node.js. "Hono" means *flame* (炎) in Japanese. It is a common choice for edge/serverless APIs and for type-safe backends paired with a TypeScript client.

Official: [hono.dev](https://hono.dev/docs/)

## Positioning

- **Multi-runtime**: one app object (`app.fetch`) targets every major JS runtime via thin adapters
- **Ultrafast**: the default `RegExpRouter` compiles routes into a single regular expression instead of iterating a linear list
- **Web Standards-based**: handlers receive a Web `Request` and return a Web `Response`, so knowledge transfers across platforms
- Aimed at APIs and edge functions, not at server-rendered content sites (contrast with [Astro](astro.md))

## Versions

As of 2026-07, the current stable is the **Hono v4** series (`hono@4.12.x`). The package `engines` requires **Node.js >= 16.9.0**, but the Node.js adapter (`@hono/node-server`) requires 18.14.1+ / 19.7.0+ / 20.0.0+. v4.0.0 (2024-02-09) added static site generation (`toSSG()`), client-side JSX (`hono/jsx/dom` with React-compatible hooks), and made the validator **throw** on failure rather than return a response. The core stays tiny (`hono/tiny` "Hello World" is ~12KB minified).

## Setup

```bash
npm create hono@latest my-app     # scaffold (pick a runtime template)
pnpm create hono@latest my-app
bun create hono@latest my-app
deno init --npm hono@latest my-app
```

Minimal app (runs as-is on Cloudflare Workers / Deno / Bun):

```ts
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => c.text('Hono!'))

export default app
```

On **Node.js** you must wrap it with the adapter (plain `export default app` does not start a server):

```ts
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()
app.get('/', (c) => c.text('Hello Node.js!'))

serve(app) // defaults to http://localhost:3000
```

## Routing

```ts
app.get('/user/:name', (c) => c.text(`Hello ${c.req.param('name')}`))
app.post('/posts', handler)
app.on('PURGE', '/cache', handler)          // custom method
app.get('/endpoint', h1).post(h2).delete(h3) // chained methods
app.route('/book', bookApp)                   // mount a sub-app
```

- Path params: `/user/:name` → `c.req.param('name')`; optional `/api/animal/:type?`
- Regex constraints: `/post/:date{[0-9]+}/:title{[a-z]+}`; wildcards: `/wild/*/card`
- **First match wins** in registration order — register wildcard / fallback routes last

### Built-in routers

Hono ships several routers and picks one automatically. The default is `SmartRouter`, which selects between `RegExpRouter` and `TrieRouter` at startup.

| Router | Characteristic |
|---|---|
| `RegExpRouter` | Fastest; compiles all routes into one regex. Does not support every pattern |
| `TrieRouter` | Trie-based, supports all patterns. Slower than RegExp but far faster than Express |
| `SmartRouter` | **Default.** Infers and uses the fastest usable router among the registered ones |
| `LinearRouter` | Near-zero route registration cost; suited to serverless that reinitializes per request |
| `PatternRouter` | Smallest footprint; keeps the app under ~15KB when used exclusively |

## Context (`c`)

The single `Context` argument carries both request and response helpers.

| API | Purpose |
|---|---|
| `c.req` | `HonoRequest` — `c.req.param()`, `c.req.query()`, `c.req.json()`, `c.req.valid()` |
| `c.text()` / `c.json()` / `c.html()` | Return a `Response` with the matching `Content-Type` |
| `c.body(data, status, headers)` | Raw body with optional status / headers |
| `c.status()` / `c.header()` | Set status / header (side effects; still return a body helper) |
| `c.redirect(url, status)` | Redirect (default 302) |
| `c.set()` / `c.get()` / `c.var` | Per-request key/value store (usually populated by middleware) |
| `c.env` | Runtime bindings, e.g. `c.env.MY_KV` on Cloudflare Workers |
| `c.executionCtx` | e.g. `c.executionCtx.waitUntil()` on Cloudflare Workers |

Response helpers return a `Response` object that **must be returned** from the handler.

## Middleware

```ts
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { jwt } from 'hono/jwt'

app.use(logger())                         // all routes
app.use('/api/*', cors())                 // path-scoped
app.use('/auth/*', jwt({ secret: 'it-is-very-secret' }))
```

A middleware either `await next()` and returns nothing (to continue the chain), or returns a `Response` to short-circuit. Code before `next()` runs first-to-last and code after it runs last-to-first (onion model). Reusable, type-safe middleware is built with `createMiddleware()`.

Built-in middleware/helpers include CORS, logger, Basic / Bearer / JWT auth, secure headers, compression, cache, ETag, pretty JSON, and SSG (imported from `hono/<name>`, e.g. `hono/cors`, `hono/bearer-auth`).

## Validation

`hono/validator` provides a generic `validator()`; `@hono/zod-validator` wires a Zod schema directly. Targets: `json`, `form`, `query`, `header`, `param`, `cookie`.

```ts
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'

app.post('/posts', zValidator('form', z.object({ body: z.string() })), (c) => {
  const { body } = c.req.valid('form') // typed
  return c.json({ message: 'Created!' }, 201)
})
```

Validating `json` / `form` requires the request to send a matching `content-type` header. See [Zod](zod.md) for the schema library.

## RPC (type-safe client)

Export the app type from the server, then infer a fully typed client with `hc`:

```ts
// server
const route = app.post('/posts', zValidator('form', z.object({ title: z.string() })), (c) =>
  c.json({ ok: true }, 201),
)
export type AppType = typeof route

// client
import { hc } from 'hono/client'
import type { AppType } from './server'

const client = hc<AppType>('http://localhost:8787/')
const res = await client.posts.$post({ form: { title: 'Hello' } })
```

Path params and queries are passed as strings. Correct inference requires `"strict": true` in `tsconfig.json` and explicit status codes in handlers.

## Ecosystem

- `hono/jsx` — built-in JSX for server-side rendering and, via `hono/jsx/dom`, client components. Requires `jsxImportSource` in tsconfig and `.tsx` files
- `@hono/zod-openapi` — `OpenAPIHono` + `createRoute` validate with Zod and generate an OpenAPI document (often exposed at `/doc`)
- **HonoX** (`honojs/honox`) — a full-stack meta-framework on Hono + Vite with file-based routing and islands hydration; **alpha** (breaking changes within the same major)

## Deployment

| Runtime | Entry | Notes |
|---|---|---|
| Cloudflare Workers | `export default app` | Scaffold `cloudflare-workers`; `wrangler` dev on port 8787, `npm run deploy`. Bindings via `new Hono<{ Bindings }>()` and `c.env.*` |
| Bun | `export default app` | `bun add hono`; run with `bun run --hot src/index.ts` (port 3000) |
| Node.js | `serve(app)` | Requires `@hono/node-server`; Hono "was not designed for Node.js at first" |

## Common AI Agent Mistakes

1. **Returning `app` directly on Node.js** — plain `export default app` starts nothing on Node. Import `serve` from `@hono/node-server` and call `serve(app)`.
2. **Confusing `c.req.param()` with `c.req.query()`** — `param()` reads path params (`/user/:name`); `query()` / `queries()` read the querystring.
3. **Forgetting `await next()` in middleware** — without it the chain stops and the route handler never runs.
4. **Not returning the response** — `c.json()` / `c.text()` return a `Response` that must be `return`ed; calling them for their side effect does nothing.
5. **Missing `content-type` on validated requests** — `json` / `form` validators only apply when the request sends the matching header.
6. **Enabling RPC without `"strict": true`** — the typed client infers incorrectly unless strict mode is on in both server and client `tsconfig`.

## Comparison with other tools

| Framework | Positioning |
|---|---|
| Hono | Multi-runtime, Web Standards APIs. Edge / serverless first |
| Express | Node-only, callback-style. The long-standing default, but not edge-native |
| Fastify | Node-focused, plugin/schema oriented, high throughput |
| Elysia | Bun-first, end-to-end type safety (similar RPC idea) |
| [FastAPI](../python/fastapi.md) | The Python-side equivalent for type-driven API frameworks |

## References

- [Hono documentation](https://hono.dev/docs/)
- [Routers concept](https://hono.dev/docs/concepts/routers)
- [Context API](https://hono.dev/docs/api/context)
- [Middleware guide](https://hono.dev/docs/guides/middleware)
- [Validation guide](https://hono.dev/docs/guides/validation)
- [RPC guide](https://hono.dev/docs/guides/rpc)
- [Hono on GitHub](https://github.com/honojs/hono)
