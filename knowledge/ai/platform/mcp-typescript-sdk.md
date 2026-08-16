---
reviewed: 2026-08-16
tags: [library, typescript, ai-workflow]
---

# MCP TypeScript SDK

The official TypeScript SDK implementing both server and client sides of the Model Context Protocol.

**As of 2026-07-27 the SDK ships as v2**: the monolithic `@modelcontextprotocol/sdk` package was split into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` (both `2.0.0`), released alongside the [`2026-07-28` MCP spec revision](https://modelcontextprotocol.io/specification/2026-07-28). **v2 is the stable line.** `@modelcontextprotocol/sdk` v1.x (npm `latest` is `1.30.0`) lives on the long-lived `v1.x` branch and receives bug and security fixes for at least 6 months after v2's release. This repository is still on v1.

Most of this article documents the v1 API; see [v2 and the 2026-07-28 spec revision](#v2-and-the-2026-07-28-spec-revision) at the end for the v2 surface and the migration path.

Official: [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) / [v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/) / [v1 docs](https://ts.sdk.modelcontextprotocol.io/) / npm [server](https://www.npmjs.com/package/@modelcontextprotocol/server) · [client](https://www.npmjs.com/package/@modelcontextprotocol/client) · [sdk (v1)](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

## Installation and project setup

### v2 (current stable line)

```bash
pnpm add @modelcontextprotocol/server zod   # server side
pnpm add @modelcontextprotocol/client zod   # client side
```

- **Packages**: `@modelcontextprotocol/server` / `@modelcontextprotocol/client`, both `2.0.0`. All v2 packages share one version number
- **Node.js**: `>= 20`. Also runs on Bun, Deno, and web-standard runtimes (Cloudflare Workers)
- **Modules**: ESM-first, but a CommonJS build ships alongside, so `require("@modelcontextprotocol/server")` resolves natively
- **Schemas**: [Standard Schema](https://standardschema.dev/) — Zod v4, Valibot, ArkType, or any compatible library
- **Migration**: `npx @modelcontextprotocol/codemod@latest v1-to-v2 .`

### v1 (legacy line, still supported)

```bash
pnpm add @modelcontextprotocol/sdk zod
```

- **Package**: `@modelcontextprotocol/sdk` (a single package with subpath imports per use case). Current npm `latest` is **1.30.0** (published 2026-07-27)
- **Peer deps**: `zod ^3.25 || ^4.0` (required). Additionally `@cfworker/json-schema ^4.1.1` is an optional peer (needed only when using the `validation/cfworker` provider, e.g. on Cloudflare Workers)
- **Node.js**: `>= 18` (20 LTS recommended)
- **ESM only**: `"type": "module"` in `package.json`; `tsconfig.json` needs `"module": "Node16"` (or `NodeNext`) + `"moduleResolution": "Node16"`
- **Subpath imports use the `.js` extension**: even from TS source, write `from "@modelcontextprotocol/sdk/server/mcp.js"`. As of v1.29.0, the top-level `./validation` (`/validation/ajv`, `/validation/cfworker`) and `./experimental` / `./experimental/tasks` (streaming elicitation/sampling) are also exposed

> The sections from here to [Testing](#testing) document the **v1** API. v2's export map is flat (`.`, `./stdio`, `./validators/ajv`, `./validators/cf-worker`), so there is no `.js`-suffixed deep path to write.

## Server setup

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { logging: {} }, instructions: "..." }
);
```

| 1st arg `Implementation` | Description |
|---|---|
| `name` | Server identifier |
| `version` | The server's semver (not the SDK or protocol version). Passed to the client during `initialize` |

| 2nd arg `ServerOptions` (optional) | Description |
|---|---|
| `capabilities` | Declares extra capabilities that registration alone doesn't convey |
| `instructions` | Free-form text the client can inject into its system prompt. Use for cross-tool guidance (e.g. "call B before A"); don't duplicate individual tool descriptions here |

**Lifecycle**: constructor → register tools/resources/prompts → `await server.connect(transport)`. Capabilities are locked in after `connect`. Shut down with `server.close()`.

## Transports

| Transport | Subpath | Use case |
|---|---|---|
| `StdioServerTransport` | `server/stdio.js` | Local child process (launched by Claude Desktop, Claude Code, Codex CLI) |
| `StreamableHTTPServerTransport` | `server/streamableHttp.js` | Remote/hosted (over HTTP) |
| `SSEServerTransport` (deprecated) | `server/sse.js` | Legacy SSE, superseded by Streamable HTTP |

