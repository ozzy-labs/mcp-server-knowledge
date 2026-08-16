---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial]
aliases: [cc]
---

# Claude Code

An AI coding agent CLI from Anthropic. In the terminal, the agent autonomously understands and edits the codebase, performs Git operations, and runs commands. As of 2026-08-16 the latest release is **v2.1.233** (2026-08-14); the `stable` channel, which trails by about a week and skips releases with major regressions, is at **v2.1.224**. Choose a channel with the `autoUpdatesChannel` setting (`latest` is the default, `stable` the alternative) and pin a floor with `minimumVersion`.

Recent highlights: **Claude Opus 5** (`claude-opus-5`) became the default Opus model in v2.1.219; subagent forking became the default in v2.1.232; and `claude self-hosted-runner` (v2.1.224) lets Team / Enterprise run Claude Code web, mobile, and desktop sessions on their own machines. Auto mode has been available without opt-in on Amazon Bedrock, Google Cloud's Agent Platform (Vertex), and Microsoft Foundry since v2.1.207.

## Installation

```bash
# Native installer (recommended - auto-update support, no Node.js required)
curl -fsSL https://claude.ai/install.sh | bash    # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex           # Windows PowerShell
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd  # Windows CMD

# Homebrew (no auto-update; channel is chosen by cask name)
brew install --cask claude-code          # stable channel
brew install --cask claude-code@latest   # latest channel

# WinGet (no auto-update)
winget install Anthropic.ClaudeCode

# Linux package managers: signed apt / dnf / apk repositories, each with
# a stable and a latest channel (repository + signing key setup required)

# npm (advanced option; requires Node.js 22+, installs the same native binary)
npm install -g @anthropic-ai/claude-code
```

## Authentication

OAuth authentication in the browser on first launch. As of 2026-05-06, the 5-hour message limit was **doubled** for all paid plans.

- Claude Pro / Max / Team / Enterprise
- API Console (API key billing)

## Basic commands

```bash
claude                    # Start an interactive session
claude "prompt"           # One-shot execution
claude --help             # Show help
claude update             # Update the CLI to the latest version
```

## In-session commands

| Command | Description |
|---|---|
| `/help` | Show help |
| `/clear` | Clear context |
| `/compact` | Compact context |
| `/model` | Switch model |
| `/usage` | Show session cost, plan usage, and stats. `/cost` and `/stats` have been merged into this |
| `/agents` | Manage subagents |
| `/goal` | Set a persistent goal (v2.1.139+) |
| `/plugin` | Plugin manager UI |
| `/color` | Set the prompt bar color for the current session |
| `/effort` | Set the model effort level (`low` / `medium` / `high` / `xhigh` / `max`, or `auto`) |
| `/fork` | Copy the current conversation into a new background session (v2.1.212+) |
| `/subtask` | Hand a side task to a subagent that reports back (took over the old in-session `/fork`, v2.1.212+) |
| `/code-review` | Review the current diff or a PR; `/review` is an alias, `/code-review ultra` runs a deep cloud review |
| `/tasks` | List the session's background work |
| `/status` | Session status, including kind: `interactive`, or a background job that is `attached` or `unattended` |
| `/teleport` | Pull a web session into the terminal (also `claude --teleport <session id>`) |
| `/remote-control` | Continue the session from another device |
| `/btw` | Ask a side question without adding it to conversation history |

`claude agents` (direct CLI invocation, v2.1.139+ Research Preview) launches the agent view.

Custom commands have been merged into skills: `.claude/commands/deploy.md` and `.claude/skills/deploy/SKILL.md` both create `/deploy` and behave the same. Existing `.claude/commands/` files keep working; skills add a directory for supporting files, richer frontmatter, and automatic invocation by Claude.

## Configuration files

| Path | Purpose | Git managed |
|---|---|---|
| `~/.claude.json` | User-scoped settings | - |
| `CLAUDE.md` | Project-specific instructions | Yes |
| `.claude/settings.json` | Project-specific settings | Yes |
| `.claude/rules/` | Additional rule files | Yes |
| `.claude/commands/` | Custom slash commands | Yes |
| `.claude/agents/` | Subagent definitions | Yes |
| `.claude/skills/` | Skill definitions (`<name>/SKILL.md`) | Yes |

