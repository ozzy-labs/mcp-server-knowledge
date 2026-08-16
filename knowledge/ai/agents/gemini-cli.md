---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial, gcp]
---

# Gemini CLI

An open-source AI agent CLI provided by Google. Uses a ReAct (Reason and Act) loop to run complex coding tasks, debugging, and automation from the terminal.

## Installation

```bash
# npm (requires Node.js 20+)
npm install -g @google/gemini-cli

# npx (no install needed)
npx @google/gemini-cli

# Homebrew (macOS / Linux)
brew install gemini-cli

# MacPorts
sudo port install gemini-cli
```

Pre-installed on Google Cloud Shell and Cloud Workstations.

## Authentication

Three authentication methods:

- **Sign in with Google (OAuth)** — personal Google account
- **Gemini API key** — `GEMINI_API_KEY` environment variable (obtain from [AI Studio](https://aistudio.google.com/))
- **Vertex AI** — for enterprise / organization accounts

Can be changed interactively with the `/auth` command. `GOOGLE_CLOUD_PROJECT` must be set when using an organization account or a Code Assist license. For headless use, API Key or Vertex AI is recommended.

## Basic Commands

```bash
gemini                        # Start an interactive session
gemini -p "query"             # Non-interactive (headless) run
gemini -r latest "query"      # Resume the most recent session
gemini --list-sessions        # List sessions for the current project
gemini -o json -p "query"     # Structured output (text | json | stream-json)
gemini -w feature-x           # Start in a new git worktree (experimental.worktrees)
gemini --version              # Show version
gemini --help                 # Show help
gemini update                 # Update CLI to the latest version
```

Sub-command groups: `gemini extensions | mcp | skills ...` (for example `gemini mcp add <name> <command> --transport http`, `gemini skills install <source>`, `gemini extensions new <path>`).

## In-Session Commands (Key Excerpts)

| Command | Description |
|---|---|
| `/about` | Show version info |
| `/auth` | Interactively change authentication method |
| `/memory` | Memory management (list / refresh / show). v0.42 added the Auto Memory inbox flow, but with the migration to memoryV2, the official commands reference now lists the subcommands as list / refresh / show |
| `/model` | Model configuration (`manage` opens the dialog, `set <model> [--persist]`) |
| `/agents` | Subagent management (list / reload / enable / disable / config) |
| `/plan` | Switch to Plan Mode |
| `/resume` (alias `/chat`) | Session browser for auto-saved sessions + manual checkpoints (list / save / resume / delete / share) |
| `/rewind` | Step back through history and optionally revert file changes (shortcut: Esc Esc) |
| `/clear` `/compress` | Clear the screen / replace context with a summary |
| `/commands` | Custom command management (list / reload; list is new in v0.42) |
| `/extensions` | Extension management (install / uninstall / list / update / enable / disable / link / config / explore / restart). `new` / `validate` are CLI-only: `gemini extensions new <path>` / `gemini extensions validate <path>` |
| `/skills` | Skill management (list / link / disable / enable / reload) |
| `/hooks` | Hook management (list / panel / enable / disable / enable-all / disable-all) |
| `/mcp` | MCP server management |
| `/ide` | IDE integration |
| `/permissions` | Folder trust management (`trust [<path>]`) |
| `/policies` | List active Policy Engine policies (`list`) |
| `/settings` | Open the settings editor (validated `settings.json` editing) |
| `/stats` | Usage stats (`session` / `model` / `tools`) |
| `/shells` (`/bashes`) | Toggle the background-shell view |
| `/setup-github` | Set up the GitHub Actions issue-triage / PR-review workflows |
| `/init` `/quit` `/exit --delete` | Init / exit (`--delete` purges the session's history and temp files) |

See `gh api repos/google-gemini/gemini-cli/contents/docs/reference/commands.md` or the [docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md) for the full official list.

## Key Features

- **ReAct loop**: An autonomous architecture that alternates between reasoning and action
- **Voice mode (experimental)**: `experimental.voiceMode` enables `/voice` and `/voice model`. Space is push-to-talk by default (`experimental.voice.activationMode`: `push-to-talk` / `toggle`). The backend is selectable via `experimental.voice.backend`: `gemini-live` (default; audio is sent to Google Cloud) or `whisper` (local transcription, model chosen with `experimental.voice.whisperModel`)
- **Auto Memory (`experimental.autoMemory`)**: Extracts memory patches and skills from past sessions in the background, writing each change as a unified-diff `.patch` under `<projectMemoryDir>/.inbox/<kind>/` for review
- **Session management**: All conversations are auto-saved; browse and resume via `/resume`, `--resume latest`, `--list-sessions`, and revert with `/rewind`. Retention is tunable via `general.sessionRetention`
- **Git worktrees (experimental)**: `--worktree` / `-w` gives each session its own working directory; requires `experimental.worktrees: true`
- **Workspace trust**: Manages trusted folders when running automation scripts (`/permissions trust`)
- **Offline search**: Bundles `ripgrep` for fast local search
- **Four-tier memory management system**: Advanced prompt-driven memory retention
- **MCP integration**: Integration with Model Context Protocol servers

## Selectable Models (as of v0.55)

Specify via alias with the `--model` flag (or the `/model` dialog).

| Alias | Resolves to |
|---|---|
| `auto` | **Default.** Auto (Gemini 3) → `gemini-3-pro-preview` / `gemini-3-flash-preview`; Auto (Gemini 2.5) → `gemini-2.5-pro` / `gemini-2.5-flash` |
| `pro` | `gemini-3-pro-preview` when preview access is enabled, otherwise `gemini-2.5-pro` |
| `flash` | `gemini-2.5-flash` |
| `flash-lite` | `gemini-2.5-flash-lite` |

Gemini 3.1 Pro Preview is still rolling out: check `/model` → Manual for `gemini-3.1-pro-preview`, or launch it directly with `-m gemini-3.1-pro-preview`. Once you have access it is also included in **Auto (Gemini 3)** routing. `gemini-3.1-pro-preview-customtools`, `gemini-3.1-flash-lite`, and `gemini-3.5-flash` are additionally defined in the default model configs / `modelConfigs.modelIdResolutions` and are gated behind staged rollouts.

**Gemma 4**: Added experimentally in v0.41, enabled by default via the Gemini API in v0.42 (`experimental.gemma`, default `true`). The current stable release is v0.55.1 (2026-08-11). v0.51 → v0.55 shipped stability and security fixes only — macOS Seatbelt profiles realigned to deny-default, ReAct infinite-loop / prompt-injection mitigation, workspace-trust enforcement in the A2A server, MCP OAuth token refresh with the stored client ID, and `/compress` session-reload repair — with no model / command / config changes.

Fallback: when Gemini 3 Pro hits its limit, it automatically downgrades to Gemini 2.5 Pro → 2.5 Flash.

## Approval Modes

Four modes: `default` (confirm each action), `auto_edit` (auto-approve edits), `plan` (planning only), `yolo` (auto-approve all actions). Set via the `--approval-mode` flag or `general.defaultApprovalMode` in `settings.json`. `yolo` can only be enabled from the command line (`--yolo` / `-y` are deprecated; `--approval-mode=yolo` is recommended). Can be disabled with `security.disableYoloMode`. `--allowed-tools` is deprecated in favour of the Policy Engine (`policyPaths` / `adminPolicyPaths` in `settings.json`; inspect with `/policies list`).

## Sandbox

Supports Docker, Podman, and native OS sandboxes. Configurable in detail via `settings.json`.

## Skills

A newer feature added around 2026-03. Conforms to the `Agent Skills` open standard.

**Discovery directories** (precedence: low → high, later wins):

1. Built-in
2. Extension bundled
3. User: `~/.gemini/skills/` or `~/.agents/skills/`
4. Workspace: `.gemini/skills/` or `.agents/skills/`

`.agents/skills/` takes precedence over `.gemini/skills/` (for interoperability with other CLIs).

**Management**: `/skills list | link | disable | enable | reload` (`/skills list all` includes built-ins, `/skills list nodesc` hides descriptions) and `gemini skills list | install | link | uninstall | enable | disable` (`--all` is accepted by `enable` / `disable`). The default scope for `/skills disable` / `/skills enable` is user; use `--scope workspace` to change to workspace. On activation, after user confirmation via the `activate_skill` tool, the SKILL.md body and directory structure are injected into the conversation history.

## Subagents

Defined in `.gemini/agents/` (project) or `~/.gemini/agents/` (user).

**Frontmatter**:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | slug |
| `description` | Yes | purpose |
| `kind` | - | `local` / `remote` |
| `tools` | - | supports wildcards `*`, `mcp_*`, `mcp_server_*` |
| `mcpServers` | - | inline definition |
| `model` | - | can be `inherit` |
| `temperature` | - | 0.0-2.0 (default 1) |
| `max_turns` | - | default 30 |
| `timeout_mins` | - | default 10 |

**Built-in**: `generalist` / `cli_help` / `codebase_investigator` are enabled by default; `browser_agent` is **disabled by default** (requires Chrome 144+; the `chrome-devtools-mcp` server is bundled). Enable it and override any built-in via `agents.overrides.<name>` in `settings.json`; browser behaviour (`sessionMode` persistent / isolated / existing, `headless`, `allowedDomains`, `maxActionsPerTask`, `blockFileUploads`) lives under `agents.browser`.

**Invocation**: automatic delegation, or force invocation with `@subagent-name`. **Non-recursive** (a subagent cannot call another subagent).

## Custom Commands

Defined in TOML format under `.gemini/commands/*.toml`. Subdirectories create namespaces: `git/commit.toml` → `/git:commit`.

```toml
prompt = "Commit the following: {{args}}\n\n!{git diff --staged}\n\n@{README.md}"
description = "Suggest a commit message for staged changes"
```

**Placeholders**:

- `{{args}}` — command arguments
- `!{shell command}` — embeds the output of a shell command
- `@{file}` — embeds file contents

**Priority**: Project `.gemini/commands/` > User `~/.gemini/commands/` > Extensions (on a name collision, prefixed as `<extension>.<command>`).

## Hooks

Added in late 2025 / early 2026. Configured under the `hooks` section of `settings.json`.

**Supported events (11 types)**:

| Category | Events |
|---|---|
| Session | `SessionStart`, `SessionEnd` |
| Agent | `BeforeAgent`, `AfterAgent` |
| Model | `BeforeModel`, `AfterModel` |
| Tool | `BeforeToolSelection`, `BeforeTool`, `AfterTool` |
| Context | `PreCompress` |
| Other | `Notification` |

exit 0 = success (recommended for all logic, including blocking), exit 2 = system block (aborts the action), any other code = warning (continues). Hooks receive JSON fields such as `session_id` / `transcript_path` / `cwd` / `hook_event_name` / `timestamp`.

Hook definition fields: `type` / `command` / `name` / `timeout` (default 60000ms) / `description` / `sequential` (parallel/serial control) / `matcher`.

**Management commands**: `/hooks panel`, `/hooks enable-all`, etc.

**Security**: project hooks are fingerprinted, and a warning is shown when they change.

## Extensions

Packages defined via `gemini-extension.json`. Can include: `commands/`, `hooks/hooks.json`, `skills/`, `agents/`, `policies/`, `themes/`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`.

```bash
gemini extensions install <github-url>
gemini extensions uninstall <name>   # `delete` alias added in v0.42
gemini extensions list
gemini extensions update <name>
gemini extensions enable|disable <name>
gemini extensions link|new|validate <path>
```

## Agent Integration

### Instruction Files

Place `AGENTS.md` at the project root; Gemini CLI reads it automatically. `GEMINI.md` and `CONTEXT.md` can also be read as additional context.

### Registering MCP Servers

In `.gemini/settings.json` (per-project) or `~/.gemini/settings.json` (global):

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"],
      "timeout": 15000,
      "trust": false
    }
  }
}
```

MCP server-specific settings:

| Field | Description |
|---|---|
| `command` | startup command |
| `args` | command arguments |
| `env` | environment variables |
| `cwd` | working directory |
| `url` | URL for an SSE-based server |
| `timeout` | timeout (milliseconds) |
| `trust` | if true, skips tool call confirmation |
| `includeTools` | whitelist of tools to use |
| `excludeTools` | blacklist of tools to exclude |

## Free Tier

Available with a personal Google account. Documented maximum model requests per user per day:

| Authentication | Tier / subscription | Requests / user / day |
|---|---|---|
| Google account | Gemini Code Assist (Individual) | 1,000 |
| Google account | Google AI Pro | 1,500 |
| Google account | Google AI Ultra | 2,000 |
| Gemini API key | Free tier (unpaid, Flash only) | 250 |
| Gemini API key | Pay-as-you-go | Varies |
| Vertex AI | Express mode (free, 90 days before billing) | Varies |
| Google Workspace | Code Assist Standard / Enterprise | 1,500 / 2,000 |

Paid options:

- **Google AI Pro / AI Ultra**: for individuals, higher limits at a fixed price (Google AI Plus is *not* supported)
- **Vertex AI**: for enterprises, pay-as-you-go

## Limitations

- Requires Node.js 20+
- If there are issues activating the free tier on a Google Cloud account, `GOOGLE_CLOUD_PROJECT` must be set

## System Requirements

- macOS 15+, Windows 11 24H2+, Ubuntu 20.04+
- Node.js 20.0.0+
- Shell: Bash, Zsh, or PowerShell
- RAM: 4 GB+ for casual use, 16 GB+ for long sessions / large codebases
