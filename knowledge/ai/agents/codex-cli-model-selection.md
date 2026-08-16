---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial]
aliases: [codex-model, model_reasoning_effort, gpt-5.6, gpt-5.5, codex-usage, codex-model-fallback, service_tier]
---

# Codex CLI Model Selection, Reasoning Effort, Fallback, and Usage Management

This article covers Codex CLI's model selection ("which model, at which scope, how to switch"), reasoning effort (depth of reasoning) settings, whether a **fallback** exists when a model is unavailable, and observing **usage** (ChatGPT plan quota / API metered billing). For the CLI's general specification, see [`codex-cli.md`](codex-cli.md); for Claude Code's equivalent mechanism (for comparison), see [`claude-code-model-selection.md`](claude-code-model-selection.md).

> The model lineup in this article reflects **rust-v0.147.0 (2026-08-07)**. Check the `/model` picker or the official [Models](https://learn.chatgpt.com/codex/models) page for the latest.
>
> **Docs moved.** Most of `developers.openai.com/codex/*` now 308-redirects to **`learn.chatgpt.com/codex/*`**, and the paths were restructured at the same time (e.g. the config reference is `learn.chatgpt.com/codex/config-file/config-reference`, not `/codex/config-reference`). Not everything landed on the new host: **plugin docs moved *within* `developers.openai.com`** instead, dropping the `/codex/` segment (`/codex/plugins/build` → `/plugins/build/plugins`). Resolve each old link individually rather than swapping the domain — old links still work via the redirect, so a stale link is not a broken one.

## Scopes for Model Selection

Model and reasoning effort can be specified at the following **scopes**, and **as with Claude Code, there is no automatic selection based on task content** (everything is manual or pre-configured). Lower entries (closer to launch/runtime) take precedence.

| Scope | How to specify | Type |
|---|---|---|
| **CLI flag (one-off)** | `codex -m <model>` / `--model`, `-c model_reasoning_effort="high"` (`--config`) | Manual, applies only to that invocation, **highest priority** |
| **`/model` (in-session)** | Switch model via the TUI `/model` command — in the CLI the picker sets **both model and reasoning effort** (there is no `/reasoning` built-in; see below) | Manual, applies only to that session |
| **profile** | Select `[profiles.<name>]` (or `$CODEX_HOME/<name>.config.toml`) via `--profile` / `-p` | Pre-configured, overrides per profile |
| **project config** | `model` / `model_reasoning_effort` in the repo's `.codex/config.toml` | Pre-configured, per project |
| **user config** | `model` / `model_reasoning_effort` in `~/.codex/config.toml` (`$CODEX_HOME`) | Pre-configured, global default |
| **subagent** | Per-agent TOML file under `~/.codex/agents/` (personal) / `.codex/agents/` (project), plus `[agents]` defaults | Pre-configured; **inherits the parent session if omitted** |

**Priority (highest → lowest)**: CLI `-c` / `--model` → profile (`--profile`) → project `.codex/config.toml` → user `~/.codex/config.toml` → built-in default.

**Subagent resolution** is its own chain: explicit spawn values → the custom agent's TOML file → `[agents]` defaults in the parent config → parent session values. Each agent file is a standalone TOML defining one agent, and requires `name`, `description`, and `developer_instructions`; it may also override model / reasoning effort. `sandbox_mode`, `mcp_servers`, and `skills.config` inherit from the parent unless the file overrides them.

```toml
# ~/.codex/config.toml
[agents]
enabled = true                                   # multi-agent tools (default true)
default_subagent_model = "gpt-5.6-terra"
default_subagent_reasoning_effort = "medium"
max_concurrent_threads_per_session = 4
```

Other `[agents]` keys: `max_threads`, `interrupt_message`, and per-agent `agents.<name>.config_file` / `agents.<name>.description`.

```toml
# ~/.codex/config.toml
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"   # minimal / low / medium / high / xhigh

[profiles.quick]                     # name it something other than "fast" —
model = "gpt-5.6-luna"               # `/fast` is the separate service-tier toggle
model_reasoning_effort = "low"
```

```bash
codex -m gpt-5.6-terra -c model_reasoning_effort="high" "..."   # one-off override
codex --profile quick                                          # select a profile
```

## Current Models

The **GPT-5.6 family** became generally available across ChatGPT / Codex / the OpenAI API on **2026-07-09**, and `gpt-5.6-sol` replaced `gpt-5.5` as the recommended default. Recommended models selectable via the `/model` picker (all available via both ChatGPT sign-in and OpenAI API key, except `gpt-5.3-codex-spark`):

| Model | Positioning | Notes |
|---|---|---|
| `gpt-5.6-sol` | **Current recommended default** | Flagship GPT-5.6 model, strongest for complex coding, computer use, research, and cybersecurity. Official guidance: "If you are unsure, start with Sol" (the Power setting = `gpt-5.6-sol` + `medium` reasoning) |
| `gpt-5.6-terra` | Balanced | Everyday work; performance competitive with `gpt-5.5` at a lower cost |
| `gpt-5.6-luna` | Fast and affordable | Strong capability at the family's lowest cost |
| `gpt-5.5` | Previous-generation frontier | The prior recommended default; still selectable as a legacy option |
| `gpt-5.4` / `gpt-5.4-mini` | **Retiring 2026-08-31** | Both retire from Codex for ChatGPT sign-in on **2026-08-31** (announced 2026-07-31); API-key auth is unaffected. Migrate now — see below |
| `gpt-5.3-codex-spark` | Research preview | Near-real-time iterative coding, text-only. **ChatGPT Pro only** |

- **Default**: When no model is specified, each surface (CLI / IDE / Cloud) picks its recommended model (currently `gpt-5.6-sol`) — a static default, not runtime automatic failover (see below). Since rust-v0.145.0, **`gpt-5.6-sol` is also the default model for Amazon Bedrock** (which gained experimental managed login, custom endpoint, and auth support in the same release).
- **Subagent recommendation shifted to the 5.6 family**: rust-v0.145.0 "migrated bundled GPT-5.4 selections and internal uses to the corresponding GPT-5.6 Terra and Luna variants." The subagents doc now recommends `gpt-5.6` for demanding multi-step work needing planning and validation, and **`gpt-5.6-terra` for speed-focused exploration, scanning, or lightweight parallel work** — the role `gpt-5.4-mini` used to fill.
- **Deprecated**: `gpt-5.3-codex` and `gpt-5.2` were **deprecated as user-selectable models in Codex under ChatGPT sign-in on 2026-05-26** (separate from using legacy model IDs via API key). Migrate to a current GPT-5.6 model.
- **Retiring next (announced 2026-07-31)**: `gpt-5.4` and `gpt-5.4-mini` **retire from Codex on 2026-08-31** for users signed in with ChatGPT. The OpenAI API and Codex authenticated with your own API key are *not* affected. Official replacements: `gpt-5.4` → **`gpt-5.6-terra`**, `gpt-5.4-mini` → **`gpt-5.6-luna`**. Sweep saved configs, profiles, custom agent TOML files, and scheduled tasks for the old IDs before the cutoff.

## Reasoning Effort (`model_reasoning_effort`)

Reasoning depth is specified as `model_reasoning_effort` via config, CLI, or a subagent's TOML file.

- **Config-reference enum**: `minimal | low | medium | high | xhigh` — "Adjust reasoning effort for supported models (Responses API only; `xhigh` is model-dependent)." No default is declared; the sample config uses `medium`.
- **Picker levels for GPT-5.6** — **Low / Medium (default) / High / Extra High / Max / Ultra**. `max` gained first-class support in **rust-v0.143.0**. **`ultra` is a multi-agent mode rather than a plain effort level**: it uses subagents to handle separate parts of a complex task in parallel. Since rust-v0.145.0 the CLI **warns when you select Ultra** that high multi-agent concurrency can increase usage quickly.
- **The doc lag persists at top level, but is resolved for subagents**: the top-level `model_reasoning_effort` enum still stops at `xhigh`, while the subagents doc documents `ultra` / `max` / `xhigh` / `high` / `medium` / `low` as valid per-agent reasoning-effort values.
- `model_reasoning_summary` (`auto` / `concise` / `detailed` / `none`) controls reasoning summary output.
- **In the CLI, effort is chosen from the `/model` picker, not a `/reasoning` command.** The TUI's built-in command list has no `/reasoning`; `/model` is described as "choose what model and reasoning effort to use", and the only commands injected dynamically next to it are service-tier ones such as `/fast`. The docs' slash-command reference does list a separate `/reasoning` ("choose the reasoning effort for the current chat") — that page covers the ChatGPT app surface, so treat it as app-only until it appears in the CLI.

## Fast Mode (`service_tier`) — Codex Now Has a Speed Axis Too

Codex gained a speed setting that is **independent of model and reasoning effort** — the direct analogue of Claude Code's `/fast`. It buys latency with credits, not intelligence.

- **1.5x faster**, supported on **GPT-5.6 / GPT-5.5 / GPT-5.4**.
- **Credit multiplier vs the Standard rate: 2.5x on GPT-5.6 / 5.5, 2x on GPT-5.4.**
- **Not available with API-key auth** — API keys bill by token price instead; the API-side analogue is Priority Processing (2x token rate on GPT-5.6, separate billing mechanics).
- Available in the ChatGPT desktop app, Codex CLI, and the IDE extension when signed in with ChatGPT.

```toml
# ~/.codex/config.toml
service_tier = "fast"   # preferred service tier for new turns; `fast` maps to the request value `priority`

[features]
fast_mode = true
```

In-session: `/fast on` / `/fast off` / `/fast status`. `codex-spark` (`gpt-5.3-codex-spark`) is a *different* lever — a lightweight model for near-instant iteration, ChatGPT Pro only during the research preview — not a speed tier applied to your current model.

## Fallback — Codex Has No Automatic Fallback

**Important**: Codex has **no** documented mechanism to "automatically switch to a different model when the specified model is unavailable." There is no equivalent of Claude Code's `fallbackModel` (automatic availability-based switching).

- The statement "falls back to the recommended model when unspecified" refers to **static default selection**, not per-request automatic failover on overload / rate-limit / unavailability.
- When an older model is described as a "fallback," it means a **manual alternative selected via `/model`** when the newer one hasn't rolled out to the account yet — a matter of account availability, not automatic switching.
- Therefore, the only way to work around overload / rate-limit on a model is to **manually switch via `/model`** or use different profiles. This remains the **biggest difference from Claude Code** (contrast with the two-tier fallback described in [`claude-code-model-selection.md`](claude-code-model-selection.md)) — and now the *only* major one, since Codex has gained its own fast-mode axis.
- **One narrow exception exists as of rust-v0.145.0**: when resuming a ChatGPT thread whose compaction references a *retired* model, Codex recovers by retrying with the currently selected model. That is a resume-path repair, not general availability failover.

## Usage and Rate Limits

Rate-limited models differ depending on the billing path.

| Path | Rate-limited model |
|---|---|
| **ChatGPT plan** (Free / Go / Plus / Pro / Business / Enterprise / Edu) | Rolling **5-hour** window (shared between local CLI messages and Cloud tasks) + **weekly** cap |
| **OpenAI API key** | **Metered billing** (pay only for tokens used, no fixed plan quota) |

The 5-hour window is **shared across ChatGPT Work and Codex**, and across local CLI messages and Cloud tasks. Published per-plan message ranges per 5 hours, which now vary by model:

| Model | Plus / Business | Pro 5x | Pro 20x |
|---|---|---|---|
| `gpt-5.6-sol` | 10–100 | 50–500 | 200–2,000 |
| `gpt-5.6-terra` | 25–200 | 125–1,000 | 500–4,000 |
| `gpt-5.6-luna` | 250–2,000 | 1,250–10,000 | 5,000–40,000 |

- **Observation surfaces**: `/status` in a session (chat ID, context usage, rate limits) and `/usage` in the CLI (v0.140+); the account-level dashboard is at **`chatgpt.com/codex/settings/usage`** — check it weekly to track pace against the weekly cap.
- **Rate-limit reset banking** (Plus / Pro): unused resets are banked and usable for 30 days. As of **rust-v0.144.0**, banked reset credits show their type and expiration and let you choose which credit to redeem.
- **Beyond the included limits**, additional credits can be purchased; Enterprise / Edu flexible pricing allows workspace credit purchases.
- **Model choice affects how far quota stretches**: smaller models (**Luna**, **Mini**) consume the shared quota more slowly. This does not raise the total cap.
- **Fast mode spends the same quota faster** — 2.5x on GPT-5.6 / 5.5, 2x on GPT-5.4 (see above). Treat it as a latency purchase, not a free toggle.

## Practical Patterns

- **Default to `gpt-5.6-sol`**. For subagents or mechanical, responsiveness-focused work, drop to `gpt-5.6-terra` (exploration, read-heavy scans) or `gpt-5.6-luna` (clear, repeatable, high-volume work) to conserve the shared quota — roughly 2.5x and 25x more messages per window than Sol. Do **not** reach for `gpt-5.4-mini`: it retires 2026-08-31.
- **Reserve `xhigh` for hard tasks only** (supported models only). `low` / `medium` suffice for routine work. Use `ultra` deliberately — it fans out to subagents and its concurrency is what spikes consumption, which is why the CLI now warns on selection.
- **Set `[agents]` defaults rather than per-agent overrides** (`default_subagent_model` / `default_subagent_reasoning_effort` / `max_concurrent_threads_per_session`) so fan-out cost is bounded in one place.
- **Turn model switches into profiles** (e.g., `[profiles.quick]` = `gpt-5.6-luna` + `low`) so `--profile` / `/model` can be used to quickly step down. Since there's no automatic fallback, manual fallback via profiles is effectively the substitute.
- **Keep `service_tier = "fast"` out of the global config** — enable it per session with `/fast on` when latency actually matters, since the credit multiplier applies to every turn while it's on.
- Model downgrades never happen automatically even for credential / security-adjacent work (Codex has no behavior like the Fable 5 / Opus 5 safety-driven automatic downgrade).

## Related

- Codex CLI core (installation, approval policy, subagents, hooks, etc.): [`codex-cli.md`](codex-cli.md)
- Claude Code's model selection, fallback, and usage (comparison): [`claude-code-model-selection.md`](claude-code-model-selection.md)

Official:

The pages below moved from `developers.openai.com/codex/*` to `learn.chatgpt.com/codex/*` (308 redirect), with restructured paths. Note that the OpenAI **API** docs (`developers.openai.com/api/docs/*`) and the **plugin** docs did not move to the new host:

- [Models](https://learn.chatgpt.com/codex/models) (current lineup, deprecations, effort levels)
- [Config reference](https://learn.chatgpt.com/codex/config-file/config-reference) / [Config sample](https://learn.chatgpt.com/codex/config-file/config-sample) (`model` / `model_reasoning_effort` / `service_tier` / `[agents]`)
- [Speed](https://learn.chatgpt.com/codex/agent-configuration/speed) (fast mode, credit multipliers, `/fast`, codex-spark)
- [CLI reference](https://learn.chatgpt.com/codex/cli) (`--model` / `-c` / `--profile`) / [Slash commands](https://learn.chatgpt.com/codex/reference/slash-commands) (`/model` / `/reasoning` / `/fast` / `/status`)
- [Subagents](https://learn.chatgpt.com/codex/agent-configuration/subagents) (agent TOML files, `[agents]` defaults, recommended models per role)
- [Pricing](https://learn.chatgpt.com/codex/pricing) (ChatGPT plan quota / per-plan message ranges / API metered billing / banking)
- [Changelog](https://learn.chatgpt.com/codex/changelog)