### Environment variables

- `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` - Disables fullscreen mode, keeping native scrolling.
- `CLAUDE_CODE_SESSION_ID` - Exposes the session ID for reference (for hooks).
- `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` - Nested subagent depth limit (default 3 since v2.1.219).
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` - Concurrent subagent cap (default 20).
- `CLAUDE_CODE_FORK_SUBAGENT=0` - Turns off default subagent forking.
- `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` - Restores the todo/task tools, which are off on Opus 4.8, Sonnet 5, Fable 5, Mythos 5, and newer models (v2.1.233).

### Key features

- **Editor integration**: Optimized behavior in VS Code and Cursor terminals. See [`platforms/vscode/vscode-extensions.md`](../../platforms/vscode/vscode-extensions.md) for extension-development basics.
- **File editing**: Read, edit, and create code
- **Command execution**: Run shell commands and interpret results
- **Git operations**: Commits, branches, and PR creation via natural language
- **Routines (v2.1.130+)**: Higher-order prompts that run PR fixes or periodic tasks asynchronously (see [`claude-code-routines.md`](claude-code-routines.md)).
- **Claude Code on Desktop (announced 2026-05)**: A desktop GUI version for viewing images and rich output. See [`claude-cowork.md`](claude-cowork.md) for autonomous agent features.

### Extension mechanisms

- **MCP integration**: Integration with Model Context Protocol servers
- **Subagents**: Independent-context agents for specialized tasks (`.claude/agents/`)
- **Skills**: Bundles of prompt + context (`.claude/skills/`)
- **Plugins**: Bundle and distribute commands, agents, skills, etc. Can be loaded externally with `--plugin-url`.

### Experience customization

- **Output styles**: Switch response tone and format per project (`.claude/output-styles/`)
- **Status line**: Persistently display model, cost, context usage, etc. at the bottom of the terminal

### Operations

- **Scheduled execution**: Periodic execution on Anthropic infrastructure
- **Self-hosted environments (v2.1.224+)**: `claude self-hosted-runner` turns your own machines or containers into a host for Claude Code web, mobile, and desktop sessions (Team / Enterprise)
- **Remote Control**: Continue a local terminal session from claude.ai, the mobile app, or Desktop (`/remote-control`)
- **Cross-session messaging (v2.1.224+)**: Sessions message each other via `SendMessage`, discovered with `ListAgents` / `/list-agents`; typing `@` in the prompt mentions another live session by name (v2.1.232, macOS and Linux)

## Permission modes

| Mode | Description |
|---|---|
| Ask | Confirm every tool call |
| Auto-edit | File edits are automatic, command execution requires confirmation |
| Full auto | Everything runs automatically (controllable via allowlist) |

Fine-grained control via `permissions` in `settings.json`:

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "ask": ["Bash"],
    "deny": ["WebSearch"]
  }
}
```

## Hook system

A mechanism for inserting automated processing before/after tool execution or session events. There are 5 handler types: `command` (shell execution), `prompt` (LLM evaluation), `http` (HTTP POST), `agent` (subagent invocation), and `mcp_tool` (direct MCP tool invocation, added v2.1.118).

**Key events** (around 30):

| Category | Events |
|---|---|
| Session | `SessionStart`, `Setup` (`--init-only`), `SessionEnd` |
| Turn | `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `StopFailure` |
| Tool | `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolBatch`, `PostToolUseFailure` |
| Subagent | `SubagentStart`, `SubagentStop` |
| Task | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
| Async | `Notification`, `MessageDisplay`, `CwdChanged`, `DirectoryAdded` (v2.1.219+), `FileChanged`, `InstructionsLoaded`, `ConfigChange` |
| Context | `PreCompact`, `PostCompact` |
| MCP / worktree | `Elicitation`, `ElicitationResult`, `WorktreeCreate`, `WorktreeRemove` |

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash ./scripts/validate.sh",
          "timeout": 5
        }
      ]
    }
  ]
}
```

