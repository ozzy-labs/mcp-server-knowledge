---
reviewed: 2026-06-07
tags: [library, typescript, ai-workflow]
---

# MCP TypeScript SDK

`@modelcontextprotocol/sdk` — the official TypeScript SDK implementing both server and client sides of the Model Context Protocol. This repository also uses it.

Official: [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) / [npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

## Installation and project setup

```bash
pnpm add @modelcontextprotocol/sdk zod
```

- **Package**: `@modelcontextprotocol/sdk` (a single package with subpath imports per use case)
- **Peer deps**: `zod ^3.25 || ^4.0` (required). Additionally `@cfworker/json-schema ^4.1.1` is an optional peer (needed only when using the `validation/cfworker` provider, e.g. on Cloudflare Workers)
- **Node.js**: `>= 18` (20 LTS recommended)
- **ESM only**: `"type": "module"` in `package.json`; `tsconfig.json` needs `"module": "Node16"` (or `NodeNext`) + `"moduleResolution": "Node16"`
- **Subpath imports use the `.js` extension**: even from TS source, write `from "@modelcontextprotocol/sdk/server/mcp.js"`. As of v1.29.0, the top-level `./validation` (`/validation/ajv`, `/validation/cfworker`) and `./experimental` / `./experimental/tasks` (streaming elicitation/sampling) are also exposed

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

> Passing `z.object(...)` causes double wrapping and breaks the JSON Schema. Note that v2 plans to flip this and expect an object instead.

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

### Unit-testing handlers

Pure logic can be tested by extracting the handler as a named function. It's fast but bypasses SDK validation, so **pair it with at least one in-process integration test per server**.

## v1 / v2 notes

The v2 series (alpha as of 2026-05, latest 2.0.0-alpha.2) splits the package: `@modelcontextprotocol/server` / `/client` / `/node` (shared runtime / `InMemoryTransport` etc.), plus framework integrations `/express` / `/hono` / `/fastify`. Node.js **>= 20** is required for the v2 series. `inputSchema` changes from the v1 raw shape to accepting any **Standard Schema**-compatible library, not just Zod (e.g. Valibot, ArkType). v2 stable missed its Q1 2026 target and remains in alpha. Stable stays on the v1 series for now (this article is based on v1.29.0, current npm latest = 1.29.0).
