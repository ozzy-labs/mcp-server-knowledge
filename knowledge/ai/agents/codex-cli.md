---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial]
---

# Codex CLI

An open-source coding agent CLI provided by OpenAI. Reads/edits code and executes commands in a full-screen TUI, and also supports multi-agent parallel processing. As of 2026-08 the latest release is **rust-v0.147.0** (2026-08-07), and Codex is also integrated into the ChatGPT desktop app (macOS / Windows), which can be launched with `codex app`.

## Installation

```bash
# Official installer (macOS / Linux)
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Official installer (Windows)
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"

# npm (requires Node.js 16+)
npm install -g @openai/codex

# Homebrew (cask distribution)
brew install --cask codex

# Direct binary download
# https://github.com/openai/codex/releases
```

The standalone installers download from `https://releases.openai.com/codex` by default and fall back to GitHub Releases. Set `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM=false` to force GitHub Releases.

## Authentication

Sign in on first launch. Authenticate with either of the following:

- Browser OAuth with a ChatGPT account (paid plan recommended)
- OpenAI API key (`OPENAI_API_KEY` environment variable)

The current default is `gpt-5.6-sol`, available via both ChatGPT sign-in and the OpenAI API (the GPT-5.6 family reached GA on 2026-07-09; `gpt-5.5` is now the previous generation).

## Basic commands

```bash
codex                    # Start a full-screen TUI session
codex "prompt"            # One-shot execution
codex exec "prompt"      # Non-interactive run (alias: codex e)
codex update             # Update the CLI to the latest version
codex app                # Launch the Desktop app (macOS / Windows)
codex doctor             # Diagnose install / config / auth / runtime health
codex sandbox            # Run commands within a Codex-provided sandbox
codex resume             # Resume a previous session (--last skips the picker)
codex fork               # Fork a previous session (--last skips the picker)
codex archive|unarchive|delete  # Manage saved sessions by id or name
codex plugin             # Manage Codex plugins
codex cloud              # [experimental] Browse Codex Cloud tasks, apply changes locally
codex remote-control     # Remote control entry point (v0.130+)
codex remote-control pair # Generate a manual pairing code (v0.143+)
```

Key shared flags: `--sandbox` / `-s`, `--model` / `-m`, `--image` / `-i`, `--search`, and `--approve-for-me` (v0.147+, alias `--not-so-yolo`), which routes approval requests through automatic review using the `workspace-write` sandbox. `--dangerously-bypass-approvals-and-sandbox` (alias `--yolo`) skips all prompts and sandboxing.

## In-session commands

| Command | Description |
|---|---|
| `/model` | Choose model and reasoning effort |
| `/goal` | Set or view the goal for a long-running task |
| `/plan` | Switch to Plan mode |
| `/status` | Show session configuration and token usage |
| `/usage` | Show account usage / rate-limit reset (v0.140+) |
| `/import` | Import setup, projects, and recent chats from Claude Code or Cursor (Cursor added v0.145+) |
| `/new` `/rename` | Start a new chat mid-conversation / rename the current thread (v0.146+) |
| `/archive` `/delete` | Archive / permanently delete the current session and exit |
| `/resume` `/fork` | Resume a saved chat / fork the current one |
| `/side` `/btw` | Start a side conversation in an ephemeral fork (v0.146+) |
| `/agent` `/subagents` | Switch the active agent thread |
| `/permissions` | Choose what Codex is allowed to do (replaces the old `/approvals`) |
| `/approve` | Approve one retry of a recent auto-review denial |
| `/experimental` | Toggle experimental features |
| `/memories` | Configure memory use and generation |
| `/skills` | Browse and use skills |
| `/diff` `/review` | Review change diffs |
| `/compact` | Compact context |
| `/copy` `/export` `/raw` | Copy last response / export conversation as Markdown / toggle raw scrollback |
| `/plugins` `/apps` `/mcp` | Manage plugins, apps, MCP servers |
| `/ide` | Include current selection, open files, and other IDE context |
| `/init` | Create an `AGENTS.md` file for the project |
| `/vim` | Toggle Vim modal editing in the composer (v0.129.0+) |
| `/hooks` | View/manage lifecycle hooks (v0.129.0+) |
| `/setup-default-sandbox` `/sandbox-add-read-dir` | Set up the elevated sandbox / grant an extra read directory (Windows) |
| `/ps` `/stop` | List / stop background terminals |
| `/keymap` `/statusline` `/title` `/theme` `/personality` | UI and style customization |
| `/quit` `/exit` | Exit Codex |

