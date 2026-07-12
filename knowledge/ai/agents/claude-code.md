---
reviewed: 2026-07-12
tags: [ai-agent, ai-workflow, commercial]
aliases: [cc]
---

# Claude Code

An AI coding agent CLI from Anthropic. In the terminal, the agent autonomously understands and edits the codebase, performs Git operations, and runs commands. As of 2026-07-12 the latest stable release is **v2.1.207** (2026-07-11); from that version, Auto mode is available without opt-in on Amazon Bedrock, Google Cloud's Agent Platform (Vertex), and Microsoft Foundry.

## Installation

```bash
# Native installer (recommended - auto-update support, no Node.js required)
curl -fsSL https://claude.ai/install.sh | bash    # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex           # Windows PowerShell
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd  # Windows CMD

# Homebrew (no auto-update)
brew install --cask claude-code          # stable channel
brew install --cask claude-code@latest  # latest channel (as of v2.1.195)

# WinGet
winget install Anthropic.ClaudeCode

# npm (deprecated)
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
| `/plugins` | Plugin manager UI |
| `/color` | Assign a random UI color per session |

`claude agents` (direct CLI invocation, v2.1.139+ Research Preview) launches the agent view.

Custom commands can be defined as Markdown files in `.claude/commands/`.

## Configuration files

| Path | Purpose | Git managed |
|---|---|---|
| `~/.claude.json` | User-scoped settings | - |
| `CLAUDE.md` | Project-specific instructions | Yes |
| `.claude/settings.json` | Project-specific settings | Yes |
| `.claude/rules/` | Additional rule files | Yes |
| `.claude/commands/` | Custom slash commands | Yes |
| `.claude/agents/` | Subagent definitions | Yes |

### Environment variables

- `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` - Disables fullscreen mode, keeping native scrolling.
- `CLAUDE_CODE_SESSION_ID` - Exposes the session ID for reference (for hooks).

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
| Async | `Notification`, `CwdChanged`, `FileChanged`, `InstructionsLoaded`, `ConfigChange` |
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

`model` can be an alias such as `sonnet` / `opus` / `haiku`, an explicit ID like `claude-sonnet-4-6` / `claude-opus-4-8`, or `inherit` (inherit from the parent session).

| Field | Description |
|---|---|
| `name` | Agent identifier (required) |
| `description` | Used to determine automatic delegation (required) |
| `model` | Model to use (`inherit` to inherit from the parent session) |
| `tools` | Allowed tools (comma- or space-separated) |
| `disallowedTools` | Denied tools |
| `permissionMode` | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` |
| `maxTurns` | Maximum number of turns |
| `skills` | Skills to preload |
| `mcpServers` | Available MCP servers |
| `hooks` | Hooks active within this agent |
| `memory` | `user` / `project` / `local` - persisted to `<scope>/agent-memory/<name>/` |
| `isolation` | `worktree` isolates into a Git worktree |
| `background` | `true` to launch asynchronously |
| `effort` | Depth of reasoning |
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
| `Explore` | Haiku-based. Fast, read-only code exploration |
| `Plan` | Inherits the parent model, read-only. Builds an implementation plan |
| `general-purpose` | General-purpose delegation target |
| `statusline-setup` | Interactive status-line configuration |
| `claude-code-guide` | Answers questions about Claude Code features |

As of v2.1.63, the old `Task` tool has been renamed `Agent` (the alias remains).

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
| `keep-coding-instructions` | If `true`, keeps Claude Code's default coding instructions |

**How to select**:

- `/config` -> Output style -> select from menu
- Edit the `outputStyle` field in `settings.json` (effective from the next session)

**Built-in styles**: `Default` / `Explanatory` (adds educational asides) / `Learning` (collaborative mode with `TODO(human)` markers).

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

- Not available on the free plan
- Prompt submission pauses temporarily once the rate limit is reached
- Anything other than the native installer (npm) is deprecated

## System requirements

- macOS 10.15+, Ubuntu 20.04+ / Debian 10+, Windows 10+ (WSL / Git Bash)
- RAM: 4 GB or more (8 GB recommended)
- Shell: Bash, Zsh, Fish
