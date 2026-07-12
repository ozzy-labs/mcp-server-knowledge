---
reviewed: 2026-07-12
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
| `sonnet` / `opus` / `haiku` | Latest of each tier (on the Anthropic API, `opus` → Opus 4.8, `sonnet` → Sonnet 5) |
| `sonnet[1m]` / `opus[1m]` | 1 million token context |
| `opusplan` | **Automatically switches to Opus for plan mode and Sonnet for execution mode** (`opusplan[1m]` gives 1M for both phases) |

**`default` by account type**: Max / Team Premium / Enterprise pay-as-you-go / Anthropic API → Opus 4.8, Claude Platform on AWS → Opus 4.8, Pro / Team Standard / Enterprise subscription seats → Sonnet 5, Bedrock / Vertex / Foundry → Sonnet 4.5. **Fable 5 is never the default for any account type** (explicit selection via `/model fable` etc. is required).

> On third-party providers the family aliases resolve to a fixed version: on the Anthropic API and Claude Platform on AWS `opus` → Opus 4.8 / `sonnet` → Sonnet 4.6; on Bedrock and Vertex `opus` → Opus 4.8 / `sonnet` → Sonnet 4.5; on Foundry `opus` → Opus 4.6 / `sonnet` → Sonnet 4.5. Where an alias resolves to an older version, pin the full model name or set `ANTHROPIC_DEFAULT_OPUS_MODEL` / `ANTHROPIC_DEFAULT_SONNET_MODEL`.

### `effort` (reasoning depth) is specified at the same units

`effort` (`low`/`medium`/`high`/`xhigh`/`max`) can be specified via `effort:` in skill / subagent frontmatter just like model, overriding the session value only while that skill/subagent is active (the `CLAUDE_CODE_EFFORT_LEVEL` env var takes highest priority). Default effort is `high` for Fable 5, Sonnet 5, and Opus 4.8, and `xhigh` for Opus 4.7. `max` is session-only (except via env). `xhigh` is only available for Fable 5 / Sonnet 5 / Opus 4.7-4.8 (Opus 4.6 and Sonnet 4.6 have `max` but not `xhigh`). Fable 5, Sonnet 5, and Opus 4.7+ always use adaptive reasoning, and **Fable 5 cannot have thinking turned off**.

The `/effort` menu additionally offers **`ultracode`** — a Claude Code-only setting (not one of the API effort levels above) that sends `xhigh` to the model *and* has Claude orchestrate [Dynamic Workflows](claude-code-dynamic-workflows.md) for substantive tasks. It is **session-only**, is **not** accepted by the persisted `effortLevel` setting or `CLAUDE_CODE_EFFORT_LEVEL`, and `--effort ultracode` requires **v2.1.203+** (earlier versions print `Unknown --effort value 'ultracode'`). When workflows are turned off, `ultracode` degrades to plain `xhigh`. (The `ultrathink` keyword anywhere in a prompt requests deeper reasoning for that one turn without changing the session effort level.)

### Fast mode (`/fast`) — speeds up output without changing the model

`/fast` toggles **Fast mode**. This is neither a model switch like `opusplan` nor an effort change — it's a **separate axis that raises output token throughput for the same model (up to roughly 2.5x, at a premium price)**. It never downgrades to a lower-tier model.

- Supported **only on Opus 4.8 / 4.7**, with Opus 4.8 the permanent fast-capable tier (and the fast-mode default from v2.1.154). **Fast mode on Opus 4.7 is deprecated as of 2026-06-25 and is removed on 2026-07-24**; after removal, a fast request on Opus 4.7 errors and does **not** fall back to standard 4.7 (the model itself stays available at standard speed). Pricing is flat across the full 1M window: **Opus 4.8 $10 / $50, Opus 4.7 $30 / $150** per MTok.
- Fast mode is a **research preview on first-party surfaces only**: the Anthropic API / Console and Claude subscription plans (Pro / Max / Team / Enterprise), where it is billed from **usage credits** rather than the plan's included usage (an org Owner must enable it for Team / Enterprise). It is unavailable on Claude Platform on AWS / Bedrock / Vertex / Foundry, the Batch API, or Priority Tier. Requires Claude Code v2.1.36+.
- From v2.1.176 onward it is subject to constraints from `availableModels` (the allowed-model list setting). On the API side it's implemented via the beta header `fast-mode-2026-02-01` plus top-level `speed:"fast"` (`client.beta.messages`), and Opus 4.8 / 4.7 share one fast-mode rate-limit pool separate from standard Opus.

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

