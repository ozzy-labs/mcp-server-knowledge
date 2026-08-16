---
reviewed: 2026-08-16
tags: [cloudflare, cloud-hosted, infrastructure, commercial]
---

# Cloudflare

Cloudflare runs a global proxy network (330+ cities in 125+ countries) that started as CDN, DNS, and DDoS protection and is now also a serverless developer platform. It self-describes as the "connectivity cloud"; since 2026 the developer-facing narrative is explicitly agent-centric — **Agents Week** replaced Developer Week and ran twice in 2026 (April and August). This article is the map; each area has its own article.

Official: [developers.cloudflare.com](https://developers.cloudflare.com/) / [products index](https://developers.cloudflare.com/products/)

| Area | Article |
|---|---|
| Serverless runtime, bindings, limits | [`cloudflare-workers.md`](cloudflare-workers.md) |
| CLI, configuration, deployment | [`wrangler.md`](wrangler.md) |
| KV / R2 / D1 / Durable Objects / Queues | [`cloudflare-storage.md`](cloudflare-storage.md) |
| Workers AI, AI Gateway, Agents, MCP | [`cloudflare-ai.md`](cloudflare-ai.md) |
| Static hosting and framework deploys | [`cloudflare-pages.md`](cloudflare-pages.md) |
| DNS, cache, Rules, WAF, TLS | [`cloudflare-dns-cdn.md`](cloudflare-dns-cdn.md) |
| Tunnel, Access, Zero Trust | [`cloudflare-tunnel.md`](cloudflare-tunnel.md) |

## Product map

| Category | Products (status where notable) |
|---|---|
| **Compute** | Workers, Workflows (GA), Containers (GA), Sandbox SDK (GA), Dynamic Workers (open beta), Workers for Platforms |
| **Storage / data** | Workers KV, R2, D1, Durable Objects, Queues, Hyperdrive, Vectorize, Pipelines (open beta), R2 Data Catalog (public beta), R2 SQL (open beta), Analytics Engine, Artifacts (private beta), Secrets Store |
| **AI** | Workers AI, AI Gateway, AI Search (formerly AutoRAG), Agents SDK, Project Think (preview), Agent Memory (private beta), AI Crawl Control |
| **Developer platform** | Pages, Workers Static Assets, Browser Run (formerly Browser Rendering), Images, Stream, Realtime, Email Service (public beta), Flagship (feature flags), Workers VPC (beta) |
| **Zero Trust (Cloudflare One)** | Access, Gateway, Cloudflare Tunnel, Cloudflare One Client (formerly WARP), Cloudflare Mesh (formerly WARP Connector), CASB, DLP, Browser Isolation, Email Security |
| **Network / edge** | DNS, CDN + Cache Reserve, WAF, Rules, Load Balancing, Argo, API Shield, Bots, DDoS protection, Spectrum, Magic Transit, Cloudflare WAN |

### Renames to get right

Training data is full of superseded names. Current: **AI Search** (was AutoRAG), **Browser Run** (was Browser Rendering), **Cloudflare One Client** (was WARP client), **Cloudflare Mesh** (was WARP Connector), **Workers Static Assets** (was Workers Sites), **Standard usage model** (was Bundled/Unbound).

## Plans and pricing

Two separate axes: the **zone plan** (per domain) and the **Workers plan** (per account).

| Zone plan | Price |
|---|---|
| Free | $0 |
| Pro | $20/mo billed annually ($25 monthly) |
| Business | $200/mo billed annually ($250 monthly) |
| Enterprise | Custom, annual |

| Workers plan | Included |
|---|---|
| Free | 100,000 requests/day, 10 ms CPU per invocation |
| Paid (min $5/month) | 10M requests/month then $0.30/M; 30M CPU-ms/month then $0.02/M CPU-ms |

- Billing is **CPU-time based** — wall-clock duration spent waiting on I/O is not charged, and there are **no egress or bandwidth charges** anywhere on the platform (including R2)
- The $5 subscription covers Workers, Pages Functions, Workers KV, and Hyperdrive; R2, D1, Durable Objects, Queues, Vectorize, and Workers AI meter separately (see [`cloudflare-storage.md`](cloudflare-storage.md) and [`cloudflare-ai.md`](cloudflare-ai.md))
- Workers AI has a **10,000 Neurons/day** free allowance on both plans; some frontier models are Paid-only and return 403 on Free

## Getting in

- **Dashboard**: `https://dash.cloudflare.com`. Find the **account ID** with `⌘/Ctrl + K` → "Copy account ID"; the **zone ID** is on a domain's Overview page
- **REST API**: base `https://api.cloudflare.com/client/v4`, authenticated with `Authorization: Bearer <API_TOKEN>`. The legacy `X-Auth-Email` + `X-Auth-Key` global-key pair still works but should not be used. Tokens now carry a scannable `cfut_` prefix so leak detectors can find them, and support resource-scoped permissions
- **Wrangler**: `wrangler login` (OAuth, `--use-keyring` to store in the OS credential manager), `wrangler whoami`. Credential precedence is `CLOUDFLARE_API_TOKEN` > `CLOUDFLARE_API_KEY`/`CLOUDFLARE_EMAIL` > OAuth — use an API token in CI. See [`wrangler.md`](wrangler.md)
- **`cf` CLI** (technical preview, `npx cf`) is an early look at a unified CLI across all products; Wrangler remains the tool to use today
- **Terraform**: `cloudflare/cloudflare` provider v5 (OpenAPI-generated rewrite; v5.23.0 on 2026-08-05)
- **MCP servers**: Cloudflare hosts official remote MCP servers for docs, bindings, observability, Radar, and the whole API — listed in [`cloudflare-ai.md`](cloudflare-ai.md#cloudflares-hosted-mcp-servers). There is also a docs section, [Agent setup](https://developers.cloudflare.com/agent-setup/), covering Claude Code, Codex, Cursor, Copilot, and others

## Network and data locality

- Smart Placement (`"placement": { "mode": "smart" }`) moves a Worker closer to its backend after ~15 minutes of traffic analysis; it affects `fetch` handlers only, and never moves static assets
- **Durable Objects jurisdictions** (`eu`, `us`, `fedramp`) are a hard guarantee; **location hints** (`wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`, …) are best-effort and only apply at creation
- **R2** supports location hints and jurisdictional restrictions (`eu`, `fedramp`, Enterprise); jurisdiction **cannot be changed after bucket creation**
- The **Data Localization Suite** (Regional Services, Customer Metadata Boundary, Geo Key Manager) is an Enterprise add-on

## Recent history worth knowing (2025-06 → 2026-08)

- **2026-08-07** Workers AI and AI Gateway unified into one control plane (one binding, shared credits, automatic observability)
- **2026-08-06** MCP spec 2026-07-28 support: stateless MCP servers on Workers without Durable Objects; WebMCP developer preview
- **2026-08-04** Node.js compatibility enabled by default for new compatibility dates
- **2026-04** Agents Week: Containers and Sandbox SDK GA, Cloudflare Mesh, scannable API tokens, Project Think preview, Flagship, `cf` CLI, Browser Run rename
- **2026-03-24** Dynamic Workers open beta; **2026-02-11** the 1,000-subrequest limit removed
- **2025-09-25** Cloudflare Data Platform (Pipelines + R2 Data Catalog + R2 SQL); AutoRAG renamed AI Search
- **2025-04** Durable Objects SQLite GA and available on the Free plan; Workflows GA
- **2025-04-08** Cloudflare states that new investment goes to Workers rather than Pages (Pages remains supported)

## Common mistakes

1. **Assuming Pages is deprecated.** It is not — Cloudflare recommends Workers for new projects but keeps Pages supported on all plans
2. **Citing 2021-era Workers limits** ("15 minutes CPU, 100 scripts"). Current: 5 min CPU per invocation (15 min wall clock for Cron Triggers, Queue consumers, and Durable Object alarms), 500 Workers on Paid
3. **Using old product names** (see the rename list above) — generated code fails to compile against the current SDKs
4. **Confusing the zone plan with the Workers plan** — a Free zone can run a Paid Workers account and vice versa
5. **Expecting a region.** There is no region to select; use jurisdictions or location hints when data locality matters

## References

- [Developer docs](https://developers.cloudflare.com/) / [products](https://developers.cloudflare.com/products/) / [what is Cloudflare](https://www.cloudflare.com/what-is-cloudflare/) / [plans](https://www.cloudflare.com/plans/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) / [find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/) / [make API calls](https://developers.cloudflare.com/fundamentals/api/how-to/make-api-calls/) / [create an API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Changelog](https://developers.cloudflare.com/changelog/) / [Agents Week August 2026 review](https://blog.cloudflare.com/agents-week-review-august-2026/) / [Agent setup](https://developers.cloudflare.com/agent-setup/)
- Related: [`cloudflare-workers.md`](cloudflare-workers.md), [`wrangler.md`](wrangler.md), [`cloudflare-storage.md`](cloudflare-storage.md), [`cloudflare-ai.md`](cloudflare-ai.md), [`cloudflare-pages.md`](cloudflare-pages.md), [`cloudflare-dns-cdn.md`](cloudflare-dns-cdn.md), [`cloudflare-tunnel.md`](cloudflare-tunnel.md)
