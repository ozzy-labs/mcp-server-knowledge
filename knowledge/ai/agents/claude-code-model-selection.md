---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial]
aliases: [model-selection, fallbackModel, opusplan, oauth-usage, fast-mode, ultracode]
---

# Claude Code model selection, switching, fallback, and usage monitoring

This covers "which model, at which unit of granularity, and how to switch it" in Claude Code, **fallback** when the specified model is unavailable, and observing **usage (plan quota)**. See [`claude-code.md`](claude-code.md) for general CLI specs, and [`../platform/anthropic-api.md`](../platform/anthropic-api.md) for API-side (SDK implementation) model specs such as Fable 5.

## Units of model selection

Models can be specified at the following **four units**. **There is no automatic selection based on task content** (this is still a feature request). All units are manual or preconfigured, and lower units override higher ones.

| Unit | How to specify | Kind |
|---|---|---|
| **session / main loop** | `/model <alias\|name>`, `claude --model`, `ANTHROPIC_MODEL`, `model` in settings.json | Manual (priority order: `/model` > `--model` > env > settings) |
| **skill / command** | `model:` (+ `effort:`) in `SKILL.md` (and custom command) frontmatter | Preconfigured — applies **only while that skill/command is active** |
| **subagent** | `model:` in `.claude/agents/*.md` frontmatter / `model` param of the Agent tool / `CLAUDE_CODE_SUBAGENT_MODEL` env | Preconfigured (env takes priority over frontmatter/param; resolves normally with `inherit`) |
| **Workflow stage** | `model` (+ `effort`) per `agent()` call in Dynamic Workflows | Deterministic — the finest-grained unit, per stage |

- `/model` switches immediately mid-session. From v2.1.153 onward, the selection is saved to the user settings `model` and becomes the default (choosing `s` in the picker keeps it session-only).
- `--model` / `ANTHROPIC_MODEL` apply only to the session they started. If you want different models running simultaneously in different terminals, use each launch's `--model` rather than `/model`.
- `CLAUDE_CODE_SUBAGENT_MODEL` **applies to all subagents and overrides both the per-invocation `model` parameter and subagent frontmatter** (use `inherit` to fall back to normal model resolution).
- **There is no `fallback`-equivalent key for skill / subagent** (`model:` can be specified, but not a fallback destination). Fallback is only available at the session-level settings described below.

### `/model` aliases

| Alias | Behavior |
|---|---|
| `default` | Clears the override and reverts to the account type's recommended model (or org default). Not itself an alias to a fixed model |
| `best` | Fable 5 if the org has access, otherwise the latest Opus |
| `fable` | Claude Fable 5, for the hardest, longest-running tasks |
| `sonnet` / `opus` / `haiku` | Latest of each tier (on the Anthropic API, `opus` → **Opus 5**, `sonnet` → Sonnet 5) |
| `opus[1m]` | 1 million token context |
| `sonnet[1m]` | 1M context — **no effect when `sonnet` already resolves to Sonnet 5** (native 1M window); behind an LLM gateway it selects the 1M window for Sonnet 5 |
| `opusplan` | **Automatically switches to Opus for plan mode and Sonnet for execution mode** (`opusplan[1m]` gives 1M for both phases) |

**`default` by account type**: Max / Team Premium / Enterprise pay-as-you-go / Anthropic API → **Opus 5**, Claude Platform on AWS / Amazon Bedrock / Google Cloud's Agent Platform → **Opus 5**, Pro / Team Standard / Enterprise subscription seats → Sonnet 5, Microsoft Foundry → Sonnet 4.5. **Fable 5 is never the default for any account type** (explicit selection via `/model fable` etc. is required).

> **Opus 5 requires Claude Code v2.1.219+** (Sonnet 5 needs v2.1.197+, Opus 4.8 needs v2.1.154+, Fable 5 needs v2.1.170+). Before v2.1.219 `default` and `opus` resolved to Opus 4.8 on the Anthropic API / Max / Team Premium / Enterprise pay-as-you-go, and (from v2.1.207) on Claude Platform on AWS / Bedrock / Google Cloud's Agent Platform.
>
> On third-party providers the family aliases resolve to a fixed version: on the Anthropic API `opus` → Opus 5 / `sonnet` → Sonnet 5; on Claude Platform on AWS `opus` → Opus 5 / `sonnet` → Sonnet 4.6; on Amazon Bedrock and Google Cloud's Agent Platform `opus` → Opus 5 / `sonnet` → Sonnet 4.5; on Microsoft Foundry `opus` → Opus 4.6 / `sonnet` → Sonnet 4.5. Where an alias resolves to an older version, pin the full model name (e.g. `claude-opus-5`) or set `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL`.