The `2026-07-28` spec reclassifies the HTTP+SSE transport (soft-deprecated since `2025-03-26`) as formally **Deprecated** under the feature lifecycle policy. Use Streamable HTTP.

In **v2**, serving is factory-based rather than transport-based: `serveStdio(createServer)` from `@modelcontextprotocol/server/stdio` owns the stdio loop, and `createMcpHandler(factory)` from `@modelcontextprotocol/server` is the web-standard `fetch`-shaped HTTP entry (`toNodeHandler(handler)` from `@modelcontextprotocol/node` adapts it to Node frameworks). `StdioServerTransport` + `server.connect(transport)` still works.

### Stdio caveat

**Do not write anything other than JSON-RPC frames to stdout**. Always send `console.log()` and debug output to `console.error()` (stderr). Polluting stdout breaks the protocol and causes the client to disconnect.

### Streamable HTTP

```ts
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,   // regular JSON response instead of SSE
});
```

Key options:

| Option | Description |
|---|---|
| `sessionIdGenerator` | Generator for stateful session IDs. `undefined` for stateless |
| `onsessioninitialized` | Hook fired on session initialization |
| `enableJsonResponse` | `true` for synchronous JSON responses instead of SSE |
| `enableDnsRebindingProtection` | DNS rebinding protection |
| `allowedHosts` / `allowedOrigins` | Allowed Host/Origin values |

Inside an Express/Node HTTP route, call `await transport.handleRequest(req, res, req.body)`. Manage sessions in a `Map` keyed by the `mcp-session-id` header, and create a new transport only for `initialize` requests (`isInitializeRequest(req.body)`).

## Registering tools

```ts
server.registerTool(
  "search",
  {
    title: "Search",
    description: "Search the knowledge base by keyword.",
    inputSchema: { query: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => ({
    content: [{ type: "text", text: `results for ${query}` }],
  }),
);
```

### `inputSchema` is a **Zod raw shape**

In the v1 series, pass a **shape object** like `{ x: z.number() }` rather than wrapping it in `z.object({...})`. The SDK internally wraps it as the equivalent of `z.object` and converts it to JSON Schema via `zod-to-json-schema`.

> Passing `z.object(...)` causes double wrapping and breaks the JSON Schema. **v2 flipped this**: `inputSchema` takes a full schema object (`z.object({ x: z.number() })`) from any Standard Schema library, and the codemod wraps existing raw shapes for you.

### `outputSchema`

If declared, the handler must also return `structuredContent`.

### `annotations`

**Hints for the client**. They don't change server behavior; they're used for auto-approve decisions and warning display. **Never use them for authorization**.

| Field | Meaning |
|---|---|
| `readOnlyHint` | Doesn't change state. Client may auto-approve |
| `destructiveHint` | Irreversible destructive operation (delete, DROP). User confirmation is expected. Only meaningful when `readOnlyHint=false` |
| `idempotentHint` | Same arguments produce the same effect (safe to retry) |
| `openWorldHint` | Accesses the outside world (web, third-party APIs). Implies non-determinism/side effects |

## Registering resources

```ts
// static
server.registerResource(
  "config",
  "config://app",
  { title: "App Config", mimeType: "application/json" },
  async (uri) => ({ contents: [{ uri: uri.href, text: await readConfig() }] }),
);

// template (URI parameters)
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

server.registerResource(
  "user-profile",
  new ResourceTemplate("user://{userId}/profile", { list: undefined }),
  { title: "User Profile" },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(await getUser(userId)) }],
  }),
);
```

Passing `list` to `ResourceTemplate` exposes concrete instances via `resources/list`. `complete` can provide argument completion.

## Registering prompts

```ts
server.registerPrompt(
  "code-review",
  {
    title: "Code Review",
    argsSchema: { file: z.string() },
  },
  async ({ file }) => ({
    messages: [
      { role: "user", content: { type: "text", text: `Review ${file}` } },
    ],
  }),
);
```

`argsSchema` is also a Zod raw shape, same as tools. Wrap completion support with `completable(z.string(), (value) => [...])` from `@modelcontextprotocol/sdk/server/completable.js`.

## Return value (CallToolResult)

```ts
{
  content: [
    { type: "text", text: "..." }
    | { type: "image", data: "<base64>", mimeType: "image/png" }
    | { type: "audio", data: "<base64>", mimeType: "audio/wav" }
    | { type: "resource", resource: { uri, text?, blob?, mimeType? } }
    | { type: "resource_link", uri, name?, description?, mimeType? }
  ],
  structuredContent?: {},  // required when outputSchema is declared
  isError?: boolean,
  _meta?: Record<string, unknown>,
}
```

