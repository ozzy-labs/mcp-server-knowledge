---
reviewed: 2026-07-05
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
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
)
print(message.content[0].text)
```

## Current models (as of 2026-07)

| Model | API ID | Context | Max output | Positioning | Price (input/output per 1M) |
|---|---|---|---|---|---|
| **Fable 5** | `claude-fable-5` | 1M | 128K | The most capable widely released model. For the hardest reasoning and long-horizon agentic work. Thinking is always ON (`thinking` is omitted; explicitly setting `disabled` returns 400). Requires 30-day data retention (ZDR not available). Has a `refusal` stop reason | $10 / $50 |
| **Opus 4.8** | `claude-opus-4-8` | 1M | 128K | Current Opus-tier flagship. Complex reasoning, long-horizon agentic coding, high-autonomy tasks. Extended thinking not supported (adaptive thinking only). `effort` defaults to `high` | $5 / $25 |
| **Sonnet 5** | `claude-sonnet-5` | 1M | 128K | Current Sonnet tier. Excellent balance of speed and intelligence; near-Opus for coding/agents. Adaptive thinking is ON by default (adaptive even when `thinking` is omitted; `budget_tokens` returns 400). `effort` ranges `low`–`max` (first Sonnet tier to support `xhigh`). With the new tokenizer, the same text uses ~30% more tokens than Sonnet 4.6 | $3 / $15 (introductory price $2 / $10 through 2026-08-31) |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K | 64K | Fastest and cheapest. Near-frontier intelligence. Supports extended thinking | $1 / $5 |

Opus 4.8, released 2026-05-28, replaces Opus 4.7 as the current **Opus-tier flagship**. It shares the same $5 / $25 price, 1M context, and 128K max output as Opus 4.7, with an equivalent tool/platform feature set. Anthropic's highest-performing widely released model, however, is **Claude Fable 5** (`claude-fable-5`, $10 / $50), which sits above the Opus tier but has different API behavior (thinking always ON so the `thinking` parameter is omitted, sampling parameters like `temperature` are not allowed, and 30-day data retention is required). Opus 4.8 remains the default for coding/agentic work; choose Fable 5 only when maximum capability is required. **Mythos 5** (`claude-mythos-5`), limited to Project Glasswing, is equivalent to Fable 5. **Sonnet 5** (`claude-sonnet-5`, $3 / $15, with an introductory price of $2 / $10 through 2026-08-31) is the current Sonnet tier, replacing Sonnet 4.6. Adaptive thinking is ON by default (it runs in adaptive mode even when `thinking` is omitted; `budget_tokens` returns 400), and `effort` ranges `low`–`max` (the first time `xhigh` is available at the Sonnet tier). Due to the new tokenizer, the same text consumes about 30% more tokens than under Sonnet 4.6 (1M / 128K; sticker pricing is unchanged but effective cost will vary). Opus 4.7 / Opus 4.6 / Sonnet 4.6 are now legacy (still usable, but migration is recommended). Opus 4.8 **reduces wasted thinking tokens only when adaptive thinking is enabled**, improving long-horizon agentic coding, compaction recovery, and tool triggering relative to Opus 4.7. The 1M context window **reached GA for Opus 4.6 / Sonnet 4.6 on 2026-03-13** (no header required, standard pricing), and Opus 4.7 / 4.8 default to 1M as well. The legacy beta header `context-1m-2025-08-07` was removed for Sonnet 4.5 / Sonnet 4 on 2026-04-30 and no longer has any effect. Dateless IDs from the 4.6 generation onward (e.g. `claude-opus-4-8`) are also pinned snapshots, not evergreen pointers. **Deprecation**: Opus 4.1 (`claude-opus-4-1-20250805`) is scheduled to retire on 2026-08-05. Sonnet 4 (`claude-sonnet-4-20250514`) / Opus 4 (`claude-opus-4-20250514`) had an original retirement date of 2026-06-15, which as of today (2026-07-05) has already passed — migrate immediately to `claude-opus-4-8` / `claude-sonnet-5` if you have not already.

## Prompt caching — the single most important optimization

Placing cache breakpoints on static system prompts, documents, and tool definitions brings the **cached portion down to 10% of the input token price** on subsequent requests. It also substantially reduces ITPM rate-limit consumption.

**Automatic caching (launched 2026-02-19)**: adding a single `cache_control` marker lets the cache point advance automatically as the conversation grows. No manual breakpoint management needed. Can be combined with block-level cache control.

### Placement

```python
message = client.messages.create(
    model="claude-opus-4-8",
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
- **Minimum cacheable length**: **4,096 tokens** for Opus 4.8 / 4.7 / 4.6 / Haiku 4.5; **2,048 tokens** for Fable 5 / Sonnet 4.6; 1,024 tokens for the Sonnet 4.5 series. Prefixes shorter than this are silently not cached even if a breakpoint is set (`cache_creation_input_tokens: 0` with no error)
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

From Opus 4.6 onward, **adaptive thinking** is recommended. On Opus 4.7 / Opus 4.8, passing `thinking: {type: "enabled", budget_tokens: N}` returns a **400 error** (rejected, not merely deprecated). Opus 4.7 / 4.8 do not support extended thinking at all — only adaptive is supported. **Adaptive thinking is OFF by default.** Without explicitly setting `thinking={"type": "adaptive"}`, the model runs without thinking.

On Opus 4.7 / Opus 4.8, setting `temperature` / `top_p` / `top_k` to a **non-default value** returns a 400 error. Omit these and steer behavior via the prompt instead.

```python
# Opus 4.8: adaptive thinking + effort specification
message = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=16000,
    thinking={"type": "adaptive"},
    output_config={"effort": "medium"},  # low / medium / high / xhigh / max (Opus 4.8 defaults to high)
    messages=[{"role": "user", "content": "Complex problem..."}],
)
```

The `effort` parameter replaces `budget_tokens` and is passed **under `output_config`** (not at the top level). Values are `low` / `medium` / `high` / `xhigh` / `max`. `xhigh` was added with Opus 4.7 (recommended for coding/agentic work), and `max` is available from Opus 4.6 onward and on Sonnet 4.6 (not available on Haiku 4.5). Default is `high` (equivalent to omitting it).

**Task budgets (beta, Opus 4.7 / 4.8)**: communicates an approximate total token target to the model for the entire agentic loop (thinking + tool calls + tool results + final output). While `max_tokens` is a hard cap, `task_budget` is an advisory target the model is aware of. Attach the beta header `task-budgets-2026-03-13` and specify e.g. `output_config={"effort": "high", "task_budget": {"type": "tokens", "total": 128000}}` (minimum 20k).

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
                "model": "claude-opus-4-8",
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
- Tier 1 defaults: 50 RPM, 30K ITPM (Opus/Sonnet), 50K ITPM (Haiku). Auto-promotes with usage history

## Files API (beta)

```python
file = client.beta.files.upload(
    file=("doc.pdf", open("doc.pdf", "rb")),
)

message = client.beta.messages.create(
    model="claude-opus-4-8",
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
4. **Thinking budget** — enable only when needed. Start around 1K–5K and tune
5. **Trim system prompts** — they're repeated on every request. Move static portions into cache and remove them from the inline system prompt

Also: monitor cache hit rate on the Usage page. Target 60%+ in production.