### Org-level constraints on selection (Enterprise / managed settings)

Two mechanisms sit above the four units and can override or clamp them:

- **Organization default model** (Claude Enterprise, v2.1.196+): admins set the Default option per organization or per custom role; the picker labels it `Org default`. It is a starting point, not a restriction — any explicit selection wins — unless the admin enables *override user selection*, in which case a `/model` choice applies to the current session only and the org default returns on the next launch (`--model`, `ANTHROPIC_MODEL`, managed settings, and `--settings` still win). Not delivered to LLM-gateway / Bedrock / Google Cloud / Foundry / Claude Platform on AWS sessions — use the `model` key in managed settings there.
- **`availableModels` allowlist** (managed settings): restricts the picker. From v2.1.205 a family alias resolves to the **newest permitted version of its family** rather than being rejected outright. `availableModels` alone never constrains the Default option — add `enforceAvailableModels` for that. The `ANTHROPIC_DEFAULT_*_MODEL` variables cannot redirect an allowed alias to a model outside the list (v2.1.176+).
- **Organization effort limits** (Claude Enterprise, v2.1.195+): a maximum effort level **per model, per custom role**. Levels above the cap are hidden from `/effort`, and naming a higher level runs at the cap (with a warning in interactive and plain-text `--print` runs, silently under `json` / `stream-json` / background agents).

### `effort` (reasoning depth) is specified at the same units

`effort` (`low`/`medium`/`high`/`xhigh`/`max`) can be specified via `effort:` in skill / subagent frontmatter just like model, overriding the session value only while that skill/subagent is active (the `CLAUDE_CODE_EFFORT_LEVEL` env var takes highest priority).

| Model | Levels |
|---|---|
| Fable 5 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 5, Sonnet 5, Opus 4.8, Opus 4.7 | `low`, `medium`, `high`, `xhigh`, `max` |
| Opus 4.6, Sonnet 4.6 | `low`, `medium`, `high`, `max` (no `xhigh`) |

- Setting a level the active model does not support **falls back to the highest supported level at or below it** (`xhigh` runs as `high` on Opus 4.6) rather than erroring.
- Default effort is **`high` on every model that supports effort, except Opus 4.7 (`xhigh`)**.
- **Model-default hold**: the first time you run Fable 5 / Opus 4.8 / Opus 4.7, that model's default effort is applied even if you previously chose another level, and it holds across sessions until you make an explicit choice (`/effort` interactively, or `--effort` at launch). **Opus 5 has no such hold** — a previously set level carries over.
- `max` is session-only (except via `CLAUDE_CODE_EFFORT_LEVEL`); `low`/`medium`/`high`/`xhigh` persist. In non-interactive (`-p`) mode `/effort` applies to that session only and cannot release the hold — pass `--effort` at launch instead.
- Fable 5, Sonnet 5, and Opus 4.7+ always use adaptive reasoning (`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` and fixed thinking budgets do not apply), and **Fable 5 cannot have thinking turned off**.

The `/effort` menu additionally offers **`ultracode`** — a Claude Code-only setting (not one of the API effort levels above) that sends `xhigh` to the model *and* has Claude orchestrate [Dynamic Workflows](claude-code-dynamic-workflows.md) for substantive tasks. It is **session-only** and is **not** accepted by the persisted `effortLevel` setting or `CLAUDE_CODE_EFFORT_LEVEL` (if that env var is set to anything other than `xhigh`, requests run at that level and workflow orchestration stays inactive). Turn it on via `/effort ultracode`, `claude --effort ultracode`, or `"ultracode": true` in `--settings` / an Agent SDK `applyFlagSettings()` request — the flag and SDK forms require **v2.1.203+** (earlier versions print `Unknown --effort value 'ultracode'`). When workflows are turned off, `ultracode` degrades to plain `xhigh`. (The `ultrathink` keyword anywhere in a prompt requests deeper reasoning for that one turn without changing the session effort level; `think` / `think hard` / `think more` are **not** recognized keywords.)

