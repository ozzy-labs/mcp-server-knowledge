---
reviewed: 2026-06-07
tags: [ai-workflow, methodology]
---

# Scheduled Execution of AI Agents

Options and selection criteria for running AI coding agents (Claude Code / Codex etc.) recurringly. Needed for use cases like "re-verify the knowledge base weekly," "run PR review every morning," or "fix failed jobs overnight." For per-CLI specifics, see `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` and others.

## Overview of options (Claude Code)

Comparison table from the official docs ([Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)):

| Aspect | Cloud (Routines) | Desktop scheduled tasks | `/loop` |
|---|---|---|---|
| Execution location | Anthropic cloud | Your own machine | Your own machine |
| Requires machine to be on | No | Yes | Yes |
| Requires session to stay open | No | No | Yes |
| Persists across restarts | Yes | Yes | Restored via `--resume` (only if not yet expired) |
| Access to local files | No (fresh clone) | Yes | Yes |
| Minimum interval | 1 hour | 1 minute | 1 minute |
| Trigger types | schedule + API + GitHub event | schedule only | schedule only |
| Spec stability | research preview | GA | GA |

Adding **GitHub Actions' `schedule` trigger** (external CI) to this gives 4 options in the Claude Code family. In the OpenAI family, **Codex Cloud / Workspace Agents** provide equivalent functionality.

## 1. Cloud Routines (`/schedule`)