### 2. Automatic model fallback (Fable 5 safety-based)

Fable 5 comes with cybersecurity and biology safety classifiers, and **re-runs flagged requests on the default Opus (Opus 4.8)**, continuing to use Opus for the rest of that session (use `/model fable` to switch back). On Bedrock / Vertex / Foundry, set `ANTHROPIC_DEFAULT_FABLE_MODEL` and `ANTHROPIC_DEFAULT_OPUS_MODEL` so Claude Code can identify both ends of the switch.

- **Can trigger even on the session's very first request** (since it carries CLAUDE.md, git status, and workspace context). Repositories touching security/biology can trip this from context alone. Use `claude --safe-mode` to disable customizations and isolate the cause.
- Turning off "switch models when a message is flagged" in `/config` prevents the automatic switch when flagged, instead letting you choose between "switch to Opus" or "edit the prompt and retry with Fable." In non-interactive / SDK use, this ends the turn with a refusal.
- **Offensive security (pentest / CTF) and biology-adjacent code trip this frequently** (this is expected behavior for these domains, not an account-level flag). → **Using Fable for credential/security work leads to frequent refusals or downgrades, and is actually disadvantageous.**

> In short: "specify a next choice and auto-switch" is handled by **`fallbackModel` (availability)**, while Fable's safety refusal is a **separate system that auto-downgrades to Opus**. **Individual fallback cannot be specified per skill / subagent / Workflow stage** (if a Workflow needs model-specific fallback, you must try/catch within the script and retry with a different model).

## Observing usage (plan quota)

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

- **Fable 5 has its own dedicated weekly quota (`weekly_scoped`)** (observed on the Max plan as of 2026-07; `seven_day_opus`/`_sonnet` are null, but Fable alone returns a scoped entry).
- **What happens when a per-model weekly quota is exhausted is not officially documented.** However, as noted above, `fallbackModel` doesn't trigger on rate-limit / usage-cap conditions, so it's safest to assume **exhausting a weekly quota does NOT auto-fallback** (it may block or error out instead). → Monitoring the `weekly_scoped` percentage and manually switching to a lower-tier model via `/model` before exhaustion is the reliable approach.

## Practical pattern: allocating higher-tier model quota

Higher-tier models like Fable 5 have **higher token cost (roughly 2x Opus) and a separate dedicated weekly quota**, so treat them as a scarce resource to allocate.

- **Reserve higher-tier models for hard tasks that are "spec-settled, long-running, and non-security"**. Use Sonnet / Haiku for routine or mechanical work.
- **The right unit for "only the hard stages get the higher tier" is the Workflow stage (per-stage `model` in `agent()`) or delegation to an upper-tier-pinned subagent**. Setting an entire skill/session to the higher-tier model burns quota even on mechanical stages.
- Credential / security-adjacent work should stay on **Opus etc.**, since Fable's safety classifier frequently causes refusals/downgrades there.
- As a safeguard, setting `fallbackModel:[opus,sonnet]` at the session level provides automatic evacuation only during overload (**it does not cover weekly quota exhaustion**, which must be handled via usage monitoring plus manual switching).

## Related

- Per-stage model specification in Dynamic Workflows: [`claude-code-dynamic-workflows.md`](claude-code-dynamic-workflows.md)
- Fable 5's API behavior (thinking always on, refusal, data retention requirements, prompt adjustments): [`../platform/anthropic-api.md`](../platform/anthropic-api.md)

Official:

- [Model configuration](https://code.claude.com/docs/en/model-config) (aliases / default by account type / fallback model chains / automatic model fallback / effort / ultracode)
- [Speed up responses with fast mode](https://code.claude.com/docs/en/fast-mode) (Opus 4.7 removal 2026-07-24, pricing, usage-credit billing, `fast-mode-2026-02-01` + `speed:"fast"`)
- [Subagents](https://code.claude.com/docs/en/sub-agents) / [Skills](https://code.claude.com/docs/en/skills) (frontmatter `model` / `effort`)
- [Manage costs](https://code.claude.com/docs/en/costs) (usage)
- [Introducing Claude Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