### Fast mode (`/fast`) — speeds up output without changing the model

`/fast` toggles **Fast mode**. This is neither a model switch like `opusplan` nor an effort change — it's a **separate axis that raises output token throughput for the same model (up to roughly 2.5x, at a premium price)**. It never downgrades to a lower-tier model.

- Supported **only on Opus 5 and Opus 4.8**, both priced flat across the full 1M window at **$10 / $50** per MTok. **Opus 5 is the fast-mode default from v2.1.219** (Opus 4.8 on v2.1.154–v2.1.218, Opus 4.7 on v2.1.142–v2.1.153).
- **Fast mode on Opus 4.7 was deprecated 2026-06-25 and removed 2026-07-24** (`/fast` applies to Opus 5 and Opus 4.8 from v2.1.219). From **v2.1.221** Claude Code treats Opus 4.7 like any other model without fast-mode support: switching to it **turns fast mode off**. Before v2.1.221 the toggle stayed on and the API rejected the resulting requests instead of serving them at standard speed. (Opus 4.7 itself remains available at standard speed.)
- Turn it on with `/fast` + Tab or `"fastMode": true` in settings. **Not supported in the VS Code extension.** In non-interactive (`-p`) mode `/fast` works only in a session launched with fast mode in its `--settings` value (e.g. `claude -p --settings '{"fastMode": true}'`), applies to that session only, and is not saved as the default. By default the preference persists across sessions; `"fastModePerSessionOptIn": true` makes every session start with it off, and `CLAUDE_CODE_DISABLE_FAST_MODE=1` disables it entirely. From v2.1.208, switching back to a supported Opus model re-enables it from the saved preference — but **not** when the saved preference is off, and **not** under per-session opt-in (run `/fast` there); from v2.1.218 every model switch that flips fast mode shows a `Fast mode ON/OFF` confirmation, including switches made via `/config model=<model>` or Remote Control.
- **Hitting the fast-mode rate limit falls back to standard speed** (the `↯` icon greys out) and re-enables automatically when the cooldown expires. All supported Opus models share one fast-mode rate-limit pool, separate from standard Opus.
- **Running out of usage credits mid-session is a separate path with no cooldown.** Claude Code retries each rejected fast-mode request at standard speed and pricing, so work continues. In an interactive session it shows `Fast mode disabled · usage credits exhausted` and turns fast mode off for the rest of the session (the saved preference is unchanged — `/fast` turns it back on). Under `--output-format stream-json` and through the Agent SDK the same text arrives on the message stream as a `system` message with subtype `notification`, once per turn, and fast mode stays on (v2.1.221+; before that it failed silently).
- Fast mode is a **research preview on first-party surfaces only**: the Anthropic API / Console and Claude subscription plans (Pro / Max / Team / Enterprise), where it is billed from **usage credits** rather than the plan's included usage (an org Owner must enable it for Team / Enterprise). It is unavailable on Claude Platform on AWS / Amazon Bedrock / Google Cloud's Agent Platform / Microsoft Foundry, the Batch API, or Priority Tier. Requires Claude Code v2.1.36+.
- From v2.1.176 onward it is subject to constraints from `availableModels`. Behind an LLM gateway the org-availability check still goes directly to `api.anthropic.com` and does **not** follow `ANTHROPIC_BASE_URL` — a blocked or credential-rejected check reports "Fast mode unavailable due to network connectivity issues"; use `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS=1` (refused/rejected) or `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK=1` (intercepted, or `ANTHROPIC_AUTH_TOKEN`-only sessions) to restore it.
- On the API side it's implemented via the beta header `fast-mode-2026-02-01` plus top-level `speed:"fast"` (`client.beta.messages`).

## Fallback (when the specified model is unavailable)

There are **two distinct systems** with different characteristics — don't conflate them.

### 1. Fallback model chains (availability-based)

Automatically switches to the next model when the primary model is **overloaded / unavailable / hits a non-retryable server error**.

- **Conditions that do NOT trigger it (important)**: **authentication / billing / rate-limit / request-size / transport errors do not trigger a switch** (normal retry/error handling applies instead). → **Hitting the plan's usage cap (including weekly quotas) falls under rate-limit, so this chain does NOT auto-fallback in that case.**
- Configuration: `--fallback-model sonnet,haiku` (comma-separated) or an array in settings. **Maximum 3 models** (after dedup; anything beyond that is ignored). The switch applies **only for that turn** — the next message tries the primary again. `"default"` expands to the default model.

