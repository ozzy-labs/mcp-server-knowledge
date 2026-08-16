---
reviewed: 2026-08-16
tags: [library, commercial, cloud-hosted, ai-workflow]
aliases: [claude-api]
---

# Anthropic API (Claude API)

The API for Claude models provided by Anthropic. This article covers the API itself (app implementation via the SDK). For the Claude Code CLI, see the separate article `ai/agents/claude-code.md`.

Official: [platform.claude.com/docs](https://platform.claude.com/docs)

## SDK installation and authentication

```bash
# Python
pip install anthropic

# TypeScript / JavaScript
npm install @anthropic-ai/sdk
```

Authentication uses the `ANTHROPIC_API_KEY` environment variable (or the `apiKey` argument to the SDK constructor). The SDK automatically attaches the `x-api-key` / `anthropic-version` / `content-type` headers.

### Minimal Messages request

```python
import anthropic

client = anthropic.Anthropic()  # reads from env var
message = client.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
)
print(message.content[0].text)
```

## Current models (as of 2026-08)

| Model | API ID | Context | Max output | Positioning | Price (input/output per 1M) |
|---|---|---|---|---|---|
| **Fable 5** | `claude-fable-5` | 1M | 128K | The most capable widely released model. For the hardest reasoning and long-horizon agentic work. Thinking is always ON (`thinking` is omitted; explicitly setting `disabled` returns 400). Requires 30-day data retention (ZDR not available). Ships **cybersecurity/biology safety classifiers** that can decline a request, returning `stop_reason: "refusal"` as a 200 response (not billed if refused before output; retry another model via the beta `fallbacks` param) | $10 / $50 |
| **Opus 5** | `claude-opus-5` | 1M | 128K | **Current Opus-tier flagship.** Complex agentic coding and enterprise work; strongest on deep reasoning and long-horizon work. **Thinking is ON by default** (omitting `thinking` runs adaptive — unlike Opus 4.8/4.7); `thinking: {type:"disabled"}` is accepted only at `effort` ≤ `high` and returns 400 at `xhigh`/`max`. Raw chain of thought never returned. Runs **safety classifiers** that can return `stop_reason: "refusal"` — a refusal simply stops unless you opt into the beta `fallbacks` param, which routes cyber-flagged requests to Opus 4.8. Knowledge cutoff May 2026 | $5 / $25 |
| **Opus 4.8** | `claude-opus-4-8` | 1M | 128K | Previous Opus-tier flagship, still the safe landing spot for security-adjacent work. Extended thinking not supported (adaptive thinking only), and **adaptive is OFF unless requested**. `effort` defaults to `high` | $5 / $25 |
| **Sonnet 5** | `claude-sonnet-5` | 1M | 128K | Current Sonnet tier. Excellent balance of speed and intelligence; near-Opus for coding/agents. Adaptive thinking is ON by default (adaptive even when `thinking` is omitted; `budget_tokens` returns 400). `effort` ranges `low`–`max` (first Sonnet tier to support `xhigh`). With the new tokenizer, the same text uses ~30% more tokens than Sonnet 4.6 | $2 / $10 |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K | 64K | Fastest and cheapest. Near-frontier intelligence. Supports extended thinking | $1 / $5 |

**Opus 5** (`claude-opus-5`) is now the current **Opus-tier flagship**, replacing Opus 4.8 as a drop-in upgrade at the same $5 / $25 price, 1M context, and 128K max output. Migration is a model-ID swap plus prompt re-tuning, with two breaking changes: (1) **thinking is on by default** — a request that omits `thinking` now thinks, and since `max_tokens` caps thinking *plus* response text, a workload sized tightly around its answer on Opus 4.8 can truncate; (2) **`thinking: {type: "disabled"}` is capped at `effort` `high`** and returns 400 at `xhigh`/`max` (validated per request). It also lowers the **minimum cacheable prompt to 512 tokens** (from 1024), supports the full `low`–`max` effort ladder, adds the `fallbacks: "default"` scalar form (beta `server-side-fallback-2026-07-01`) that routes refusals by category automatically, and adds **mid-conversation tool changes** (beta `mid-conversation-tool-changes-2026-07-01`) — `tool_addition` / `tool_removal` blocks on a `role: "system"` message that change the tool set between turns without invalidating the prompt cache. Two operational caveats: **Opus 5 draws on a rate-limit bucket separate from the combined Opus 4.x pool**, and **Priority Tier does not cover it** (a Priority Tier request naming Opus 5, Sonnet 5, Mythos 5, or Mythos Preview fails validation). Anthropic's highest-performing widely released model, however, is **Claude Fable 5** (`claude-fable-5`, $10 / $50), which sits above the Opus tier but has different API behavior (thinking always ON so the `thinking` parameter is omitted, sampling parameters like `temperature` are not allowed, and 30-day data retention is required). Opus 5 is the default for coding/agentic work; choose Fable 5 only when maximum capability is required. **Mythos 5** (`claude-mythos-5`), available only in limited release through Project Glasswing (invitation-only, no self-serve), shares Fable 5's specs and pricing **but without the safety classifiers** (so it never returns the `refusal` stop reason); it is the successor to Claude Mythos Preview (`claude-mythos-preview`). **Sonnet 5** (`claude-sonnet-5`, $2 / $10) is the current Sonnet tier, replacing Sonnet 4.6. The $2 / $10 launch price **became the standard price on 2026-08-10**; the increase to $3 / $15 that had been scheduled for 2026-09-01 was cancelled. Adaptive thinking is ON by default (it runs in adaptive mode even when `thinking` is omitted; `budget_tokens` returns 400), and `effort` ranges `low`–`max` (the first time `xhigh` is available at the Sonnet tier). Due to the new tokenizer, the same text consumes about 30% more tokens than under Sonnet 4.6 (1M / 128K; sticker pricing is unchanged but effective cost will vary). Opus 4.8 / Opus 4.7 / Opus 4.6 / Sonnet 4.6 are now legacy (still usable, and Opus 4.8 remains the recommended target for cyber-adjacent work, but migration to Opus 5 is otherwise recommended). Opus 4.8 **reduces wasted thinking tokens only when adaptive thinking is enabled**, improving long-horizon agentic coding, compaction recovery, and tool triggering relative to Opus 4.7. The 1M context window **reached GA for Opus 4.6 / Sonnet 4.6 on 2026-03-13** (no header required, standard pricing), and Opus 4.7 / 4.8 default to 1M as well. The legacy beta header `context-1m-2025-08-07` was removed for Sonnet 4.5 / Sonnet 4 on 2026-04-30 and no longer has any effect. Dateless IDs from the 4.6 generation onward (e.g. `claude-opus-4-8`) are also pinned snapshots, not evergreen pointers. **Deprecation**: Opus 4.1 (`claude-opus-4-1-20250805`) **retired on 2026-08-05** — requests to it on the Claude API now return an error. Sonnet 4 (`claude-sonnet-4-20250514`) / Opus 4 (`claude-opus-4-20250514`) retired on 2026-06-15. All three are gone from the Claude API; migrate to `claude-opus-5` / `claude-sonnet-5`. (Bedrock and Google Cloud set their own retirement schedules, so some retired-on-first-party models remain reachable there.) The next scheduled floor is Opus 4.5 (`claude-opus-4-5-20251101`, not sooner than 2026-11-24) and Sonnet 4.5 (`claude-sonnet-4-5-20250929`, not sooner than 2026-09-29).

## Prompt caching — the single most important optimization

Placing cache breakpoints on static system prompts, documents, and tool definitions brings the **cached portion down to 10% of the input token price** on subsequent requests. It also substantially reduces ITPM rate-limit consumption.

**Automatic caching (launched 2026-02-19)**: adding a single `cache_control` marker lets the cache point advance automatically as the conversation grows. No manual breakpoint management needed. Can be combined with block-level cache control.

### Placement

```python
message = client.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    system=[
        {"type": "text", "text": "You are a helpful assistant."},
        {
            "type": "text",
            "text": "<large document>",
            "cache_control": {"type": "ephemeral"},
        },
    ],
    messages=[{"role": "user", "content": "Question about this document..."}],
)
```

- **TTL**: default 5 minutes / extended 1 hour (**GA as of 2025-08-13, no header required**; the legacy beta header `extended-cache-ttl-2025-04-11` has been removed)
- **Minimum cacheable length — not monotonic across generations**, so check per model: **512 tokens** for Opus 5 / Fable 5 / Mythos 5; **1,024** for Opus 4.8 / Sonnet 5 / Sonnet 4.6 / Sonnet 4.5; **2,048** for Opus 4.7; **4,096** for Opus 4.6 / Opus 4.5 / Haiku 4.5. Prefixes shorter than this are silently not cached even if a breakpoint is set (`cache_creation_input_tokens: 0` with no error). Opus 5 halving the Opus 4.8 minimum means prompts previously written off as uncacheable now create entries with no code change
- **Breakpoint limit**: maximum 4 per request
- **Invalidation**: any change to content before a breakpoint invalidates the cache from that point onward
- **Eligible blocks**: text, images, and PDFs in `system` / `messages.content`, and tool definitions

### Expected impact

At an 80% cache hit rate, effective throughput increases roughly 5x (equivalent to going from 2M ITPM to 10M ITPM). Latency also improves by 15–20%. This is an essential optimization for agents and RAG systems that use long system prompts.

## Tool Use

```python
tools = [
    {
        "name": "search",
        "description": "Search the web.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    }
]
```

### Call loop

1. User message → model returns a `tool_use` block with `stop_reason: "tool_use"`
2. Read `tool_use.id` and `input`, and execute the tool
3. Add `{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "<id>", "content": "<result>"}]}` to the next request
4. Repeat until `stop_reason` becomes `end_turn`

### `tool_choice`

| Value | Behavior |
|---|---|
| `"auto"` (default) | Model decides whether to use a tool |
| `"any"` | Model must call some tool |
| `{"type": "tool", "name": "<name>"}` | Forces a specific tool |

### Pitfalls

- If `tool_result`'s `tool_use_id` doesn't match exactly, a 400 error is returned
- Older models counted cached tokens toward ITPM as well — check the pricing table footnotes
- Ignoring `stop_reason: "tool_use"` and cutting off the response causes infinite loops and broken behavior

## Extended / Adaptive Thinking

From Opus 4.6 onward, **adaptive thinking** is recommended. On Opus 5 / Opus 4.8 / 4.7 / Fable 5 / Sonnet 5, passing `thinking: {type: "enabled", budget_tokens: N}` returns a **400 error** (rejected, not merely deprecated) — only adaptive is supported.

**Whether adaptive is ON by default differs by model, and this is the most common migration trap:**

| Model | `thinking` omitted | `{type: "disabled"}` |
|---|---|---|
| **Opus 5** | Runs **adaptive** (thinking is on by default) | Accepted only at `effort` ≤ `high`; **400 at `xhigh`/`max`** |
| Opus 4.8 / 4.7 | Runs **without** thinking — set `{type: "adaptive"}` explicitly | Accepted |
| Sonnet 5 | Runs adaptive | Accepted |
| Fable 5 | Runs adaptive (always on) | **400** — omit the parameter instead |

Because `max_tokens` caps thinking *plus* response text, an Opus 4.8 workload that never set `thinking` and sized `max_tokens` tightly around its answer can **truncate mid-response on Opus 5**. Revisit `max_tokens` on every such route.

On Opus 5 / Opus 4.8 / 4.7 / Fable 5, setting `temperature` / `top_p` / `top_k` to a **non-default value** returns a 400 error. Omit these and steer behavior via the prompt instead.

```python
# Opus 5: thinking is on by default — this makes it explicit
message = client.messages.create(
    model="claude-opus-5",
    max_tokens=16000,
    thinking={"type": "adaptive", "display": "summarized"},
    output_config={"effort": "high"},  # low / medium / high / xhigh / max (default high)
    messages=[{"role": "user", "content": "Complex problem..."}],
)
```

The `effort` parameter replaces `budget_tokens` and is passed **under `output_config`** (not at the top level). Values are `low` / `medium` / `high` / `xhigh` / `max`. `xhigh` was added with Opus 4.7 (recommended for coding/agentic work) and is available on Opus 5 / 4.8 / 4.7, Fable 5, and Sonnet 5; Opus 4.6 and Sonnet 4.6 have `max` but not `xhigh` (not available on Haiku 4.5). Default is `high` (equivalent to omitting it). On Opus 5, start at `xhigh` for coding/agentic work and `high` elsewhere, **then sweep downward** — `low` and `medium` are unusually strong on this model, so effort defaults carried over from a prior model are rarely right.

**Task budgets (beta, Opus 5 / Fable 5 / Sonnet 5 / Opus 4.8 / 4.7)**: communicates an approximate total token target to the model for the entire agentic loop (thinking + tool calls + tool results + final output). While `max_tokens` is a hard cap, `task_budget` is an advisory target the model is aware of. Attach the beta header `task-budgets-2026-03-13` and specify e.g. `output_config={"effort": "high", "task_budget": {"type": "tokens", "total": 128000}}` (minimum 20k).

Opus 4.7 changes **the default for `thinking.display` to `"omitted"`** (Opus 4.6 defaulted to `"summarized"`). To display thinking content during streaming, explicitly set `"display": "summarized"`.

- **Use cases**: multi-step reasoning, math, debugging, deep analysis
- **Cost**: thinking tokens are priced at roughly 3x the standard input rate
- **Combinable with caching**: thinking is independent of caching. You can cache a fixed system prompt while still using thinking on new queries
- **`thinking.display: "omitted"`** (2026-03-16): omits thinking content from the response to speed it up (the `signature` is retained). **This is the default on Opus 4.7.** Opus 4.6 defaulted to `"summarized"`

## Message Batches API

Asynchronous batch processing. **50% discount** plus a 24-hour SLA (official docs note it **often completes in under an hour**). Limit of 100,000 requests per batch.

```python
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": "req-1",
            "params": {
                "model": "claude-opus-5",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": "..."}],
            },
        },
    ],
)
```

Retrieve results by polling `client.messages.batches.retrieve(batch.id)`, or via webhook. Result order is not guaranteed, so match results using `custom_id`. Ideal for overnight evaluations, log summarization, and bulk generation.

## Rate limits

### Response headers

| Header | Meaning |
|---|---|
| `anthropic-ratelimit-requests-remaining` | Remaining requests in the current window |
| `anthropic-ratelimit-input-tokens-remaining` | Remaining uncached input tokens (cache hits don't consume this) |
| `anthropic-ratelimit-output-tokens-remaining` | Remaining output tokens |
| `retry-after` | Seconds to wait on a 429 |

### Handling

- On 429 → honor `retry-after` plus exponential backoff (1s, 2s, 4s, ...)
- Under ITPM pressure → increase your cache hit rate (check hit rate on the Usage page; target 60%+)
- **Usage tiers were consolidated on 2026-06-26** into **Start / Build / Scale** (plus a Custom tier by contract). The old numbered Tier 1–4 scheme no longer exists, and Sonnet / Haiku limits now match Opus at every tier. Brand-new organizations may start in an **Evaluation tier** with lower limits until usage history is established
- Per-tier limits for Opus 5 / Sonnet 5 / Haiku 4.5 — **Start**: 1,000 RPM / 2M ITPM / 400K OTPM; **Build**: 5,000 RPM / 5M ITPM / 1M OTPM; **Scale**: 10,000 RPM / 10M ITPM / 2M OTPM. Fable 5 is metered lower (Start: 1,000 RPM / 500K ITPM / 100K OTPM). Organizations are promoted automatically based on usage history
- Monthly spend caps by tier: Start $500 / Build $1,000 / Scale $200,000

## Files API (beta)

```python
file = client.beta.files.upload(
    file=("doc.pdf", open("doc.pdf", "rb")),
)

message = client.beta.messages.create(
    model="claude-opus-5",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "document", "source": {"type": "file", "file_id": file.id}},
            {"type": "text", "text": "Summarize this"},
        ],
    }],
)
```

Requires the beta header `files-api-2025-04-14`. Responses include `citation` blocks that map snippets in the answer to coordinates within the file (useful for research and legal use cases).

## Error codes

| Code | type | Operational response |
|---|---|---|
| 400 | `invalid_request_error` | Fix the payload (not retryable) |
| 401 | `authentication_error` | Check the API key |
| 402 | `billing_error` | Check payment status in the Console billing tab |
| 403 | `permission_error` | The API key lacks permission for the target resource |
| 404 | `not_found_error` | Resource does not exist |
| 413 | `request_too_large` | Request exceeds size limit (Messages 32MB / Batch 256MB / Files 500MB) |
| 429 | `rate_limit_error` | `retry-after` plus backoff. If persistent, request a tier upgrade |
| 500 | `api_error` | Transient failure. Retry with exponential backoff |
| 504 | `timeout_error` | Exceeded 10 minutes. Switch to streaming or the Batch API |
| 529 | `overloaded_error` | Temporary overload. Back off (rare) |

All errors return JSON with `error.type` / `error.message` / `request_id`. `request_id` is required when contacting support.

## Cost optimization checklist

1. **Prompt caching** — always cache system prompts, fixed documents, and tool definitions (90% reduction)
2. **Message Batches API** — route non-real-time workloads through batch (50% discount)
3. **Model selection** — don't use Opus for tasks Haiku can handle. Default to Sonnet, reach for Opus only when needed
4. **Effort level** — on Fable 5 / Opus 5 / Opus 4.8 / 4.7 / Sonnet 5, `thinking.budget_tokens` is rejected with a 400; tune `output_config.effort` (`low`–`max`) instead. It remains functional but deprecated on Opus 4.6 / Sonnet 4.6, and is still the only thinking control on Haiku 4.5
5. **Trim system prompts** — they're repeated on every request. Move static portions into cache and remove them from the inline system prompt

Also: monitor cache hit rate on the Usage page. Target 60%+ in production.
