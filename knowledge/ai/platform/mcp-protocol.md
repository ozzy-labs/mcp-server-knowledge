---
reviewed: 2026-07-12
tags: [ai-workflow, methodology]
---

# Model Context Protocol (MCP)

An open standard announced by Anthropic in 2024. It connects AI agents (clients) to external context and tools (servers) via a standardized protocol — the mental model is USB-C: "one interface to connect many kinds of peripherals."

Official: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

The latest specification is the **2025-11-25** revision (previous: 2025-06-18 / 2025-03-26). This article is based on 2025-11-25. On December 9, 2025, Anthropic donated MCP to the **Agentic AI Foundation** (a directed fund under the Linux Foundation), moving to vendor-neutral community governance jointly with OpenAI, Block, and others. Technical decisions on the spec continue to be handled by the existing maintainers and the SEP process.

## Architecture

```text
┌─────────────────┐         stdio / HTTP        ┌────────────────┐
│   MCP Client    │ ◄──────── JSON-RPC ────────► │   MCP Server   │
│ (Claude Code,   │                              │  (DB, API,     │
│  Codex, Gemini) │                              │  file system)  │
└─────────────────┘                              └────────────────┘
```

- **Host**: the agent application itself (e.g., Claude Code)
- **Client**: holds a 1:1 connection to a single MCP server within the host
- **Server**: a process that provides tools, resources, and prompts

## Primitives

### The 3 core primitives

| Primitive | Purpose | How the agent treats it |
|---|---|---|
| **Tools** | Actions with side effects (DB writes, API calls) | The LLM chooses to invoke the tool |
| **Resources** | Read-only data (files, query results, documents) | Attached to context |
| **Prompts** | Reusable prompt templates | Invoked by the user, e.g. via slash commands |

Each has a `list` and `read`/`call`/`get` RPC method pair.

### Extended primitives

Mechanisms that let the server proactively reach into the client:

| Primitive | Purpose |
|---|---|
| **Sampling** | The server asks the client (the host LLM) to run inference. Lets the server borrow agent intelligence without hosting its own LLM |
| **Elicitation** | The server asks the user for additional information — a form or prompt to fill in missing parameters |
| **Logging** | The server sends structured logs to the client, for debugging/auditing |
| **Roots** | The client informs the server of the filesystem boundaries it is permitted to access |

Sampling / Elicitation are only usable when the client (e.g. Claude Code) declares them as capabilities. 2025-11-25 added **Tasks** (experimental — polling / deferred retrieval of durable requests), extended Sampling with tool calling via `tools`/`toolChoice` parameters, and added URL mode and single/multi-select enums to Elicitation.

## Transports

| Transport | Use case |
|---|---|
| **stdio** | Launches a local process as a child process. Simplest option |
| **HTTP with SSE** (legacy) | For remote servers. Server-Sent Events |
| **Streamable HTTP** (recommended) | Bidirectional streaming over HTTP. Suited to auth and multi-tenancy |

stdio is used for local agents; Streamable HTTP is used for cloud-hosted servers (e.g. `mcp.anthropic.com/*`).

## Typical RPC flow

```text
1. Client → Server: initialize
2. Server → Client: capabilities
3. Client → Server: tools/list
4. Server → Client: [{ name, description, inputSchema }, ...]
5. Client → Server: tools/call { name, arguments }
6. Server → Client: { content: [{ type: "text", text: "..." }] }
```

## Minimal server implementation (TypeScript SDK)

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  { name: "my-server", version: "0.1.0" },
  { instructions: "Describe how agents should use this server." }
);