```json
{
  "fallbackModel": ["claude-sonnet-5", "claude-haiku-4-5"]
}
```

### 2. Automatic model fallback (safety-classifier-based)

**Fable 5 *and* Opus 5** run cybersecurity and biology safety classifiers. When a classifier flags a request, Claude Code re-runs it on the fallback model for that **category** and shows a notice in the transcript — routing is per-category as of **v2.1.219** (before that, every flagged Fable 5 request re-ran on the provider's default Opus, and Opus 5 was not a fallback source):

| Flagged on | Biology | Cybersecurity |
|---|---|---|
| **Fable 5** | → Opus 5 | → Opus 4.8 |
| **Opus 5** | **refusal** (Opus 5 runs its own biology classifiers, no fallback model) | → Opus 4.8 |

On Bedrock / Google Cloud's Agent Platform / Foundry, set `ANTHROPIC_DEFAULT_FABLE_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` so Claude Code can identify both ends of the switch. Fable 5 is recognized when the model ID contains `claude-fable-5`, matches `ANTHROPIC_DEFAULT_FABLE_MODEL`, or is mapped with `modelOverrides`; Opus 5 by its provider model ID or a `modelOverrides` mapping.

- **Can trigger even on the session's very first request** (since it carries CLAUDE.md, git status, and workspace context). Repositories touching security/biology can trip this from context alone. Use `claude --safe-mode` to disable customizations and isolate the cause.
- Turning off "switch models when a message is flagged" in `/config` prevents the automatic switch when flagged, instead letting you choose between switching or editing the prompt and retrying. In non-interactive / SDK use, this ends the turn with a refusal. **Where the flagged category has no fallback model (biology on Opus 5), no prompt is shown and the request simply ends with the refusal.**
- **Offensive security (pentest / CTF) and biology-adjacent code trip this frequently** (this is expected behavior for these domains, not an account-level flag). → **Using Fable — or now Opus 5 — for credential/security work leads to frequent refusals or downgrades. Opus 4.8 is the safe landing spot for that work.**

> In short: "specify a next choice and auto-switch" is handled by **`fallbackModel` (availability)**, while a safety-classifier flag on Fable 5 / Opus 5 is a **separate, category-routed system that auto-downgrades**. **Individual fallback cannot be specified per skill / subagent / Workflow stage** (if a Workflow needs model-specific fallback, you must try/catch within the script and retry with a different model).

## Observing usage (plan quota)

### In-session: `/usage`

On a Pro / Max / Team / Enterprise plan, `/usage` shows plan usage bars plus a **breakdown of what is driving them**: recent usage attributed to skills, subagents, plugins, and individual MCP servers (each as a percentage of the total), and **behavior flags** for causes such as long context or cache misses, raised when one accounts for 10% or more of recent usage. Press `d` / `w` to toggle between the last 24 hours and the last 7 days. The figures are approximate and computed from **local session history on this machine**, so usage from other devices or claude.ai is not included. (An MCP server's share counts only the requests that actually consumed one of its tool results — before v2.1.222 every request after the first call to a server was attributed to it.) When the usage endpoint is rate-limited, `/usage` falls back to the last bars loaded on this machine within the past 60 minutes with a `Showing last-known usage` note; press `r` to retry.

`/usage-credits` manages usage beyond the plan allowance — on Pro / Max it opens **Settings > Usage** on claude.ai; on Team / Enterprise without billing access it sends a request to the org's admins. It requires a claude.ai login via `/login` and is unavailable with API-key authentication.

### Raw: the OAuth usage endpoint

Subscription (Pro / Max / Team / Enterprise) **usage caps** can be observed via an undocumented but real OAuth endpoint (the data source for Claude Code's `/usage` command and the statusline's `rate_limits`).

```bash
# Read-only GET only, token never displayed
TOKEN=$(jq -r .claudeAiOauth.accessToken ~/.claude/.credentials.json)  # macOS uses keychain
curl -s https://api.anthropic.com/api/oauth/usage \
  -H "Authorization: Bearer $TOKEN" -H "anthropic-beta: oauth-2025-04-20" | jq .
```

Response highlights: `five_hour` / `seven_day` each have `utilization` (percent consumed) and `resets_at` (ISO 8601), plus a **`limits[]` array with a per-quota breakdown** (each entry's consumption is the `percent` field — this is the same "percent consumed" as the top-level window's `utilization`, just a different field name). `kind` is `session` (5-hour) / `weekly_all` (overall weekly quota — usually the rate-limiting one with `is_active:true`) / **`weekly_scoped` (per-model quota, with the target model name in `scope.model.display_name`)**.

```jsonc
{
  "five_hour": { "utilization": 18.0, "resets_at": "..." },
  "seven_day": { "utilization": 41.0, "resets_at": "..." },
  "limits": [
    { "kind": "session",       "percent": 18, "is_active": false },
    { "kind": "weekly_all",    "percent": 41, "is_active": true  },
    { "kind": "weekly_scoped", "percent": 19, "is_active": false,
      "scope": { "model": { "display_name": "Fable" } } }   // ← Fable-specific weekly quota
  ]
}
```

- **Fable 5 has its own dedicated weekly quota (`weekly_scoped`)** (observed on the Max plan in 2026-07; `seven_day_opus`/`_sonnet` are null, but Fable alone returned a scoped entry). **Opus also has a model-scoped limit**, now visible in Claude Code's own error text: `You've hit your Opus limit · resets <time>`, distinct from the shared `session` / `weekly` messages. Inspect `limits[]` on your own account to see which scoped entries you actually get.
- **Exhausting a limit blocks further requests until the reset time, and there is no auto-fallback** — consistent with `fallbackModel` not triggering on rate-limit / usage-cap conditions. The two kinds differ in what recovery is available:
  - **Session (5-hour) and weekly limits are shared across all models**, so switching models with `/model` does *not* restore access.
  - **A model-scoped limit (e.g. Opus) applies only to that model's requests**, so switching to another model with `/model` keeps you working — but Claude Code never switches for you.
  → Monitor the `weekly_scoped` percentage (or `/usage`) and switch down manually before exhaustion; `/usage-credits` buys usage beyond the allowance on Pro / Max, or requests it from an admin on Team / Enterprise.

## Practical pattern: allocating higher-tier model quota

Higher-tier models like Fable 5 have **higher token cost (roughly 2x Opus) and a separate dedicated weekly quota**, so treat them as a scarce resource to allocate.

- **Reserve higher-tier models for hard tasks that are "spec-settled, long-running, and non-security"**. Use Sonnet / Haiku for routine or mechanical work.
- **The right unit for "only the hard stages get the higher tier" is the Workflow stage (per-stage `model` in `agent()`) or delegation to an upper-tier-pinned subagent**. Setting an entire skill/session to the higher-tier model burns quota even on mechanical stages.
- Credential / security-adjacent work should stay on **Opus 4.8**, the terminal fallback for cyber-flagged requests. Both Fable 5 and Opus 5 run safety classifiers that frequently cause refusals/downgrades there.
- As a safeguard, setting `fallbackModel:[opus,sonnet]` at the session level provides automatic evacuation only during overload (**it does not cover weekly quota exhaustion**, which must be handled via usage monitoring plus manual switching).

## Related

- Per-stage model specification in Dynamic Workflows: [`claude-code-dynamic-workflows.md`](claude-code-dynamic-workflows.md)
- Fable 5's API behavior (thinking always on, refusal, data retention requirements, prompt adjustments): [`../platform/anthropic-api.md`](../platform/anthropic-api.md)

Official:

- [Model configuration](https://code.claude.com/docs/en/model-config) (aliases / default by account type / org default model / `availableModels` / fallback model chains / category-based automatic model fallback / effort / org effort limits / ultracode)
- [Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode) (Opus 5 + Opus 4.8 only, Opus 4.7 removed 2026-07-24, pricing, usage-credit billing, `fastModePerSessionOptIn`, gateway org-check env vars, `fast-mode-2026-02-01` + `speed:"fast"`)
- [Subagents](https://code.claude.com/docs/en/sub-agents) / [Skills](https://code.claude.com/docs/en/skills) (frontmatter `model` / `effort`)
- [Manage costs](https://code.claude.com/docs/en/costs) (usage)
- [Introducing Claude Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
