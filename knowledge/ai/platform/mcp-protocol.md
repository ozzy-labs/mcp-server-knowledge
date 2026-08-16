---
reviewed: 2026-08-16
tags: [ai-workflow, methodology]
---

# Model Context Protocol (MCP)

An open standard announced by Anthropic in 2024. It connects AI agents (clients) to external context and tools (servers) via a standardized protocol — the mental model is USB-C: "one interface to connect many kinds of peripherals."

Official: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

The latest specification is the **2026-07-28** revision, released on 2026-07-28 (previous: 2025-11-25 / 2025-06-18 / 2025-03-26). This article is based on 2026-07-28 — **the largest revision since MCP launched**. It removes protocol-level sessions and the `initialize` handshake, making MCP stateless, and replaces server-initiated requests with the Multi Round-Trip Requests pattern. See [What changed in 2026-07-28](#what-changed-in-2026-07-28) for the full breakdown.

On December 9, 2025, Anthropic donated MCP to the **Agentic AI Foundation** (AAIF, a directed fund under the Linux Foundation), moving to vendor-neutral community governance jointly with OpenAI, Block, and others. AAIF launched with 150+ member organizations and three anchor projects: MCP, goose, and AGENTS.md. The AAIF governing board handles budget and membership; technical decisions on the spec continue to be handled by the existing maintainers and the SEP process, with the Linux Foundation explicitly not dictating technical direction.

## Architecture

```text
┌─────────────────┐         stdio / HTTP        ┌────────────────┐
│   MCP Client    │ ◄──────── JSON-RPC ────────► │   MCP Server   │
│ (Claude Code,   │                              │  (DB, API,     │
│  Codex, Gemini) │                              │  file system)  │
└─────────────────┘                              └────────────────┘
```

- **Host**: the agent application itself (e.g., Claude Code)
- **Client**: the connector within the host that talks to a single MCP server
- **Server**: a process (stdio) or HTTP endpoint that provides tools, resources, and prompts

As of 2026-07-28 the relationship is **stateless**: there is no `initialize` handshake and no protocol-level session, so every request is self-contained and capability negotiation happens per request. Servers never initiate JSON-RPC requests and clients never send JSON-RPC responses — the only message directions are client→server requests/notifications and server→client responses/notifications.

## Primitives

### The 3 core primitives

| Primitive | Purpose | How the agent treats it |
|---|---|---|
| **Tools** | Actions with side effects (DB writes, API calls) | The LLM chooses to invoke the tool |
| **Resources** | Read-only data (files, query results, documents) | Attached to context |
| **Prompts** | Reusable prompt templates | Invoked by the user, e.g. via slash commands |

Each has a `list` and `read`/`call`/`get` RPC method pair.

### Extended primitives

Mechanisms that let the server reach back into the client. **In 2026-07-28 these are no longer server-initiated JSON-RPC requests** — the server returns an `InputRequiredResult` and the client retries the original request. See [Multi Round-Trip Requests (MRTR)](#multi-round-trip-requests-mrtr).

| Primitive | Status in 2026-07-28 | Purpose |
|---|---|---|
| **Elicitation** | Active | The server asks the user for additional information — a form or prompt to fill in missing parameters |
| **Sampling** | **Deprecated** (SEP-2577) | The server asks the client (the host LLM) to run inference. Suggested migration: integrate with an LLM provider API directly |
| **Roots** | **Deprecated** (SEP-2577) | The client informs the server of the filesystem boundaries it is permitted to access. Suggested migration: pass directories/files as tool parameters, resource URIs, or server configuration |
| **Logging** | **Deprecated** (SEP-2577) | The server sends structured logs to the client. Suggested migration: log to `stderr` (stdio) or use OpenTelemetry |

Deprecated features remain fully functional during a minimum **12-month deprecation window**, but new implementations should not adopt them. `logging/setLevel` was removed outright; log level is now set per request via `io.modelcontextprotocol/logLevel` in `_meta`, and servers MUST NOT emit `notifications/message` for requests that omit it. `ping` and `notifications/roots/list_changed` were also removed.

A server MUST NOT send an input request the client has not declared support for in `io.modelcontextprotocol/clientCapabilities`. 2025-11-25 had added **Tasks** (experimental), Sampling tool calling via `tools`/`toolChoice`, and Elicitation URL mode plus single/multi-select enums; 2026-07-28 moved Tasks out of the core protocol into the official extension `io.modelcontextprotocol/tasks` (SEP-2663) and removed the `notifications/elicitation/complete` notification and the `elicitationId` field.

## Transports

| Transport | Status | Use case |
|---|---|---|
| **stdio** | Active | Newline-delimited JSON-RPC over the standard streams of a client-launched subprocess. Simplest option |
| **Streamable HTTP** | Active (recommended) | Each message is an HTTP POST to a single MCP endpoint; the reply is a JSON object or a request-scoped SSE stream |
| **HTTP with SSE** | **Deprecated** (SEP-2596) | Legacy two-endpoint transport. Soft-deprecated since 2025-03-26, formally reclassified as Deprecated in 2026-07-28 |

stdio is used for local agents; Streamable HTTP is used for cloud-hosted servers (e.g. `mcp.anthropic.com/*`). Custom transports are allowed; those running over a reliable bidirectional byte stream (Unix sockets, TCP) SHOULD reuse the stdio framing rather than inventing a new one.

2026-07-28 reworked Streamable HTTP substantially:

- **No protocol-level sessions**: the `Mcp-Session-Id` header is gone, and list endpoints no longer vary per connection. Servers needing cross-call state mint an explicit handle and pass it as an ordinary tool argument (SEP-2567)
- **`Mcp-Method` / `Mcp-Name` headers are required** on POSTs, so ordinary HTTP infrastructure can route and authorize without parsing the body; `x-mcp-header` derives custom headers from tool parameters (SEP-2243). The body remains the source of truth, and the binding defines how header/body mismatches are rejected
- **No SSE resumability**: `Last-Event-ID` and SSE event IDs are removed. A broken response stream loses the in-flight request, and the client MUST re-issue it with a new request ID
- **`subscriptions/listen`** replaces the HTTP GET endpoint and `resources/subscribe` / `resources/unsubscribe` — a single long-lived POST-response stream that the client opts into per notification type (`toolsListChanged`, `promptsListChanged`, `resourcesListChanged`, `resourceSubscriptions`)
- **Cancellation** is signaled by closing the request's response stream on Streamable HTTP; stdio still uses `notifications/cancelled`

## Typical RPC flow

```text
1. Client → Server: server/discover
2. Server → Client: { supportedVersions, capabilities, ttlMs, cacheScope,
                      _meta: { "io.modelcontextprotocol/serverInfo": {...} } }
3. Client → Server: tools/list
                    _meta: { "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                             "io.modelcontextprotocol/clientCapabilities": {...},
                             "io.modelcontextprotocol/clientInfo": {...} }
4. Server → Client: { resultType: "complete", tools: [...], ttlMs, cacheScope }
5. Client → Server: tools/call { name, arguments }
6. Server → Client: { resultType: "complete", content: [{ type: "text", text: "..." }] }
```

There is **no `initialize` / `notifications/initialized` handshake** as of 2026-07-28 (SEP-2575). Every request self-describes via `_meta.io.modelcontextprotocol/*`, so any request can land on any load-balanced server instance. Version mismatches return `UnsupportedProtocolVersionError`.

`server/discover` MUST be implemented by servers; clients MAY call it up front for version selection, or use it as a backward-compatibility probe on stdio (a server that fails it is an `initialize`-era server). Every result now carries a required `resultType` field — `"complete"` or `"input_required"`; results from earlier-protocol servers that omit it MUST be treated as `"complete"`.

`tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list` results carry required `ttlMs` (freshness hint in ms) and `cacheScope` (`"public"` / `"private"`) fields, so clients can cache instead of polling (SEP-2549). Servers SHOULD return tools from `tools/list` in a deterministic order to improve LLM prompt cache hit rates.

### Multi Round-Trip Requests (MRTR)

MRTR (SEP-2322) is how a server obtains additional input without holding state or requiring stateful load balancing. It is a **breaking change**: the previous server-initiated request pattern is no longer supported.

```text
1. Client → Server: tools/call (id: 1)
2. Server → Client: { resultType: "input_required",
                      inputRequests: { "<key>": { method: "elicitation/create", params: {...} } },
                      requestState: "<opaque, integrity-protected blob>" }
   → the initial request is now terminated
3. Client gathers the input from the user
4. Client → Server: tools/call (id: 2, same params + inputResponses + requestState)
5. Server → Client: { resultType: "complete", ... }
```

- `inputRequests` values MUST be one of `ElicitRequest`, `CreateMessageRequest`, or `ListRootsRequest`
- `InputRequiredResult` is only allowed on `prompts/get`, `resources/read`, and `tools/call`
- The retry MUST use a **different JSON-RPC id** — the two requests are independent
- `requestState` is opaque to the client (MUST NOT be inspected or modified) and MUST be echoed back verbatim. Servers MUST treat it as **attacker-controlled input**: protect its integrity (HMAC/AEAD) and bind it to the authenticated principal, a short TTL, and the originating request to bound replay

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

This is the TypeScript SDK **v1** API (npm `latest` is `1.30.0`), which still speaks the 2025-era protocol. **v2 shipped 2026-07-27** alongside the `2026-07-28` revision: `@modelcontextprotocol/sdk` split into `@modelcontextprotocol/server` / `@modelcontextprotocol/client`, `inputSchema` takes a full Standard Schema object instead of a Zod raw shape, and serving is factory-based (`serveStdio(createServer)` / `createMcpHandler(factory)`). Serving `2026-07-28` is opt-in even on v2. See [`mcp-typescript-sdk.md`](mcp-typescript-sdk.md).

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
- **Remote HTTP**: OAuth 2.0 + PKCE was **formally adopted in 2025-06-18**. 2025-11-25 added OpenID Connect Discovery 1.0, incremental scope consent via `WWW-Authenticate`, and OAuth **Client ID Metadata Documents** (CIMD). 2026-07-28 hardens authorization further:
  - **Dynamic Client Registration (RFC 7591) is deprecated** in favor of CIMD; DCR remains only for backwards compatibility with authorization servers that lack CIMD support
  - Authorization servers SHOULD return the RFC 9207 `iss` parameter, and clients **MUST** validate a present `iss` against the recorded issuer before redeeming the authorization code (SEP-2468)
  - Client credentials are **bound to the issuer** that minted them: key persisted credentials by issuer identifier, never reuse them with a different authorization server, and re-register when the AS changes (SEP-2352)
  - Clients MUST specify an appropriate `application_type` during DCR to avoid OpenID Connect redirect-URI conflicts (SEP-837)
- **Isolate dangerous tools**: control on the agent side via `destructiveHint` or per-tool approval
- **Prompt injection**: text returned by a server should not be trusted the same as text absent user input
- **`requestState` is attacker-controlled**: under MRTR the opaque state blob round-trips through the client, so servers MUST integrity-protect it and reject state that fails verification

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

2026-07-28 formalized **extensions** as a first-class framework (SEP-2133). Extensions are optional, always opt-in, and evolve independently of the core protocol. They are identified by a reverse-DNS `{vendor-prefix}/{extension-name}` pair — official ones use `io.modelcontextprotocol`, third parties use a domain they own (e.g. `com.example/my-extension`). Official extensions live in `modelcontextprotocol/ext-*` repositories; experimental incubations live in `experimental-ext-*` and must be tied to a Working or Interest Group.

Negotiation is per request rather than per session: clients advertise `extensions` inside `_meta["io.modelcontextprotocol/clientCapabilities"]`, and servers advertise them in the `server/discover` result's `capabilities.extensions`. If one side lacks support, the other falls back to core behavior or rejects the request.

| Official extension | Purpose |
|---|---|
| `io.modelcontextprotocol/tasks` | Asynchronous execution of long-running operations — polling via `tasks/get`, mid-flight input via `tasks/update`, durable handles (moved out of core in 2026-07-28) |
| **MCP Apps** (`ext-apps`) | Interactive UI (charts, forms, video players, dashboards) rendered inline in the conversation |
| **OAuth Client Credentials** (`ext-auth`) | OAuth 2.0 client credentials flow for machine-to-machine authentication |
| **Enterprise-Managed Authorization** (`ext-auth`) | Centralized access control for enterprise environments |

**MCP Apps** was announced in January 2026 as the first official MCP extension. A tool points to a `ui://`-scheme UI resource via `_meta.ui.resourceUri`; the host fetches the resource and renders its HTML in a sandboxed iframe, communicating over postMessage with a `ui/`-prefixed JSON-RPC dialect. `_meta.ui` can also carry `csp` (allowed external origins) and `permissions` (e.g. microphone, camera). Supported by Claude, Claude Desktop, VS Code GitHub Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam, and Archestra.AI — see the [client matrix](https://modelcontextprotocol.io/extensions/client-matrix).

## MCP Registry

The official **MCP Registry** (`registry.modelcontextprotocol.io`) is a metadata catalog of publicly available MCP servers. As of 2026-08 it is still in **preview** (no GA date announced; breaking changes and data resets may occur). Servers publish a `server.json` under a **reverse-DNS namespace** (e.g. `io.github.<user>/<server>`) with DNS/OIDC-based ownership verification, exposed over a REST/OpenAPI API. It is designed to be consumed by **downstream aggregators / marketplaces** rather than directly by hosts, and is backed by Anthropic, GitHub, PulseMCP, and Microsoft.

## What changed in 2026-07-28

The 2026-07-28 revision was **released as stable on 2026-07-28** (RC published 2026-05-29). It is the largest revision since MCP launched, and it contains breaking changes — most consequentially for anyone relying on session identifiers.

### Major changes

| SEP | Change |
|---|---|
| **SEP-2575** | Removes `initialize` / `notifications/initialized` — the protocol is now **stateless**. Every request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `_meta`; `server/discover` becomes a mandatory server RPC. Also removes `ping`, `logging/setLevel`, `notifications/roots/list_changed`, and SSE resumability, and replaces the HTTP GET endpoint plus `resources/subscribe` with `subscriptions/listen` |
| **SEP-2567** | Removes Streamable HTTP's protocol-level session and the `Mcp-Session-Id` header. List endpoints no longer vary per connection; servers needing state mint explicit handles passed as tool arguments |
| **SEP-2322** | Introduces **MRTR**. Servers return `InputRequiredResult` (`resultType: "input_required"`) with `inputRequests`; clients retry with `inputResponses`. All results now carry a required `resultType` |
| **SEP-2663** | Moves Tasks out of core into the official extension `io.modelcontextprotocol/tasks`: polling `tasks/get` replaces the blocking `tasks/result`, `tasks/update` is added, `tasks/list` is removed |
| **SEP-2243** | Makes `Mcp-Method` / `Mcp-Name` headers mandatory on Streamable HTTP POSTs; adds `x-mcp-header` for custom headers from tool parameters |
| **SEP-2549** | Requires `ttlMs` and `cacheScope` (`public` / `private`) on list and read results via a `CacheableResult` interface |
| **SEP-2577** | Deprecates Roots, Sampling, and Logging |
| **SEP-2596** | Adopts the feature lifecycle / deprecation policy and reclassifies HTTP+SSE as Deprecated |
| **SEP-2133** | Formalizes the extensions framework (reverse-DNS identifiers, independent versioning, SEP Extensions Track) |

### Minor changes worth knowing

- `inputSchema` / `outputSchema` accept any JSON Schema 2020-12 keywords, and `structuredContent` accepts any JSON value, with `$ref` resolution requirements added (SEP-2106)
- Error codes were partitioned: `-32000`–`-32019` stays implementation-defined, `-32020`–`-32099` is reserved for the spec. Resource-not-found moved from `-32002` to `-32602` (Invalid Params)
- OpenTelemetry trace context propagation (`traceparent`, `tracestate`, `baggage`) is documented as a `_meta` convention (SEP-414)
- Authorization hardening: RFC 9207 `iss` validation, issuer-bound client credentials, `application_type` on DCR, and DCR deprecated in favor of CIMD

### Deprecation policy

SEP-2596 defines three feature states — **Active / Deprecated / Removed** — with a minimum **12-month deprecation window** and a published [deprecated features registry](https://modelcontextprotocol.io/specification/2026-07-28/deprecated). Currently Deprecated: Roots, Sampling, Logging, the HTTP+SSE transport, the `includeContext` values `"thisServer"` / `"allServers"`, and OAuth Dynamic Client Registration.

### Backward compatibility

Earlier revisions used an `initialize` handshake and allowed server-initiated requests. Clients and servers that need to interoperate across the boundary detect the counterpart's era (on stdio, by probing `server/discover`) and fall back — see the [versioning compatibility matrix](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning). SDKs adopt the revision at their own pace: all four Tier 1 SDKs support 2026-07-28, and Rust supports it in beta.

See the [2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog), the [release announcement](https://blog.modelcontextprotocol.io/posts/2026-07-28/), and the [SEP repository](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/seps) for details.

## Reference implementations

- **Reference servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (filesystem, GitHub, Slack, etc.)
- **SDKs**: TypeScript / Python / C# / Go (**Tier 1**) / Java / Rust / Ruby (**Tier 2**) / Swift / PHP / Kotlin (**Tier 3**). All four Tier 1 SDKs support `2026-07-28`; Rust supports it in beta. See [SDK tiers](https://modelcontextprotocol.io/community/sdk-tiers)
- **Inspector**: `npx @modelcontextprotocol/inspector <command>` for interactive server debugging