**Responses**: exit 0 = allow, exit 2 = deny (stderr is fed back as the error message). In `PreToolUse`, `hookSpecificOutput.permissionDecision` allows finer control by returning `allow` / `deny` / `ask` / `defer` (added late 2025). Fields include `async`, `asyncRewake`, `statusMessage`, `once`, `shell`, `args` (exec form, no shell, v2.1.139). The `if` field under `conditional` uses permission-rule syntax (e.g. `Bash(git *)`) to narrow the conditions under which a hook fires (v2.1.85). `PostToolUse` hooks can replace any tool's output via `hookSpecificOutput.updatedToolOutput` (v2.1.121); `continueOnBlock` (v2.1.139) lets subsequent hooks continue even if one is denied. `terminalSequence` (v2.1.141) can emit terminal escapes such as OSC 9/777 to trigger desktop notifications.

## Subagents

Specialized agents that operate in a context independent from the main session. Defined in `.claude/agents/<name>.md` or `~/.claude/agents/<name>.md`.

```markdown
---
name: code-explorer
description: Explore and understand codebases. Use when analyzing project structure.
model: haiku
tools: Grep Glob Read
---

Systematically analyze the codebase...
```

`model` can be an alias such as `sonnet` / `opus` / `haiku` / `fable`, an explicit ID like `claude-opus-5` / `claude-sonnet-5`, or `inherit` (inherit from the parent session — the default when omitted). Resolution order: the `CLAUDE_CODE_SUBAGENT_MODEL` env var > a per-invocation `model` > this frontmatter field > the main conversation's model.

| Field | Description |
|---|---|
| `name` | Agent identifier (required) |
| `description` | Used to determine automatic delegation (required) |
| `model` | Model to use (`inherit` to inherit from the parent session) |
| `tools` | Allowed tools (comma- or space-separated). Supports `Agent(<agent_type>)` to restrict which subagents it may spawn |
| `disallowedTools` | Denied tools |
| `permissionMode` | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` / `manual` |
| `maxTurns` | Maximum number of turns |
| `skills` | Skills to preload |
| `mcpServers` | Available MCP servers |
| `hooks` | Hooks active within this agent |
| `memory` | `user` / `project` / `local` - persisted to `<scope>/agent-memory/<name>/` |
| `isolation` | `worktree` isolates into a Git worktree |
| `background` | `true` keeps the subagent in the background even when Claude asks to run it in the foreground |
| `effort` | Reasoning effort: `low` / `medium` / `high` / `xhigh` / `max` |
| `color` | UI color coding |
| `initialPrompt` | Instruction sent immediately after launch |

**The body is treated as the system prompt** (there is no `system-prompt` field).

**How to invoke**:

- **Automatic delegation**: The parent agent detects a task matching `description` and delegates
- **`/agents` command**: Select interactively
- **Via the Agent tool**: When a skill definition specifies `context: fork` + `agent: <name>`

**Scope priority** (high to low): Managed settings > `--agents` CLI flag (JSON) > Project (`.claude/agents/`) > User (`~/.claude/agents/`) > Plugin.

**Built-in subagents**:

| Name | Purpose |
|---|---|
| `Explore` | Read-only, inherits the parent model (capped at Opus on the Claude API). Fast code exploration |
| `Plan` | Inherits the parent model, read-only. Gathers codebase context during plan mode |
| `general-purpose` | General-purpose delegation target |
| `claude` | Catch-all agent with every available tool |
| `fork` | Inherits the full parent conversation (see below) |
| `statusline-setup` | Interactive status-line configuration |
| `claude-code-guide` | Answers questions about Claude Code features |

As of v2.1.63, the old `Task` tool has been renamed `Agent` (the alias remains). Its `mode` parameter was deprecated in v2.1.212 and is now ignored — subagents inherit the parent session's permission mode.

**Forking (v2.1.232+)**: `subagent_type: "fork"` is on by default in interactive sessions (off with `-p` and the Agent SDK). A fork inherits the parent's full conversation, system prompt, tools, model, and prompt cache, keeps its own tool calls isolated, and returns only its final result. While fork mode is on, every Claude-spawned subagent runs in the background. Toggle with `CLAUDE_CODE_FORK_SUBAGENT=0/1`, or block it with an `Agent(fork)` deny rule.

**Nesting and limits**: subagents nest up to 3 levels deep by default (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`), with at most 20 running concurrently (`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`). The per-session spawn cap introduced in v2.1.212 was removed again in v2.1.224.

