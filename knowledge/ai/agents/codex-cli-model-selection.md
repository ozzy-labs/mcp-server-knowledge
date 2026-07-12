---
reviewed: 2026-07-12
tags: [ai-agent, ai-workflow, commercial]
aliases: [codex-model, model_reasoning_effort, gpt-5.6, gpt-5.5, codex-usage, codex-model-fallback]
---

# Codex CLI Model Selection, Reasoning Effort, Fallback, and Usage Management

This article covers Codex CLI's model selection ("which model, at which scope, how to switch"), reasoning effort (depth of reasoning) settings, whether a **fallback** exists when a model is unavailable, and observing **usage** (ChatGPT plan quota / API metered billing). For the CLI's general specification, see [`codex-cli.md`](codex-cli.md); for Claude Code's equivalent mechanism (for comparison), see [`claude-code-model-selection.md`](claude-code-model-selection.md).

> The model lineup in this article reflects **rust-v0.144.1 (2026-07-09)**. Check the `/model` picker or the official [Models](https://developers.openai.com/codex/models) page for the latest.

## Scopes for Model Selection

Model and reasoning effort can be specified at the following **scopes**, and **as with Claude Code, there is no automatic selection based on task content** (everything is manual or pre-configured). Lower entries (closer to launch/runtime) take precedence.

| Scope | How to specify | Type |
|---|---|---|
| **CLI flag (one-off)** | `codex -m <model>` / `--model`, `-c model_reasoning_effort="high"` (`--config`) | Manual, applies only to that invocation, **highest priority** |
| **`/model` (in-session)** | Switch model + adjust reasoning level via the TUI `/model` command | Manual, applies only to that session |
| **profile** | Select `[profiles.<name>]` (or `$CODEX_HOME/<name>.config.toml`) via `--profile` / `-p` | Pre-configured, overrides per profile |
| **project config** | `model` / `model_reasoning_effort` in the repo's `.codex/config.toml` | Pre-configured, per project |
| **user config** | `model` / `model_reasoning_effort` in `~/.codex/config.toml` (`$CODEX_HOME`) | Pre-configured, global default |
| **subagent** | `model` / `model_reasoning_effort` in the agent file frontmatter under `~/.codex/agents/` (personal) / `.codex/agents/` (project) | Pre-configured; **inherits the parent session if omitted** |

**Priority (highest → lowest)**: CLI `-c` / `--model` → profile (`--profile`) → project `.codex/config.toml` → user `~/.codex/config.toml` → built-in default. A subagent uses the value in its own frontmatter if present; otherwise it inherits the parent session's model / effort.

```toml
# ~/.codex/config.toml
model = "gpt-5.6-sol"
model_reasoning_effort = "medium"   # minimal / low / medium / high / xhigh

[profiles.fast]
model = "gpt-5.4-mini"
model_reasoning_effort = "low"
```

```bash
codex -m gpt-5.4 -c model_reasoning_effort="high" "..."   # one-off override
codex --profile fast                                        # select a profile
```

## Current Models

The **GPT-5.6 family** became generally available across ChatGPT / Codex / the OpenAI API on **2026-07-09**, and `gpt-5.6-sol` replaced `gpt-5.5` as the recommended default. Recommended models selectable via the `/model` picker (all available via both ChatGPT sign-in and OpenAI API key, except `gpt-5.3-codex-spark`):

| Model | Positioning | Notes |
|---|---|---|
| `gpt-5.6-sol` | **Current recommended default** | Flagship GPT-5.6 model, strongest for complex coding, computer use, research, and cybersecurity. Official guidance: "If you are unsure, start with Sol" (the Power setting = `gpt-5.6-sol` + `medium` reasoning) |
| `gpt-5.6-terra` | Balanced | Everyday work; performance competitive with `gpt-5.5` at a lower cost |
| `gpt-5.6-luna` | Fast and affordable | Strong capability at the family's lowest cost |
| `gpt-5.5` | Previous-generation frontier | The prior recommended default; still selectable as a legacy option |
| `gpt-5.4` / `gpt-5.4-mini` | Flagship / lightweight | `gpt-5.4-mini` stays the responsiveness-focused choice **recommended for subagents** |
| `gpt-5.3-codex-spark` | Research preview | Near-real-time iterative coding, text-only. **ChatGPT Pro only** |

- **Default**: When no model is specified, each surface (CLI / IDE / Cloud) picks its recommended model (currently `gpt-5.6-sol`) — a static default, not runtime automatic failover (see below).
- **Deprecated**: `gpt-5.3-codex` and `gpt-5.2` were **deprecated as user-selectable models in Codex under ChatGPT sign-in on 2026-05-26** (separate from using legacy model IDs via API key). Migrate to a current GPT-5.6 model.

## Reasoning Effort (`model_reasoning_effort`)

Reasoning depth is specified as `model_reasoning_effort` via config, CLI, or subagent frontmatter.

- **Config values**: `minimal` / `low` / `medium` / `high` / `xhigh`. The official sample config uses `medium` as an example (the reference does not explicitly declare a "default value").
- **`/model` picker for GPT-5.6** exposes six levels — **Low / Medium (default) / High / Extra High / Max / Ultra**. `max` gained first-class support in Codex CLI **rust-v0.143.0**. **`ultra` is a multi-agent mode rather than a plain effort level**: it uses subagents to handle separate parts of a complex task in parallel (watch usage — high parallelism can spike consumption).
- **Note the doc lag**: the config-reference `model_reasoning_effort` enum still lists only `minimal`–`xhigh`; `max` / `ultra` are exposed through the picker on GPT-5.6, and config-level acceptance of them is not yet reflected in the reference.
- **`xhigh` is model-dependent** (Responses API only, and only on models that support it).
- `model_reasoning_summary` (`auto` / `concise` / `detailed` / `none`) can also be used to control reasoning summary output.
- `/model` allows adjusting the reasoning level at the same time as switching models.

## Fallback — Codex Has No Automatic Fallback

**Important**: Codex has **no** documented mechanism to "automatically switch to a different model when the specified model is unavailable." There is no equivalent of Claude Code's `fallbackModel` (automatic availability-based switching).

- The statement "falls back to the recommended model when unspecified" refers to **static default selection**, not per-request automatic failover on overload / rate-limit / unavailability.
- When `gpt-5.4` is described as a "fallback," it means a **manual alternative selected via `/model`** when not choosing `gpt-5.5` / when it hasn't rolled out to the account yet. Since `gpt-5.5` rolls out in stages, "an alternative for when it's unavailable" is a matter of account availability, not automatic switching.
- Therefore, the only way to work around overload / rate-limit on a model is to **manually switch via `/model`** or use different profiles. This is the **biggest difference from Claude Code** (contrast with the two-tier fallback described in [`claude-code-model-selection.md`](claude-code-model-selection.md)).

## Usage and Rate Limits

Rate-limited models differ depending on the billing path.

| Path | Rate-limited model |
|---|---|
| **ChatGPT plan** (Free / Go / Plus / Pro / Business / Enterprise / Edu) | Rolling **5-hour** window (shared between local CLI messages and Cloud tasks) + **weekly** cap |
| **OpenAI API key** | **Metered billing** (pay only for tokens used, no fixed plan quota) |

- **`/usage`** (v0.140+): Shows the account's token usage and rate-limit status within the CLI. `/status` also shows remaining quota within a session.
- **Rate-limit reset banking** (Plus / Pro only): Unused resets are banked and usable for 30 days. As of **rust-v0.144.0**, banked reset credits show their type and expiration and let you choose which credit to redeem.
- **Model choice affects how far quota stretches**: Switching to `gpt-5.4` / `gpt-5.4-mini` can extend the local-message usage cap (depending on the model switched from). Smaller models consume the shared quota more slowly (this does not raise the total cap).

## Practical Patterns

- **Default to `gpt-5.6-sol`**. For subagents or mechanical, responsiveness-focused work, drop to `gpt-5.4-mini` to conserve the shared quota.
- **Reserve `xhigh` for hard tasks only** (supported models only). `low` / `medium` suffice for routine work.
- **Turn model switches into profiles** (e.g., `[profiles.fast]` = `gpt-5.4-mini` + `low`) so `--profile` / `/model` can be used to quickly fall back. Since there's no automatic fallback, manual fallback via profiles is effectively the substitute.
- Model downgrades never happen automatically even for credential / security-adjacent work (Codex has no behavior like Claude Fable's safety-driven automatic downgrade).

## Related

- Codex CLI core (installation, approval policy, subagents, hooks, etc.): [`codex-cli.md`](codex-cli.md)
- Claude Code's model selection, fallback, and usage (comparison): [`claude-code-model-selection.md`](claude-code-model-selection.md)

Official:

- [Models](https://developers.openai.com/codex/models) (current lineup, deprecations)
- [Config reference](https://developers.openai.com/codex/config-reference) / [Config sample](https://developers.openai.com/codex/config-sample) (`model` / `model_reasoning_effort` / profiles)
- [CLI reference](https://developers.openai.com/codex/cli) (`--model` / `-c` / `/model`)
- [Subagents](https://developers.openai.com/codex/subagents) (agent file `model` / `model_reasoning_effort`)
- [Pricing](https://developers.openai.com/codex/pricing) (ChatGPT plan quota / API metered billing / `/usage` / banking)
- [Changelog](https://developers.openai.com/codex/changelog)