`content` is an ordered array; the LLM reads all elements. **Best practice: don't inline large blobs — reference them via `resource_link`.**

## Error handling

Two distinct representations, used for different cases:

| Case | Method | Client/LLM experience |
|---|---|---|
| **Tool execution failure** (expected error: invalid input, upstream 4xx/5xx, missing file) | Return `{ content: [{ type: "text", text: "error message" }], isError: true }` | A success response with `isError: true`. The LLM can read the message and decide to retry/recover |
| **Protocol/programmer error** (validation, invariant violation, fatal) | `throw` inside the handler | The SDK converts it into a JSON-RPC error response. The LLM never sees natural-language text |

**Principle**: want the model to react → `isError: true`. Want the client to treat it as a hard failure → `throw`. Zod input-validation failures are automatically thrown by the SDK before the handler runs.

## The 3 most common LLM mistakes

1. **Passing `z.object({...})` to `inputSchema`**
   - The v1 series expects a raw shape (`{ x: z.number() }`). Wrapping it breaks the JSON Schema
2. **Writing to stdout in a stdio server** (`console.log`, `print`, etc.)
   - Breaks JSON-RPC framing and disconnects the client. Always log via `console.error`
3. **ESM misconfiguration** (forgetting the `.js` extension, staying on CJS)
   - The SDK is ESM-only. Use `"type": "module"` and always include `.js` on subpaths

Others: throwing on user-facing errors and losing context for the LLM; creating a new transport per request and breaking Streamable HTTP session continuity; forgetting `readOnlyHint` on safe tools, disabling auto-approve.

## Testing

### In-process integration tests with InMemoryTransport (recommended default)

```ts
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

it("calls greet", async () => {
  const server = new McpServer({ name: "t", version: "0.0.0" });
  server.registerTool(
    "greet",
    { inputSchema: { name: z.string() } },
    async ({ name }) => ({ content: [{ type: "text", text: `hi ${name}` }] }),
  );

  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);

  const res = await client.callTool({ name: "greet", arguments: { name: "Ada" } });
  expect(res.content[0]).toMatchObject({ type: "text", text: "hi Ada" });
});
```

No sockets or subprocesses — schema validation, capability negotiation, and serialization all run end-to-end. A reasonable default for vitest.

In **v2** the equivalent runs through the handler you actually deploy: build it with `createMcpHandler(createServer)` and hand `handler.fetch` to the client transport's `fetch` option, so nothing dials the network.

### Unit-testing handlers

Pure logic can be tested by extracting the handler as a named function. It's fast but bypasses SDK validation, so **pair it with at least one in-process integration test per server**.

## v2 and the 2026-07-28 spec revision

**v2 shipped 2026-07-27** — all packages at `2.0.0`, released alongside the `2026-07-28` MCP spec revision. `main` is now the v2 branch.

### Package split

| Package | Role |
|---|---|
| `@modelcontextprotocol/server` | Build servers (`McpServer`, `createMcpHandler`, `serveStdio`, auth helpers) |
| `@modelcontextprotocol/client` | Build clients (transports, high-level helpers, OAuth helpers) |
| `@modelcontextprotocol/core` | Public Zod `*Schema` constants (`core-internal` is private — never import it directly) |
| `@modelcontextprotocol/node` / `/express` / `/hono` / `/fastify` | Thin runtime/framework adapters. The framework itself is now a **peer dependency** (v1 shipped it as a direct dep — install `express` / `hono` / `fastify` explicitly) |
| `@modelcontextprotocol/server-legacy` | v1-era Express / SSE serving surface (`.`, `./auth`, `./sse`) |
| `@modelcontextprotocol/codemod` | `npx @modelcontextprotocol/codemod@latest v1-to-v2 .` |

All of these version together at `2.0.0`.

### What changed in v2