## Skills

Task-specific bundles of prompt + context. Defined in `.claude/skills/<name>/SKILL.md`.

```markdown
---
name: code-review
description: Review code for best practices, security issues, and potential bugs. Use when reviewing code or checking PRs.
allowed-tools: Read Grep Glob
---

When reviewing code, check the following:
- Security vulnerabilities
- Performance issues
- Test coverage
```

| Field | Description |
|---|---|
| `name` | Skill name (defaults to directory name if omitted; invocable via `/name`) |
| `description` | **The key to discovery**. `description` + `when_to_use` combined max 1,536 characters. Put the use case up front |
| `when_to_use` | Additional trigger description |
| `argument-hint` / `arguments` | Argument description/parsing definition for `/skill-name <args>` invocation |
| `user-invocable` | If `false`, only Claude can invoke it (default true) |
| `disable-model-invocation` | If `true`, only the user can invoke it (default false) |
| `allowed-tools` | Tools that skip the permission prompt while the skill is active |
| `paths` | Restricts auto-trigger paths via glob |
| `model` | Per-skill model override (`sonnet` / `opus` / `haiku`, etc.) |
| `effort` | Per-skill effort level (`xhigh` / `high` / `medium` / `low`) |
| `shell` | Shell to use for commands within the skill (`bash` / `powershell`) |
| `hooks` | Hooks that act only while this skill is active |
| `context` | `fork` to run in a subagent context |
| `agent` | Agent name when `context: fork` (defaults to `general-purpose`) |
| `background` | With `context: fork`, `false` waits for the forked subagent's result in the invoking turn instead of backgrounding it (default `true`, v2.1.218+) |
| `metadata` | Free-form YAML map for your own tooling; Claude Code accepts it but does not act on its contents |

**Progressive disclosure**: At startup, only the description is loaded into context; the body is loaded once triggered. This is the core of context conservation.

**How to invoke**:

- **Manual**: `/skill-name [arguments]`
- **Automatic**: Claude auto-triggers it if the task matches `description`

**Difference from subagents**: A subagent is a "persistent agent definition to delegate to," while a skill is a "reusable task prompt invoked on demand."

## Plugins / marketplace

A mechanism for packaging and distributing commands, subagents, skills, hooks, and MCP servers together.

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json      # name, description, version, author
├── skills/
│   └── <skill-name>/SKILL.md
├── agents/
│   └── <agent-name>.md
├── hooks/
│   └── hooks.json
├── .mcp.json
└── .lsp.json
```

**Key commands**:

| Command | Purpose |
|---|---|
| `/plugin` | Plugin manager UI |
| `/plugin install <name>` | Install from a marketplace |
| `/reload-plugins` | Reload during development |
| `claude --plugin-dir ./path` | Launch and test a local plugin |

**Marketplaces**:

- **Official**: `platform.claude.com/plugins` / `claude.ai/settings/plugins`
- **Community**: Distributed via repositories / custom registries
- **Team operations**: Refers to managed settings or a team marketplace

## Output styles

A mechanism for switching response tone, format, and role. Does not change knowledge or tools. Placed at `.claude/output-styles/<name>.md` or `~/.claude/output-styles/<name>.md`.

```markdown
---
name: Japanese Technical Writer
description: Respond in formal Japanese while maintaining technical accuracy
keep-coding-instructions: true
---

# Japanese Technical Mode