[Automate work with routines](https://code.claude.com/docs/en/routines). Runs Claude Code periodically on Anthropic's cloud VMs. Available on Pro / Max / Team / Enterprise plans (research preview).

### Capabilities

- **Combine 3 trigger types**: Scheduled (cron) / API (HTTP POST) / GitHub event (PR opened, etc.)
- Fresh clone the repository → do the work → push to a `claude/`-prefixed branch → create a PR
- Choose MCP connectors per-routine
- Fully autonomous execution (no permission prompts)

### Creation and management

`/schedule` is a **CLI slash command that manipulates cloud routines (configuration entities stored in the cloud)**. It is distinct from the identically-named local Desktop scheduled task (described below). All 3 creation surfaces write to the same claude.ai account, so changes made anywhere are immediately reflected on the other surfaces.

- Web: [claude.ai/code/routines](https://claude.ai/code/routines)
- CLI:
  - Create with natural language, e.g. `/schedule daily PR review at 9am` (only the **schedule** trigger can be created from the CLI; add API/GitHub triggers via the Web UI)
  - Manage existing routines with `/schedule list` (list) / `/schedule update` (modify, including specifying a cron expression directly) / `/schedule run` (trigger immediately)
  - If `/schedule` returns "Unknown command," this is usually caused by not being logged into a claude.ai subscription — API key auth or disabled telemetry are typical culprits (details in `ai/agents/claude-code-routines.md`)
- Desktop app: from the Routines sidebar, **New routine → Remote** (choosing **Local** creates a Desktop scheduled task instead, see below)

### Constraints

- Minimum interval is **1 hour**
- There is a **daily routine run cap** per account (check at [claude.ai/code/routines](https://claude.ai/code/routines))
- By default, pushes only to `claude/`-prefixed branches (to write to an existing branch, explicitly enable **Allow unrestricted branch pushes**)
- One-off runs don't count against the daily cap, but still consume subscription usage normally
- Subject to change (research preview)

### Billing

Official docs: > Routines draw down subscription usage the same way interactive sessions do.

Consumed from subscription usage (no API billing). If subscription usage is exceeded, it falls through to pay-as-you-go if "extra usage" is enabled.

## 2. Desktop scheduled tasks

[Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks). The local version that runs inside the Desktop app.

- Only runs while the app is running and the machine is awake (stops when the laptop is closed)
- Can access local files directly (no cloning needed)
- Minimum interval **1 minute**
- Catches up on missed runs within the last 7 days, **once only**
- Permission mode can be configured per task (Ask mode will stall waiting for approval)
- Definitions are stored at `~/.claude/scheduled-tasks/<task-name>/SKILL.md`

Useful for code you don't want to send to the cloud, dependencies that only exist locally, or as a fallback when Routines' daily cap is hit.

## 3. `/loop` (within a session)

[Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks). A lightweight scheduler that runs **only during the current session**. Requires Claude Code v2.1.72+.

```text
/loop 5m check if the deployment finished
/loop check whether CI passed and address any review comments
/loop
/loop 20m /review-pr 1234
```

| Input | Behavior |
|---|---|
| interval + prompt | Runs on a fixed cron schedule |
| prompt only | Claude dynamically decides the interval (1 minute–1 hour) per iteration |
| interval only / no arguments | Runs a built-in maintenance prompt (or reads `loop.md`) |

- Session-scoped (restored via `--continue` / `--resume`, but only within 7 days)
- **Auto-expires after 7 days**
- Maximum 50 tasks per session
- `Esc` stops a pending loop
- Override the default prompt via `.claude/loop.md` or `~/.claude/loop.md`
- Internally uses the `CronCreate` / `CronList` / `CronDelete` tools

Suited for watching a build, babysitting a PR, or short-term polling. Not suited for long-term cron use cases.

## 4. GitHub Actions `schedule` trigger

The classic method of running periodically in CI. See `platforms/github-actions.md` for details.

```yaml
on:
  schedule:
    - cron: "0 9 * * 1"   # every Monday 09:00 UTC
```

When launching an agent CLI inside an Action, Anthropic's usage policy **recommends API key authentication** (details below). A subscription's OAuth token technically works, but it is explicitly stated that CI automation falls outside "ordinary individual use."

## 5. Routines-equivalents in other CLI ecosystems

Each of the 4 major coding-agent CLIs has some "Routines equivalent" for autonomous/periodic cloud execution (often a separate product from the CLI itself). Ranked by Routines' defining traits (**cloud async × schedule/API/GitHub trigger × autonomous PR**), the products bundling all 3 trigger types into a single offering are **Claude Code Routines, Google Jules, and GitHub Copilot cloud agent** (Copilot gained native scheduling via **Automations** on 2026-06-02). **Only Codex cloud lacks native scheduling** (periodic execution is handled by a separate product / GitHub Actions instead), and API triggering isn't documented officially either.

| CLI ecosystem | Cloud autonomous product | Schedule | API/webhook trigger | GitHub event | Autonomous PR | Maturity |
|---|---|---|---|---|---|---|
| **Claude Code** | **Routines** | ✓ (min 1h) | ✓ (`/fire`) | ✓ (PR/Release) | ✓ | research preview |
| **Codex CLI** (OpenAI) | **Codex cloud** + Workspace agents + ChatGPT Scheduled Tasks | △ (via Workspace agents / ChatGPT tasks) | Unknown (not documented for Codex cloud) | ✓ (tag `@codex` on issue/PR) | ✓ | Codex cloud: available (GA/preview not specified) / Workspace agents: research preview |
| **Gemini CLI** (Google) | **Jules** (async coding agent) + Gemini CLI GitHub Action | ✓ (Daily/Weekly recurring, etc.) | ✓ (REST API `v1alpha/sessions`) | ✓ (`jules` label on issue → PR) | ✓ | alpha (experimental) |
| **GitHub Copilot CLI** | **Copilot cloud agent** (formerly coding agent) | ✓ (**Automations**: hourly/daily/weekly, GA 2026-06-02) | ✓ | ✓ (issue assign / issue・PR events) | ✓ (immediate PR if specified) | GA |

Legend: ✓=supported / ✗=not supported / △=conditional, via a separate product / Unknown=not confirmed in official docs (as of 2026-06).

> **Source verification status**: Routines / Codex cloud / Jules (including scheduled-tasks and API reference) / Copilot cloud agent (including Automations) were confirmed by directly fetching each vendor's official docs. **Workspace agents alone** relies on a previously verified KB value (2026-05-24), since OpenAI's blog / help center pages return `403` to automated fetches.

### Key points per ecosystem

- **Codex CLI (OpenAI)**: The async cloud offering is [Codex cloud](https://developers.openai.com/codex/cloud) (background/parallel execution, included with Plus / Pro / Business / Edu / Enterprise, excluding Free; docs don't specify GA/preview status). Triggered via web / IDE extension / tagging `@codex` on GitHub, and it can create PRs. **API- or schedule-based triggering is not documented for Codex cloud.** If periodic execution is needed, use [Workspace agents](https://openai.com/index/introducing-workspace-agents-in-chatgpt/) (scheduling + Slack integration, research preview limited to Business / Enterprise / Edu / Teachers) or ChatGPT's Scheduled Tasks (a general-purpose personal assistant, not a coding/PR automation agent). Workspace agents is the closest analog to Routines, but it's unavailable on individual plans.
  > **Note**: Workspace Agents is **not available on ChatGPT Plus / Pro**. It's limited to team/enterprise plans. The free period **ended on 2026-05-06**, and it's now credit-based billing consumed per-token (credits per million input/cached/output tokens) from the monthly credit pool for Business / Enterprise / Edu / Teachers plans. See OpenAI Help Center [Flexible pricing for the Enterprise, Edu, and Business plans](https://help.openai.com/en/articles/11487671-flexible-pricing-for-the-enterprise-edu-and-business-plans) for details.
- **Gemini CLI (Google)**: Google's async coding agent is [Jules](https://jules.google). **It supports all 3 trigger types** (the closest analog to Routines): ① a `jules` label on a GitHub issue → PR, ② [REST API](https://jules.google/docs/api/reference/) (start a session with `POST https://jules.googleapis.com/v1alpha/sessions`, authenticated via `X-Goog-Api-Key`, **alpha**), ③ [Scheduled tasks](https://jules.google/docs/scheduled-tasks/) (Daily / Weekly recurring maintenance runs). Billed by task count on Free / Pro / Ultra (15 / 100 / 300 tasks/day), labeled "experimental." To run the Gemini CLI itself in CI, use the `run-gemini-cli` GitHub Action.
- **GitHub Copilot CLI**: Cloud autonomy is provided by [Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent) (formerly coding agent, built on GitHub Actions, GA). Triggered by issue assignment / Copilot Chat / Slack, Teams, Jira, Linear, etc., and creates PRs (can specify "create PR immediately" in the prompt). Available on Pro / Pro+ / Max / Business / Enterprise, billed via Actions minutes + GitHub AI Credits. **[Automations](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-automations) reached GA on 2026-06-02, adding native scheduling**: hourly / daily / weekly recurrence, or automatic cloud agent session launches on issue creation / PR creation-update events (see the [changelog](https://github.blog/changelog/2026-06-02-schedule-and-automate-tasks-with-copilot-cloud-agent/)). Applies to private / internal repositories (public repos coming soon). No longer necessary to fall back on a hand-rolled GitHub Actions cron.

## Authentication and billing (Important)

From [Anthropic Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), "Authentication and credential use":

> OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support **ordinary use of Claude Code and other native Anthropic applications**.
>
> Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use **API key authentication** through Claude Console or a supported cloud provider.

What this means:

| Execution method | OK to run with subscription OAuth? | Recommended auth |
|---|---|---|
| Routines / Desktop / `/loop` | Yes (runs inside official Anthropic apps) | OAuth (subscription usage) |
| GitHub Actions / self-hosted CI | No (outside "ordinary individual use") | `ANTHROPIC_API_KEY` (pay-as-you-go) |
| Agent SDK / `claude -p` (scripted execution) | Allowed even on subscription, but **billed separately** (see Note below) | OAuth or API key |
| Embedded in a product | No | API key |

"It works with a subscription so it's free" and "a use Anthropic's policy permits" are separate axes. Running CI automation on OAuth risks both policy enforcement action (which Anthropic can take without prior notice) and wasting individual account usage.

> **Note (from 2026-06-15)**: Usage of the Agent SDK and `claude -p`, even under a subscription plan, is consumed from a separate "monthly Agent SDK credit" pool (distinct from the interactive-use allowance). Routines / Desktop / `/loop` still consume the traditional interactive allowance as part of the official app usage, but running the Agent SDK yourself in a script is billed separately. Details: [Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan).

## Decision flow

```text
Should it keep running after closing the laptop?
├─ Yes → Want to stay within the official apps (policy-compliant & no extra billing)?
│        ├─ Yes → Cloud Routines
│        └─ No  → GitHub Actions + ANTHROPIC_API_KEY
└─ No  → Can you leave a session open?
         ├─ Yes → /loop
         └─ No  → Desktop scheduled tasks
```

Additional decision factors:

- **Local files are required** → Desktop or `/loop` (Routines does a fresh clone, so it can't see files under `~/.gitignore` or untracked files)
- **GitHub event trigger** → Routines (PR opened / Release published, etc.) or GitHub Actions
- **API trigger (invoked from an external system)** → Routines' `/fire` endpoint
- **Interval shorter than 1 hour is required** → Routines is not an option. Use Desktop / `/loop` / GitHub Actions
- **Team operation, don't want to consume individual allowance** → GitHub Actions with an API key is the safest choice

## Common mistakes AI agents make

1. **Using an OAuth token in GitHub Actions** — `CLAUDE_CODE_OAUTH_TOKEN` technically works, but Anthropic's usage policy explicitly recommends an API key for CI automation. This risks both policy violation and wasting individual account allowance
2. **Building a long-lived cron with `/loop`** — `/loop` expires after 7 days and is session-scoped. Use Routines / Desktop / GitHub Actions for monthly reports or weekly updates
3. **Expecting Routines to push directly to `main`** — By default it can only push to `claude/`-prefixed branches. Writing to an existing branch requires enabling **Allow unrestricted branch pushes**
4. **Assuming Desktop scheduled tasks run with the laptop closed** — They don't. They only run while the app is running and the machine is awake
5. **Specifying a 30-minute interval in Routines cron** — The minimum is 1 hour. Use a different method if a shorter cycle is needed
6. **Relying on catch-up** — Desktop catches up on missed runs within 7 days, once only; Routines' behavior is undocumented; `/loop` and GitHub Actions have no catch-up. If timing matters, put a guard in the prompt itself (e.g. "skip and just summarize if it's already past 17:00")
7. **Forgetting the fresh clone** — Since Routines does a fresh clone every time, local `.gitignore`-based configuration or untracked files won't be reflected. Commit any required configuration to the repo, or reconstruct it via a SessionStart hook in `.claude/settings.json`

## References

- [Routines (cloud scheduled execution)](https://code.claude.com/docs/en/routines)
- [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- [`/loop` and the in-session scheduler](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Legal and compliance (OAuth vs. API key usage)](https://code.claude.com/docs/en/legal-and-compliance)
- [OpenAI Codex Cloud](https://developers.openai.com/codex/cloud)
- [Google Jules](https://jules.google)
- [GitHub Copilot cloud agent (formerly coding agent)](https://docs.github.com/en/copilot/concepts/agents/coding-agent) / [Copilot Automations](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-automations)
- [OpenAI Workspace Agents](https://openai.com/index/introducing-workspace-agents-in-chatgpt/)
- Related: `platforms/github-actions.md` / `ai/agents/claude-code.md` / `ai/practice/multi-agent-repo.md`