See the official full list at [Developer commands](https://learn.chatgpt.com/codex/developer-commands?surface=cli) (the page formerly titled "Codex CLI slash commands"; `?surface=cli` scopes it to the CLI).

## Configuration files

| Path | Purpose | Git-managed |
|---|---|---|
| `~/.codex/config.toml` | Global configuration | - |
| `AGENTS.md` | Project-specific instructions | Yes |

### Key config.toml settings

```toml
# Default model
model = "gpt-5.6-sol"

# Reasoning depth (none, minimal, low, medium, high, xhigh, max, ultra)
# Supported values vary per model; GPT-5.6 Sol accepts low/medium/high/xhigh/max/ultra
model_reasoning_effort = "medium"

# Approval policy: "untrusted" / "on-request" (default) / "never" / "granular"
# Old "on-failure" is deprecated (use "on-request" or "never")
approval_policy = "on-request"
```

### Bundled models

The `/model` picker's recommended models are the **GPT-5.6 family** (GA 2026-07-09): `gpt-5.6-sol` (current recommended default / flagship) / `gpt-5.6-terra` (balanced) / `gpt-5.6-luna` (fast, low cost), all with a 272,000-token context window (corrected in v0.144.6). `gpt-5.5` and `gpt-5.2` remain listed as previous generations. Since v0.145 the bundled `gpt-5.4` / `gpt-5.4-mini` selections have been migrated to GPT-5.6 Terra / Luna and are hidden from the picker; `gpt-5.3-codex` / `gpt-5.3-codex-spark` are no longer in the bundled catalog.

> For details on model-selection units, reasoning effort, fallback (Codex has no automatic fallback), and usage (ChatGPT plan quota / API pay-as-you-go), see [`codex-cli-model-selection.md`](codex-cli-model-selection.md).

## Key features

- **Full-screen TUI**: Interactive terminal UI
- **Multi-agent**: Parallel execution in independent Git worktrees
- **Large-thread paging (v0.130+)**: Toggle between summarized and full display of huge history
- **MCP integration**: Integration with Model Context Protocol servers. MCP **tool search is on by default** (v0.143+), ChatGPT-hosted MCP servers can use session authentication, and **MCP tools can request authentication interactively** without an experimental opt-in (v0.144+)
- **Remote plugins (default from v0.143)**: A plugin catalog sourced from an npm marketplace, with remote/local version comparison
- **System proxy support (v0.143+)**: Routes authentication and Responses API traffic through macOS / Windows system proxies (PAC / WPAD)
- **`writes` app-approval mode (v0.144+)**: For apps / MCP tools, allows declared read-only actions automatically while prompting only on writes (`apps.<id>.default_tools_approval_mode` / `mcp_servers.<id>.default_tools_approval_mode` accept `auto` / `prompt` / `writes` / `approve`)
- **Agent Plugins (v0.146–v0.147)**: Plugin manifests, workspace plugin publishing, portable plugins, and unified search across local / personal / workspace / remote catalogs, plus marketplaces for Amazon Bedrock and Claude Code
- **Thread organization (v0.146+)**: Name sessions with `/new` / `/clear`, pin threads, keep side conversations open (`/side`), temporary forks, and persistent manually ordered sections (v0.147)
- **Paginated thread history (v0.145+, experimental)**: Efficient resume and search over long transcripts; `codex migrate-rollouts` inspects or migrates legacy local sessions
- **`/import` from Claude Code and Cursor (v0.145+)**: Migrates settings, MCP servers, plugins, sessions, commands, project-scoped memories, and Cursor-managed skills (v0.147)
- **Multi-agent V2 (stabilized v0.145, opt-in)**: Configurable subagent models, reasoning levels, concurrency, and restored roles
- **Amazon Bedrock (v0.145+, experimental)**: Managed login, custom endpoints / authentication, `gpt-5.6-sol` as the default Bedrock model, plus cached web search and remote compaction (v0.147)
- **Audio and realtime (v0.145+)**: Audio inputs and tool outputs in common local formats, and streaming realtime V3 conversations
- **MCP 2026-07-28 protocol (opt-in, v0.147+)**: Paginated discovery, multi-round requests, and non-blocking server startup; MCP SDK upgraded to 3.0.0
- **`--approve-for-me` (v0.147+)**: Routes approval requests through automatic review using the `workspace-write` sandbox (alias `--not-so-yolo`)

## Approval policies

| Policy | Description |
|---|---|
| `untrusted` | Only known-safe read-only commands run automatically; everything else waits for approval |
| `on-request` | The agent asks for approval as needed (recommended default) |
| `never` | Never asks for approval (for non-interactive execution. Combine with `sandbox_mode`. High risk) |
| `granular` | Fine-grained control by category. Has sub-options such as `sandbox_approval` / `rules` / `mcp_elicitations` / `request_permissions` / `skill_approval` |

Configured via `approval_policy` in `config.toml`. The old `on-failure` is deprecated (use `on-request` or `never`). The TUI picker's display labels (Suggest / Auto Edit / Full Auto) come from the old UI and differ from the TOML values.

## Sandbox

Configured via `sandbox_mode` in `config.toml`: `read-only` / `workspace-write` / `danger-full-access`.

> **Note**: The `--full-auto` flag was deprecated in v0.128.0 and **removed in v0.147.0**. Instead, explicitly specify `--sandbox workspace-write` and `--ask-for-approval never` (or set `approval_policy = "never"` + `sandbox_mode = "workspace-write"`). Switching to the higher-risk `sandbox_mode = "danger-full-access"` is also possible, but limit it to use in an isolated container or similar.

Platform-specific sandbox implementations: Seatbelt on macOS, Landlock/seccomp on Linux. When running inside a Docker / Podman container, `danger-full-access` combined with the outer container isolation is recommended.

## Skills

Complies with the `Agent Skills` open standard. Place a `SKILL.md` to have it loaded.

```text
.agents/skills/code-review/
├── SKILL.md               # Required. Frontmatter + body
├── agents/openai.yaml     # Codex-specific metadata (optional)
├── scripts/               # (optional)
├── references/            # (optional)
└── assets/                # (optional)
```

**Discovery order**:

1. `.agents/skills/` (CWD → parents → repository root)
2. `$HOME/.agents/skills/`
3. `/etc/codex/skills/` (admin)
4. Built-in

**SKILL.md frontmatter**:

```markdown
---
name: code-review
description: Review code for security and best practices
---

When reviewing code...
```

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Skill name |
| `description` | Yes | Key for discovery |

**Invocation**: `/skills` command, `$skill-name` mention, or implicit triggering.

### Custom Prompts (deprecated)

The old `~/.codex/prompts/*.md` (top-level only) is deprecated. Use Skills for new work.

## Subagents

Place under `~/.codex/agents/` (personal) or `.codex/agents/` (project). **Does not spawn unless the user explicitly requests it** (in contrast to Claude Code's automatic delegation).

Controlled via `config.toml`:

```toml
[agents]
enabled = true                              # Multi-agent tools on/off (default true)
max_concurrent_threads_per_session = 6      # Max concurrent spawned threads (old alias: max_threads)
max_depth = 1                               # Recursion depth (V1 only; ignored by V2)
default_subagent_model = "gpt-5.6-luna"     # Default model for spawned subagents
default_subagent_reasoning_effort = "medium"
```

`job_max_runtime_seconds` was removed and is retained only as a no-op for compatibility. Named roles can also be declared as `[agents.<role>]` tables with `description` / `config_file` / `nickname_candidates`.

**Custom agent file frontmatter**:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Agent identifier |
| `description` | Yes | Usage description |
| `developer_instructions` | Yes | System prompt |
| `nickname_candidates` | - | Aliases for invocation |
| `model` | - | Model to use |
| `model_reasoning_effort` | - | Reasoning depth |
| `sandbox_mode` | - | Sandbox override |
| `mcp_servers` | - | Available MCP servers |
| `skills.config` | - | Preloaded skills |

**Built-in**: `default` / `worker` / `explorer`.

## Hooks

Enabled by default. Disable with `[features] hooks = false` (`codex_hooks` is a deprecated alias, renamed in v0.129). `~/.codex/hooks.json` or `<repo>/.codex/hooks.json`.

**Supported events (11 types)**:

| Event | Timing |
|---|---|
| `SessionStart` | On session start / resume |
| `SessionEnd` | On session end |
| `UserPromptSubmit` | Immediately before a user utterance |
| `PreToolUse` | Before tool execution (Bash / apply_patch / MCP tools). Blocked by `permissionDecision: deny` or exit 2. `additionalContext` support added in v0.129 |
| `PostToolUse` | After tool execution |
| `PermissionRequest` | On approval request (permission escalation, network access, etc.) |
| `PreCompact` / `PostCompact` | Before / after context compaction (added in v0.129) |
| `SubagentStart` / `SubagentStop` | When a spawned subagent starts / stops |
| `Stop` | End of a conversation turn |

Hook actions are not limited to shell commands: `command` (with a `commandWindows` variant), `mcp_tool`, `prompt`, and `agent` are all supported. v0.129 added the `/hooks` browser for viewing and toggling them.

## Agent integration

### Instruction files

Place `AGENTS.md` at the project root. Codex CLI loads it automatically.

- User-global: read in order `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md`
- Project: read hierarchically from the Git repository root down to the CWD, with closer files taking priority
- Truncated at a total of `project_doc_max_bytes` (default 32 KiB)
- Extra filenames to look for when `AGENTS.md` is missing can be listed in `project_doc_fallback_filenames` (default: empty)

### MCP server registration

Configure in `~/.codex/config.toml`:

```toml
[mcp_servers.knowledge]
command = "node"
args = ["/path/to/mcp-server-knowledge/dist/index.js"]
```

## Limitations

- Requires a paid ChatGPT plan
- Windows has native support (runs via PowerShell + Windows sandbox). Use WSL2 if you need a Linux-native environment

## System requirements

- macOS 12+, Ubuntu 20.04+/Debian 10+, Windows 11 (native execution via PowerShell, or WSL2)
- Node.js 16+ (if installing via npm)
- RAM: 4 GB or more (8 GB recommended)
