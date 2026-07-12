---
reviewed: 2026-07-12
tags: [ai-agent, ai-workflow, commercial]
---

# Codex CLI

An open-source coding agent CLI provided by OpenAI. Reads/edits code and executes commands in a full-screen TUI, and also supports multi-agent parallel processing. As of 2026-07 the latest release is **rust-v0.144.1** (2026-07-09), and Codex is also integrated into the ChatGPT desktop app (macOS / Windows, 2026-07-09).

## Installation

```bash
# Official installer (macOS / Linux)
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# npm (requires Node.js 16+)
npm install -g @openai/codex

# Homebrew (cask distribution)
brew install --cask codex

# Direct binary download
# https://github.com/openai/codex/releases
```

## Authentication

Sign in on first launch. Authenticate with either of the following:

- Browser OAuth with a ChatGPT account (paid plan recommended)
- OpenAI API key (`OPENAI_API_KEY` environment variable)

The current default is `gpt-5.6-sol`, available via both ChatGPT sign-in and the OpenAI API (the GPT-5.6 family reached GA on 2026-07-09; `gpt-5.5` is now the previous generation).

## Basic commands

```bash
codex                    # Start a full-screen TUI session
codex "prompt"            # One-shot execution
codex update             # Update the CLI to the latest version
codex remote-control     # Remote control entry point (v0.130+)
codex remote-control pair # Generate a manual pairing code (v0.143+)
```

## In-session commands

| Command | Description |
|---|---|
| `/model` | Switch model |
| `/goal` | Persistent goal management (create/pause/resume/clear) |
| `/plan` | Create/edit a plan |
| `/status` | Show session status |
| `/usage` | Show account token usage / rate-limit reset (v0.140+) |
| `/import` | Import Claude Code settings, project files, and recent chats (v0.140+) |
| `/delete` | Fully delete the current session and exit (v0.140+) |
| `/resume` `/fork [name]` | Resume session / independent fork |
| `/agent` | Invoke a subagent |
| `/permissions` | Switch approval policy (old `/approvals` renamed to `/approve`) |
| `/diff` `/review` | Review change diffs |
| `/compact` | Compact context |
| `/plugins` `/apps` `/mcp` | Manage plugins, apps, MCP servers |
| `/init` | Initialize project |
| `/vim` | Toggle Vim modal editing in the composer (v0.129.0+) |
| `/hooks` | View/toggle hooks (v0.129.0+) |
| `/keymap` `/statusline` `/title` | UI customization |
| `/help` `/quit` `/exit` | Help / exit |

See the official full list at [Codex CLI slash commands](https://developers.openai.com/codex/cli/slash-commands).

## Configuration files

| Path | Purpose | Git-managed |
|---|---|---|
| `~/.codex/config.toml` | Global configuration | - |
| `AGENTS.md` | Project-specific instructions | Yes |

### Key config.toml settings

```toml
# Default model
model = "gpt-5.6-sol"

# Reasoning depth (minimal, low, medium, high, xhigh)
model_reasoning_effort = "medium"

# Approval policy: "untrusted" / "on-request" (default) / "never" / "granular"
# Old "on-failure" is deprecated (use "on-request" or "never")
approval_policy = "on-request"
```

### Bundled models

The `/model` picker's recommended models are the **GPT-5.6 family** (GA 2026-07-09): `gpt-5.6-sol` (current recommended default / flagship) / `gpt-5.6-terra` (balanced) / `gpt-5.6-luna` (fast, low cost), plus `gpt-5.4` / `gpt-5.4-mini` (lightweight, for subagents) and `gpt-5.3-codex-spark` (research preview, ChatGPT Pro only). `gpt-5.5` is now the previous-generation default; the older `gpt-5.3-codex` / `gpt-5.2` are deprecated for Codex under ChatGPT sign-in.

> For details on model-selection units, reasoning effort, fallback (Codex has no automatic fallback), and usage (ChatGPT plan quota / API pay-as-you-go), see [`codex-cli-model-selection.md`](codex-cli-model-selection.md).

## Key features

- **Full-screen TUI**: Interactive terminal UI
- **Multi-agent**: Parallel execution in independent Git worktrees
- **Large-thread paging (v0.130+)**: Toggle between summarized and full display of huge history
- **MCP integration**: Integration with Model Context Protocol servers. MCP **tool search is on by default** (v0.143+), ChatGPT-hosted MCP servers can use session authentication, and **MCP tools can request authentication interactively** without an experimental opt-in (v0.144+)
- **Remote plugins (default from v0.143)**: A plugin catalog sourced from an npm marketplace, with remote/local version comparison
- **System proxy support (v0.143+)**: Routes authentication and Responses API traffic through macOS / Windows system proxies (PAC / WPAD)
- **`writes` app-approval mode (v0.144+)**: For apps / MCP tools, allows declared read-only actions automatically while prompting only on writes (`apps.<id>.default_tools_approval_mode` / `mcp_servers.<id>.default_tools_approval_mode` accept `auto` / `prompt` / `writes` / `approve`)

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

> **Note**: The `--full-auto` flag was deprecated in v0.128.0 (retained with a warning for compatibility). Instead, explicitly specify `--sandbox workspace-write` and `--ask-for-approval never` (or set `approval_policy = "never"` + `sandbox_mode = "workspace-write"`). Switching to the higher-risk `sandbox_mode = "danger-full-access"` is also possible, but limit it to use in an isolated container or similar.

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
max_threads = 6       # Max parallel spawns
max_depth = 1         # Recursion depth
job_max_runtime_seconds = 1800
```

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

**Supported events (6 types)**:

| Event | Timing |
|---|---|
| `SessionStart` | On session start / resume |
| `PreToolUse` | Before tool execution (Bash / apply_patch / MCP tools). Blocked by `permissionDecision: deny` or exit 2. `additionalContext` support added in v0.129 |
| `PermissionRequest` | On approval request (permission escalation, network access, etc.) |
| `PostToolUse` | After tool execution |
| `UserPromptSubmit` | Immediately before a user utterance |
| `Stop` | End of a conversation turn |

v0.129 added support for running hooks before/after compaction, and the ability to view/toggle them in the `/hooks` browser.

## Agent integration

### Instruction files

Place `AGENTS.md` at the project root. Codex CLI loads it automatically.

- User-global: read in order `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md`
- Project: read hierarchically from the Git repository root down to the CWD, with closer files taking priority
- Truncated at a total of `project_doc_max_bytes` (default 32 KiB)

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