server.registerTool(
  "echo",
  {
    title: "Echo",
    description: "Echo back the input string.",
    inputSchema: { message: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ message }) => ({
    content: [{ type: "text", text: message }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool design best practices

- **Write descriptions for the agent**: the LLM reads this to decide how to use the tool. Make the purpose, argument semantics, and return shape explicit
- **Make inputSchema strict, via Zod / JSON Schema**: reduces LLM hallucination
- **Use annotations**:
  - `readOnlyHint: true` — no side effects (grounds for relaxing tool approval)
  - `destructiveHint: true` — deletes or modifies data
  - `idempotentHint: true` — identical calls produce identical results
  - `openWorldHint: true` — accesses the outside world (e.g. the web). 2025-11-25 also allows `icons` metadata on tools/resources/prompts. The spec explicitly states clients should treat server-side annotations as untrusted
- **Return errors as `isError: true` plus human-readable text**: lets the LLM choose a recovery strategy
- **Return values as text / image / resource**: even structured data is commonly returned as JSON-in-text

## Resources vs. tools

When the same data could be served either way:

- **Tool**: the agent actively chooses to invoke it; queryable via arguments
- **Resource**: added to context at session start or via `@mention`; suited to static/semi-static data

Row lookups in a DB → tool. A project README → resource.

## Authentication and security

- **Local stdio**: pass API keys via environment variables at process launch (the `env` field)
- **Remote HTTP**: OAuth 2.0 + PKCE was **formally adopted in 2025-06-18**. 2025-11-25 adds OpenID Connect Discovery 1.0, incremental scope consent via `WWW-Authenticate`, and OAuth Client ID Metadata Documents (an alternative to dynamic registration)
- **Isolate dangerous tools**: control on the agent side via `destructiveHint` or per-tool approval
- **Prompt injection**: text returned by a server should not be trusted the same as text absent user input

## Major MCP clients

| Client | Registration location |
|---|---|
| Claude Code | `mcpServers` in `~/.claude.json` / `claude mcp add` |
| Codex CLI | `[mcp_servers.*]` in `~/.codex/config.toml` |
| Gemini CLI | `mcpServers` in `~/.gemini/settings.json` |
| GitHub Copilot CLI | `mcpServers` in `~/.copilot/mcp-config.json` |
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |

## MCP Extensions

In January 2026, **MCP Apps** was announced as the first official MCP extension. Without changing the core protocol, a tool can point to a `ui://`-scheme UI resource via the `_meta.ui.resourceUri` field, allowing responses to return interactive React-based UI (dashboards, forms, visualizations, etc.). Claude, ChatGPT, VS Code, Goose, and others already support it.

## MCP Registry

The official **MCP Registry** (`registry.modelcontextprotocol.io`) is a metadata catalog of publicly available MCP servers. As of 2026-07 it is still in **preview** (no GA date announced; breaking changes and data resets may occur). Servers publish a `server.json` under a **reverse-DNS namespace** (e.g. `io.github.<user>/<server>`) with DNS/OIDC-based ownership verification, exposed over a REST/OpenAPI API. It is designed to be consumed by **downstream aggregators / marketplaces** rather than directly by hosts, and is backed by Anthropic, GitHub, PulseMCP, and Microsoft.

## Next revision (2026-07-28 RC)

On 2026-05-29, a release candidate (RC) for the 2026-07-28 revision was published — **the biggest revision since 2025-11-25**. The RC was locked on 2026-05-21, with final release planned for **2026-07-28** (SDKs may adopt it at their own pace, version by version). Major SEPs finalized into the RC:

- **SEP-2577 (Final, merged 2026-05-15)**: Roots / Sampling / Logging enter **deprecation**. Existing implementations keep working during the migration window, but new implementations should avoid them.
- **SEP-2663**: Splits Tasks out of the core protocol into the official extension `io.modelcontextprotocol/tasks`. Replaces the blocking `tasks/result` with polling `tasks/get`, adds `tasks/update`, and removes `tasks/list`.
- **SEP-2575**: Removes `initialize` / `notifications/initialized` to make the protocol **stateless**. Each request carries protocol info via `_meta.io.modelcontextprotocol/protocolVersion`, and a new `server/discover` RPC becomes mandatory.
- **SEP-2567**: Removes Streamable HTTP's protocol-level session and the `Mcp-Session-Id` header. Servers that need state pass a handle via tool arguments instead.
- **SEP-2322**: Introduces the **MRTR (Multi Round-Trip Requests)** pattern. The server returns `inputRequests` (a new resultType) and the client returns `inputResponses` in its next request, replacing the previous server-initiated `roots/list` / `sampling/createMessage` / `elicitation/create`.
- **SEP-2549**: Adds `ttlMs` and `cacheScope` (public/private) to `tools/list` and others, to hint client-side caching.
- **SEP-2243**: Makes `Mcp-Method` / `Mcp-Name` headers mandatory on Streamable HTTP POST requests, and adds custom-header support from tool parameters via `x-mcp-header`.

Alongside this, a **feature lifecycle / deprecation policy** (SEP-2596) was formally adopted, defining three states — Active / Deprecated / Removed — with a minimum **12-month deprecation window**. The HTTP+SSE transport has also been formally reclassified as Deprecated under this policy. Extensions gained a formal process (SEP-2133) for reverse-DNS identifiers and independent versioning, and MCP Apps (SEP-1865) and Tasks (SEP-2663) now ship bundled as official extensions.

See [modelcontextprotocol.io/specification/draft/changelog](https://modelcontextprotocol.io/specification/draft/changelog), the [2026-07-28 RC blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/), and the [SEP repository](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/seps) for details.

## Reference implementations

- **Reference servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (filesystem, GitHub, Slack, etc.)
- **SDKs**: TypeScript / Python / C# / Go (Tier 1) / Java / Rust (Tier 2) / Swift / Ruby / PHP (Tier 3) / Kotlin (TBD)
- **Inspector**: `npx @modelcontextprotocol/inspector <command>` for interactive server debugging