- **Node.js >= 20**; runs on Node.js, Bun, Deno, and Cloudflare Workers. ESM-first with a **CommonJS build alongside**, so Jest no longer needs a `moduleNameMapper` workaround
- **Standard Schema** replaces the Zod-only surface: `inputSchema` / `outputSchema` / `argsSchema` take a full schema object, not a raw shape
- `setRequestHandler` / `setNotificationHandler` take **method strings** instead of Zod schema constants; the v1 schema-first form throws a `TypeError` at registration
- Renames: `McpError` → `ProtocolError`, `ErrorCode` → `ProtocolErrorCode`, `StreamableHTTPError` → `SdkHttpError`, `JSONRPCError` → `JSONRPCErrorResponse`, `RequestHandlerExtra` → `ServerContext` / `ClientContext`. The handler's `extra` parameter becomes `ctx` (`extra.requestInfo?.headers[...]` → `ctx.http?.req?.headers`, now a Web Standard `Headers`, so bracket access becomes `.get()`)
- `instanceof` on SDK error classes works **across separately bundled copies** (brand-based via `Symbol.hasInstance`), with an explicit `X.isInstance(value)` guard as an alternative
- Runtime-neutral **Bearer auth** (`requireBearerAuth`, `verifyBearerToken`) and **OAuth discovery serving** (`oauthMetadataResponse`; RFC 9728 Protected Resource Metadata + RFC 8414 AS metadata) for web-standard `fetch(request)` hosts
- Experimental **tasks interception was removed** (SEP-2663 moved tasks to an official extension); the codemod flags those registrations rather than rewriting them

### Serving the 2026-07-28 revision is opt-in

Nothing in v2 puts a 2026-07-28 byte on the wire by default — a hand-constructed `Client` / `Server` / `McpServer` keeps speaking the 2025 era.

- **Client**: `new Client({ ... }, { versionNegotiation: { mode: "auto" } })` probes with `server/discover` and falls back to the 2025 `initialize` handshake; `{ pin: "2026-07-28" }` is modern-only and never falls back. `client.getProtocolEra()` returns `"modern" | "legacy"`. The default performs no probe
- **Server over HTTP**: `createMcpHandler(factory)` serves 2026-07-28 per request and, by default (`legacy: "stateless"`), also serves 2025-era traffic through the stateless idiom — one factory, one endpoint, both eras. An existing **sessionful** v1 setup routes in front of a strict entry (`legacy: "reject"`) via `isLegacyRequest(request)`

### Spec 2026-07-28 highlights

- **Sessions removed**: no `Mcp-Session-Id` header, no protocol-level sessions, and list endpoints no longer vary per connection. Cross-call state uses explicit server-minted handles passed as ordinary tool arguments (SEP-2567)
- **Stateless**: the `initialize` / `notifications/initialized` handshake is gone. Every request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `_meta`; clients SHOULD send `clientInfo` and servers SHOULD stamp `io.modelcontextprotocol/serverInfo` in each result's `_meta` (SEP-2575)
- **`server/discover`**: servers MUST implement it to advertise supported protocol versions, capabilities, and identity
- **`subscriptions/listen`** replaces the HTTP GET endpoint and `resources/subscribe` / `unsubscribe`. SSE stream resumability (`Last-Event-ID`, event IDs) is removed — a broken stream means re-issuing the request with a new ID
- **Multi Round-Trip Requests (MRTR)** replace server-initiated requests (`roots/list`, `sampling/createMessage`, `elicitation/create`): the server returns `resultType: "input_required"` carrying `inputRequests`, and the client retries the original request with `inputResponses` (SEP-2322). Every result now carries a required `resultType` (`"complete"` otherwise)
- **Required headers** `Mcp-Method` and `Mcp-Name` on Streamable HTTP POSTs, plus `x-mcp-header` for custom headers derived from tool parameters (SEP-2243)
- **Cache hints**: `ttlMs` and `cacheScope` (`"public"` / `"private"`) are required on `tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list` results (SEP-2549)
- `ping`, `logging/setLevel`, and `notifications/roots/list_changed` are removed; log level is set per request via `io.modelcontextprotocol/logLevel` in `_meta`
- Error codes renumbered into a reserved `-32020`–`-32099` MCP range; resource-not-found moves from `-32002` to `-32602`
- **Deprecated**: Roots, Sampling, and Logging (SEP-2577); the HTTP+SSE transport; and **OAuth Dynamic Client Registration (RFC 7591)**, superseded by **Client ID Metadata Documents (CIMD)**. Authorization servers SHOULD include the RFC 9207 `iss` parameter and clients MUST validate it before redeeming the code (SEP-2468)

### v1 status

The rest of this article documents **v1.30.0** — npm `latest`, published 2026-07-27 — which remains the production line for existing code, including this repository. v1 still targets Node.js `>= 18`, keeps the `zod ^3.25 || ^4.0` peer range, and keeps the raw-shape `inputSchema`.
