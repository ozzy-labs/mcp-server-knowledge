---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

A mechanism for running Claude Code non-interactively on Anthropic-managed cloud infrastructure. The `/model` selector lets you choose **Claude Opus 4.8** (the previous-generation Opus 4.7 is also selectable) and **1 million token context**, usable as a trigger-driven autonomous execution platform. A prompt + repository + connectors are saved as a single configuration and auto-launched by triggers. Available on Pro / Max / Team / Enterprise plans when **Claude Code on the web is enabled** (research preview).

Official: [Automate work with routines](https://code.claude.com/docs/en/routines)

## Key features

- **Opus 4.8 & 1M Context**: selectable via the model selector (the previous-generation Opus 4.7 remains selectable too). Can analyze dependencies across an entire large repository at once.
- **fresh clone model**: each trigger clones the repository from the default branch, and changes are pushed to a `claude/`-prefixed branch. Enabling **Allow unrestricted branch pushes** also allows pushing to existing branches.

### Related features (not Routines itself, but used alongside it)

- **Dreaming** ([Managed Agents](https://platform.claude.com/docs/en/managed-agents/dreams)): a research-preview feature that reorganizes the memory store using past session logs as material. Same Claude Code ecosystem as Routines but a separate layer. During the research preview it supports `claude-opus-4-7` / `claude-sonnet-4-6`.
- **`/ultrareview`** ([a Claude Code core slash command](https://code.claude.com/docs/en/ultrareview)): a multi-lens pipeline that reviews the diff between the current branch and the default branch. Can also be invoked via Routines.

## Execution model

- **Cloud execution**: runs on Anthropic-managed VMs (continues even if your local machine is offline).
- **Fully autonomous**: no approval prompts. There is no permission-mode picker either. Design assuming `AskUserQuestion`-style tools will not function.
- **fresh clone**: each trigger clones the repository from the default branch.
- **Belongs to a personal account**: a routine is tied to a personal claude.ai account and is not shared across a team. Commits/PRs are recorded under your own GitHub user, and connector operations are recorded under your own linked account as well.

## Operating via CLI / API

Terminology distinction: a **routine** is "a configuration entity saved in the cloud"; **`/schedule`** is "the slash command used to operate that routine from the CLI." The two are distinct but not competing — `/schedule` is the CLI entry point to a cloud routine (this is distinct from the same-named local scheduled task in Desktop, and from `/loop`; see `ai/practice/scheduled-tasks.md`).

"Create/manage" and "fire" are separate layers. **Management is done via CLI (partially) and Web; firing from the outside is done via API.** There are three creation surfaces — Web, Desktop, and CLI — and since all of them write to the same claude.ai account, anything created on one surface is reflected on the others immediately.

### CLI (`/schedule`) — creation and management (schedule trigger only)

| Command | Action |
|---|---|
| `/schedule <natural language>` | Create a scheduled routine. Example: `/schedule daily PR review at 9am`; for one-off: `/schedule in 2 weeks, open a cleanup PR ...` |
| `/schedule list` | List all routines |
| `/schedule update` | Modify an existing routine (directly specifying a cron expression, changing connectors, and toggling the `enabled` flag are all done here) |
| `/schedule run` | Fire immediately |

- **What `/schedule` really is**: a built-in Claude Code CLI slash command. In recent versions it is implemented as a bundled skill that internally calls claude.ai's management endpoints (list/get/create/update/run on `/v1/code/triggers`) using an **in-process OAuth token**. **There is no public REST API for routine management** (not even one intended for curl use). The only public API is the `/fire` firing endpoint described below.
- **Disable / enable**: toggle `enabled` via `/schedule update` (`false` stops firing while keeping the configuration, `true` resumes it). Also possible via the **Repeats toggle** (pause/resume) on Web / Desktop.
- **Deletion is not possible from the CLI** — only from the Web / Desktop detail page (past execution sessions remain even after deletion). Neither the CLI nor the public API has a delete action; the most the CLI can do is disable (`enabled: false`).
- **The only trigger type the CLI can create is schedule**. Adding/editing API or GitHub triggers, and generating/revoking API tokens, are all only possible on the Web ([claude.ai/code/routines](https://claude.ai/code/routines)).
- Main causes of `/schedule` showing up as **"Unknown command"** (the CLI hides the command when requirements aren't met):
  1. Authenticated via Console API key / Bedrock / Vertex / Foundry. `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `apiKeyHelper` in `settings.json` take precedence over claude.ai login, so remove them (`/schedule` requires claude.ai subscription login).
  2. `DISABLE_TELEMETRY` / `DO_NOT_TRACK` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK` blocking feature-flag retrieval.
  3. Inside a Claude Code on the web session (operate via the Web UI instead).
  4. CLI version below v2.1.81 (`claude update`).

### Field capability boundaries in the create body

The body of `POST /v1/code/triggers`, which `/schedule`'s create calls, is a **strict schema** (unknown fields are rejected). Fields configurable from CLI/API and fields configurable only from the Web UI are separate.

**Configurable from CLI / API** (verified on existing routines):

| Item | Path within create body |
|---|---|
| model (e.g. `claude-opus-4-8[1m]`) | `job_config.ccr.session_context.model` |
| Custom instructions (full prompt text) | `job_config.ccr.events[].data.message.content` |
| Target repository | `job_config.ccr.session_context.sources[].git_repository.url` |
| allowed_tools | `job_config.ccr.session_context.allowed_tools` |
| Environment | `job_config.ccr.environment_id` |
| cron (minimum 1h, UTC) / `run_once_at` / `enabled` / `mcp_connections` | top-level |

→ **Both model and instructions can be set via CLI/API.** Don't misread the public docs' conversational-flow description as implying "instructions/model are Web-UI-only." `/schedule` (CLI) can register **everything except `allow_unrestricted_git_push`**.

**Web UI only** (rejected if included in the create body):

- **`allow_unrestricted_git_push`** (the Web UI's **Allow unrestricted branch pushes**) is rejected by the strict schema if passed in the create body:

  ```text
  HTTP 400
  {"type":"error","error":{"type":"invalid_request_error",
   "message":"allow_unrestricted_git_push: Extra inputs are not permitted"}}
  ```

  This permission can only be configured in the Web's Permissions settings. Since it's the setting that allows pushing to existing branches other than `claude/`-prefixed ones (e.g. `main`), a design where "the routine auto-merges its own PR into main" cannot be completed via CLI registration alone — this permission must be granted once on the Web.

### API — firing only, no CRUD

The only thing the HTTP API can do is **fire an existing routine**. There is no management API for list/create/update/delete (`/fire` is for claude.ai users only and is not part of the Claude Platform API).

```bash
curl -X POST https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire \
  -H "Authorization: Bearer sk-ant-oat01-xxxxx" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "Sentry alert SEN-4521 fired in prod. Stack trace attached."}'
```

- The base URL is **`https://api.anthropic.com`**, with path `/v1/claude_code/routines/{routine_id}/fire`.
- Auth uses a **per-routine bearer token** (generated via `Generate token` in the Web's API trigger settings — shown only once, cannot be retrieved again; use `Regenerate` / `Revoke` to update).
- The `text` field in the body is arbitrary free text and **is not parsed** (even if you pass JSON, it arrives as a string — used to pass alert bodies or failure logs).
- A successful response is returned **immediately at session creation** (it does not wait for completion):

  ```json
  { "type": "routine_fire",
    "claude_code_session_id": "session_01...",
    "claude_code_session_url": "https://claude.ai/code/session_01..." }
  ```

- The `experimental-cc-routine-2026-04-01` beta header is required. Breaking changes ship under a new-dated beta header, and the two most recent prior versions continue to work as a migration grace period.
- Full API reference: [Trigger a routine via API](https://platform.claude.com/docs/en/api/claude-code/routines-fire) (Claude Platform docs).

### Web / Desktop — full management

On the detail page you can **Run now**, **pause/resume** (Repeats toggle), edit, and delete. Team / Enterprise admins can disable Routines organization-wide via the **Routines toggle** on [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code); disabling it also stops existing routines.

## Triggers

Multiple triggers can be combined on a single routine (e.g. a nightly schedule + an API call from a deploy script + reacting to new PRs).

| Trigger | Purpose | Creation/edit surface |
|---|---|---|
| **Scheduled** | Recurring or one-off execution. Minimum interval is **1 hour** (shorter is rejected). One-off runs auto-disable after firing and show as **Ran** in the UI. | CLI / Web / Desktop |
| **API** | Fired externally via a per-routine HTTP POST (`/fire`). Bearer token authentication. | **Web only** |
| **GitHub** | Reacts to two categories of events, Pull request / Release (filterable). During the research preview there is a per-routine / per-account hourly cap. | **Web only** (requires the Claude GitHub App) |

## Usage limits

Reference values during the research preview (subject to change — check [claude.ai/code/routines](https://claude.ai/code/routines) or [claude.ai/settings/usage](https://claude.ai/settings/usage) for the latest):

| Plan | Approximate daily allowance |
|---|---|
| **Pro** | 5 runs |
| **Max** | 15 runs |
| **Team / Enterprise** | 25 runs |

- Subscription allowance is consumed the same way as interactive sessions (no API billing occurs). If usage credits are enabled, you can continue on a pay-as-you-go basis after exceeding the daily cap / subscription allowance.
- **One-off runs do not count against the daily cap** (though they still consume the subscription allowance as usual).

## Common mistakes AI agents make

1. **Turning a skill that includes `AskUserQuestion` into a routine** — a routine does not return approval prompts.
2. **Attempting repo-dependent processing in the setup script** — the setup script runs before the repo is cloned. Things like `uv sync` belong in step 1's instructions instead.
3. **Forgetting network access restrictions** — the default environment is Trusted, and outbound requests to non-allowed hosts get `403` + `x-deny-reason: host_not_allowed`. Fetching an RSS feed or reaching your own service requires Custom / Full.
4. **Misidentifying the `routine_id` prefix** — the correct prefix is **`trig_`**.
5. **Waiting on the `/fire` response for completion** — the endpoint returns immediately at session creation.
6. **Trying to CRUD routines via the public API** — the public API is firing-only. Creation/updates go through the CLI (schedule trigger only) or the Web; token generation/revocation is Web-only.
7. **Assuming `/web-setup` installs the GitHub App** — `/web-setup` only grants repo access for cloning. The GitHub trigger requires a separate installation of the Claude GitHub App (you're prompted for this when configuring the trigger).
8. **Trying to delete a routine via CLI / API** — no delete action exists. The most the CLI (`/schedule`) can do is disable it (`enabled: false` via `/schedule update`). Deletion is only possible from the Web / Desktop detail page.
9. **Assuming `allow_unrestricted_git_push` can be passed in the create body** — the create API's strict schema rejects unknown fields, returning `400 Extra inputs are not permitted`. This permission (allowing pushes to existing branches) can only be set in the Web UI's Permissions; it cannot be set via CLI/API.