Respond entirely in Japanese, in the register of business/technical documents...
```

| Field | Description |
|---|---|
| `name` | Display name (defaults to filename if omitted) |
| `description` | Shown in the `/config` selection UI |
| `keep-coding-instructions` | If `true`, keeps Claude Code's default coding instructions (default `false`) |
| `force-for-plugin` | Plugin output styles only: apply automatically whenever the plugin is enabled, overriding the user's `outputStyle` |

**How to select**:

- `/config` -> Output style -> select from menu
- Edit the `outputStyle` field in `settings.json` (effective from the next session)

**Built-in styles**: `Default` / `Proactive` (executes immediately and makes reasonable assumptions instead of pausing; stronger than auto mode and independent of the permission mode) / `Explanatory` (adds educational asides) / `Learning` (collaborative mode with `TODO(human)` markers).

The standalone `/output-style` command was deprecated in v2.1.73 and removed in v2.1.91 — use `/config` or the `outputStyle` setting.

## Status line

A customization feature that persistently displays session info at the bottom of the terminal. A shell script receives JSON on stdin and its stdout is displayed as-is.

`settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2,
    "refreshInterval": 1
  }
}
```

Example script:

```bash
#!/bin/bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
echo "[$MODEL] $PCT% context"
```

**Key fields available in the JSON**:

- `model.display_name`, `model.id`
- `workspace.current_dir` (`cwd` alias), `workspace.project_dir`, `workspace.git_worktree` (set within a linked worktree)
- `context_window.used_percentage`, `context_window.remaining_percentage`
- `cost.total_cost_usd`, `cost.total_duration_ms`, `cost.total_api_duration_ms`
- `session_id`, `session_name`
- `rate_limits.five_hour.used_percentage`, `rate_limits.five_hour.resets_at` (Unix epoch), `rate_limits.seven_day.used_percentage`, `rate_limits.seven_day.resets_at`
- `effort.level`, `thinking.enabled` (added v2.1.119)

**Quick setup**: Sending `/statusline show model name and context usage` has Claude generate the script and configure it automatically.

## Agent integration

### Instruction files

Place `CLAUDE.md` at the project root. Claude Code loads it automatically.

### Registering MCP servers

Registering via the CLI command is recommended. Add a server with a specified scope:

```bash
# User scope (shared across all projects)
claude mcp add --transport stdio <name> --scope user -- <command> [args...]

# Project scope (shared within the repository, written to .mcp.json)
claude mcp add --transport stdio <name> --scope project -- <command> [args...]

# Local scope (only you, on this project)
claude mcp add --transport stdio <name> --scope local -- <command> [args...]

# Check registration status/connectivity
claude mcp list
```

| Scope | Written to | Shared with |
|---|---|---|
| `user` | Top-level `mcpServers` in `~/.claude.json` | All projects |
| `project` | `.mcp.json` at the repository root | Shared via Git |
| `local` | Project-specific local settings | This machine only |

Format when writing the configuration manually:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

**Scope priority**: Local > Project > User (if servers share a name, the higher-priority one wins).

### Custom commands

Place Markdown files in `.claude/commands/`:

```markdown
---
description: Run a code review
allowed-tools: Read, Grep, Glob
---

Review the following files: $ARGUMENTS
```

## Limitations

- Not available on the free plan (requires a Pro, Max, Team, Enterprise, or Console account, or a third-party provider such as Bedrock / Vertex / Foundry)
- Prompt submission pauses temporarily once the rate limit is reached
- Only native installations auto-update; Homebrew, WinGet, and Linux package manager installs need a manual upgrade (or `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1` for Homebrew / WinGet)
- Sandboxing is unsupported on native Windows and WSL 1

## System requirements

- macOS 13.0+, Windows 10 1809+ / Windows Server 2019+, Ubuntu 20.04+ / Debian 10+, Alpine Linux 3.19+
- RAM: 4 GB or more; x64 or ARM64 processor
- Shell: Bash, Zsh, PowerShell, or CMD
- On native Windows, Git for Windows is optional — without it Claude Code uses the PowerShell tool instead of the Bash tool
