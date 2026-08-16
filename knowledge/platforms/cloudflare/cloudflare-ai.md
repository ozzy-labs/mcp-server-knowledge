---
reviewed: 2026-08-16
tags: [cloudflare, ai-platform, cloud-hosted, typescript]
---

# Cloudflare AI (Workers AI / AI Gateway / Agents / MCP)

Cloudflare's AI stack runs inference, agent state, and MCP servers on the same Workers runtime as the rest of the platform. In 2026 Cloudflare replaced Developer Week with **Agents Week** (2026-04 and 2026-08) and reframed the platform around agent workloads, so much of this area changed inside the last year — most importantly, the MCP server API on Workers.

Official: [developers.cloudflare.com/workers-ai](https://developers.cloudflare.com/workers-ai/) / [agents](https://developers.cloudflare.com/agents/)

> **Stale-knowledge warning.** Three things flipped recently: `McpAgent` is deprecated in favor of the stateless `createMcpHandler`; AutoRAG was renamed **AI Search** (2025-09-25); Browser Rendering was renamed **Browser Run** (2026-04-15). Code generated from older training data will use the wrong API names.

## Workers AI

```jsonc
{ "ai": { "binding": "AI" } }
```

```ts
const res = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { prompt: "Hello" });
const stream = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages, stream: true });
```

- Model IDs take the form `@cf/<vendor>/<model>`; the catalog spans text generation, embeddings, rerankers, image, ASR/TTS, and vision. Verify an ID on its own model page — the index and detail pages have disagreed on vendor slugs
- **OpenAI-compatible endpoints**: `https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1` serving `/chat/completions` and `/embeddings`, usable directly from the OpenAI SDK
- **Function calling**: models return tool calls, or use embedded function calling from `@cloudflare/ai-utils` (`runWithTools`, `createToolsFromOpenAPISpec`)
- **Batch API**: submit a job, receive `{ status: "queued", request_id }`, poll for results (10 MB payload cap). Redesigned to a pull-based async API on 2026-03-19
- **Pricing** is denominated in **Neurons**: 10,000 Neurons/day free on both plans, then $0.011 per 1,000 Neurons on Workers Paid. Frontier models (Kimi K2.6/K2.7-Code, GLM-5.2, DeepSeek V4 Pro) require Workers Paid or prepaid AI Gateway credits — the Free plan gets a 403
- **Unified billing (2026-08-07)**: the same `AI` binding now reaches supported third-party providers, prepaid AI Gateway credits can pay for Workers AI inference, and credit-backed accounts get 50 rpm per model instead of 20

## AI Gateway

A proxy in front of any provider (OpenAI, Anthropic, Google, Replicate, Workers AI) that adds caching, rate limiting, retries and fallbacks, spend limits, guardrails, DLP, logging, and analytics. The core gateway is **free on all plans**.

```text
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions
```

- The `compat` endpoint is OpenAI-shaped and takes `{provider}/{model}` in the `model` field (`openai/gpt-5.2`, `anthropic/claude-4-5-sonnet`, `workers-ai/@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Dynamic routes are addressed as `dynamic/{route}`
- A `default` gateway is created on first request — there is no setup step
- From a Worker, route Workers AI through it with the third argument:

```ts
await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { prompt },
  { gateway: { id: "my-gateway", skipCache: false, cacheTtl: 3360 } });
```

- Logs are the metered part: 100,000 logs total across gateways on Free, 10M per gateway on Paid. Guardrails bill as Workers AI inference; Unified Billing adds a 5% fee on credit purchases with no markup on provider pricing

## Agents SDK

`agents` (npm, v0.20.1) builds stateful agents on **Durable Objects** — each agent instance is a DO with embedded SQLite, giving durable identity, per-instance storage, WebSockets, and scheduling.

```ts
import { Agent, routeAgentRequest, callable } from "agents";

export class CounterAgent extends Agent<Env, { count: number }> {
  initialState = { count: 0 };

  @callable()
  increment() {
    this.setState({ count: this.state.count + 1 });
    return this.state.count;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
};
```

| API | Purpose |
|---|---|
| `this.state` / `setState()` / `onStateChanged()` | Persisted state, synced to connected clients. Never mutate `state` directly |
| ``this.sql`SELECT …` `` | Tagged-template SQL against the agent's own SQLite |
| `onStart` / `onRequest` / `onConnect` / `onMessage` | Lifecycle and connection hooks |
| `this.schedule(when, "method", payload)` | Delay in seconds, a `Date`, or a cron string; `listSchedules()`, `getScheduleById()`, `cancelSchedule()` |
| `routeAgentRequest(request, env, opts)` | Default routing at `/agents/:agent/:instance` |
| `getAgentByName(env.MyAgent, "id", opts)` | Direct stub access, with `locationHint` / `jurisdiction` / `props` |
| `useAgent` from `agents/react` | Client hook; `agent.call("method", [args])` |

Scaffold with `npm create cloudflare@latest -- --template cloudflare/agents-starter`. An agent can also act as an **MCP client** (`await this.addMcpServer("github", "https://…/mcp")`, then `this.mcp.getAITools()`). `@cloudflare/think` ("Project Think", preview) is the next-generation harness with fibers, sub-agents, and forkable sessions.

## MCP servers on Workers

MCP spec **2026-07-28** made the protocol stateless: no required handshake, no session IDs in the request path, server-initiated input via Multi-Round-Trip Requests, new `Mcp-Method` / `Mcp-Name` headers, and DCR deprecated in favor of pre-registered clients and CIMD. Cloudflare co-drove that release, replatformed the MCP TypeScript SDK onto Web Standards, and split it into `@modelcontextprotocol/server@2` and `@modelcontextprotocol/client@2` (the v1 lane remains `@modelcontextprotocol/sdk@1.30.0`). See [`../../ai/platform/mcp-protocol.md`](../../ai/platform/mcp-protocol.md) and [`../../ai/platform/mcp-typescript-sdk.md`](../../ai/platform/mcp-typescript-sdk.md).

### Current API — `createMcpHandler` (stateless, no Durable Object)

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { z } from "zod";

function createServer() {
  const server = new McpServer({ name: "hello-server", version: "1.0.0" });
  server.registerTool(
    "hello",
    { description: "Return a greeting", inputSchema: { name: z.string().optional() } },
    async ({ name }) => ({ content: [{ type: "text", text: `Hello, ${name ?? "World"}!` }] }),
  );
  return server;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return createMcpHandler(createServer)(request, env, ctx);
  },
};
```

- Pass the **factory, not an instance** — a fresh isolated `McpServer` is built per request
- Serve at `/mcp` over **Streamable HTTP**. SSE is deprecated; Cloudflare's own servers return **410 Gone** on `/sse`
- **`McpAgent` is deprecated and feature-frozen**, kept only so existing servers can migrate. Stay on it only if you genuinely need protocol sessions, server→client pushes, standalone streams, or replay

### Authorization

`@cloudflare/workers-oauth-provider` implements OAuth 2.1 in front of an MCP handler, supporting pre-registered clients, **CIMD** (an HTTPS URL as `client_id`), and legacy DCR.

```ts
export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: mcpHandler,
  defaultHandler: MyAuthHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

With the stateless handler, token metadata arrives at `context.http.authInfo` rather than `this.props`; gate tools there or register them conditionally. Cloudflare documents third-party identity patterns for GitHub, Google, Auth0, Stytch, and WorkOS.

`workers-mcp` is the superseded local-stdio approach — use `agents` + `createMcpHandler` instead.

### Cloudflare's hosted MCP servers

All use `/mcp` (Streamable HTTP) and OAuth. `https://mcp.cloudflare.com/mcp` is the newest: 2,500+ API endpoints exposed through a **search + execute** pattern that fits in roughly 1,000 tokens instead of a million.

| Server | URL |
|---|---|
| Cloudflare API (Code Mode) | `https://mcp.cloudflare.com/mcp` |
| Documentation | `https://docs.mcp.cloudflare.com/mcp` |
| Workers Bindings / Builds | `https://bindings.mcp.cloudflare.com/mcp` · `https://builds.mcp.cloudflare.com/mcp` |
| Observability / Logpush | `https://observability.mcp.cloudflare.com/mcp` · `https://logs.mcp.cloudflare.com/mcp` |
| AI Gateway / AI Search | `https://ai-gateway.mcp.cloudflare.com/mcp` · `https://autorag.mcp.cloudflare.com/mcp` |
| Browser Run / Container | `https://browser.mcp.cloudflare.com/mcp` · `https://containers.mcp.cloudflare.com/mcp` |
| Radar / GraphQL / Audit Logs / DNS Analytics | `https://radar.mcp.cloudflare.com/mcp` · `https://graphql.mcp.cloudflare.com/mcp` · `https://auditlogs.mcp.cloudflare.com/mcp` · `https://dns-analytics.mcp.cloudflare.com/mcp` |

For stdio-only clients, bridge with `mcp-remote`:

```json
{ "mcpServers": { "cf-docs": { "command": "npx", "args": ["mcp-remote", "https://docs.mcp.cloudflare.com/mcp"] } } }
```

Cloudflare also publishes a Claude Code plugin (`/plugin marketplace add cloudflare/skills`, then `/plugin install cloudflare@cloudflare`) and **MCP server portals** in Cloudflare One, which aggregate several internal or SaaS MCP servers behind one Access-protected endpoint with per-user tool visibility.

## AI Search (formerly AutoRAG)

Managed RAG: R2 or a website crawl → chunking → embeddings → Vectorize → query, reachable from a Worker binding, REST, or MCP.

```jsonc
{ "ai_search": [{ "binding": "MY_SEARCH", "instance_name": "docs" }] }
```

```ts
const results = await env.MY_SEARCH.search({ messages: [{ role: "user", content: "What is a binding?" }] });
const answer = await env.MY_SEARCH.chatCompletions({
  messages, model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  ai_search_options: { retrieval: { max_num_results: 5 } },
});
```

- `search()` retrieves; `chatCompletions()` retrieves and generates (replacing the old `aiSearch()`), with `stream: true` supported. A namespace binding (`ai_search_namespaces`) can query up to 10 instances
- The legacy `env.AI.autorag("name").aiSearch()` shape and `createAutoRAG` helper still work but are superseded
- Storage, indexing, and crawling are included; Workers AI and AI Gateway usage bill separately. Limits (Free/Paid): 100/5,000 instances, 100,000/1M files, 20,000/unlimited monthly queries

## Adjacent primitives

- **Vectorize** — GA vector database; the index layer under AI Search. See [`cloudflare-storage.md`](cloudflare-storage.md#vectorize)
- **Browser Run** (formerly Browser Rendering) — headless Chrome: stateless Quick Actions (screenshot, PDF, markdown, JSON extraction, crawl, links) plus sessions driven by Cloudflare's Puppeteer/Playwright forks, raw CDP, or Stagehand
- **Sandbox SDK** (`@cloudflare/sandbox`, GA on Containers) — run untrusted code, shell commands, and background processes via `getSandbox(env.Sandbox, "user-id")`. **Dynamic Workers** (open beta) is the lighter isolate-based variant for AI-generated code
- **Code Mode** (`@cloudflare/codemode`) — converts an MCP server's schema into a documented TypeScript API and gives the model a single `code()` tool executed in a sandbox whose only outward access is RPC back into those APIs; Cloudflare reports ~81% token reduction versus exposing tools directly

## AI crawler policy

- **2025-07-01**: new domains onboarding to Cloudflare default to blocking AI crawlers, and **pay per crawl** (HTTP 402, minimum $0.01 per crawl) entered private beta
- **AI Crawl Control** classifies crawlers as Search / Agent / Training. From **2026-09-15**, new domains block Training and Agent crawlers by default on ad-displaying pages while allowing Search

## Ecosystem notes

- **Claude Managed Agents on Cloudflare** (2026-05-19): Anthropic runs the agent loop, Cloudflare Sandboxes run the code, with credential-injecting proxies, exfiltration prevention, and private connectivity through Cloudflare Mesh / Workers VPC
- Anthropic models are **not** hosted on Workers AI — reach them through AI Gateway (`anthropic/claude-4-5-sonnet`) or as an AI Search inference provider. OpenAI's open-weight `gpt-oss-120b` / `gpt-oss-20b` do run on Workers AI
- Cloudflare CASB consumes Anthropic's Compliance API to surface findings for Claude organizations

## References

- [Workers AI](https://developers.cloudflare.com/workers-ai/) — [pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) / [OpenAI compatibility](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/) / [function calling](https://developers.cloudflare.com/workers-ai/features/function-calling/)
- [AI Gateway](https://developers.cloudflare.com/ai-gateway/) / [chat completion endpoint](https://developers.cloudflare.com/ai-gateway/usage/chat-completion/) / [pricing](https://developers.cloudflare.com/ai-gateway/reference/pricing/)
- [Agents](https://developers.cloudflare.com/agents/) / [Agent API](https://developers.cloudflare.com/agents/api-reference/agents-api/) / [cloudflare/agents](https://github.com/cloudflare/agents)
- [MCP handler API](https://developers.cloudflare.com/agents/model-context-protocol/apis/handler-api/) / [transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) / [authorization](https://developers.cloudflare.com/agents/model-context-protocol/authorization/) / [hosted servers](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/) / [cloudflare/mcp-server-cloudflare](https://github.com/cloudflare/mcp-server-cloudflare) / [MCPv2 announcement](https://blog.cloudflare.com/mcp-v2/)
- [AI Search](https://developers.cloudflare.com/ai-search/) / [Browser Run](https://developers.cloudflare.com/browser-run/) / [Sandbox](https://developers.cloudflare.com/sandbox/) / [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/)
- Related: [`cloudflare.md`](cloudflare.md), [`cloudflare-workers.md`](cloudflare-workers.md), [`cloudflare-storage.md`](cloudflare-storage.md), [`../../ai/platform/mcp-protocol.md`](../../ai/platform/mcp-protocol.md), [`../../ai/platform/mcp-typescript-sdk.md`](../../ai/platform/mcp-typescript-sdk.md)
