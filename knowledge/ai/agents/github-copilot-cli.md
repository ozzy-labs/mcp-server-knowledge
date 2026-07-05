---
reviewed: 2026-06-28
tags: [ai-workflow, commercial, github]
aliases: [copilot]
---

# GitHub Copilot CLI

An AI coding agent CLI provided by GitHub. Deeply integrated with GitHub accounts, it autonomously handles planning, execution, testing, and review. GA on 2026-02-25.

## Installation

```bash
# Shell script (recommended)
curl -fsSL https://gh.io/copilot-install | bash
# VERSION / PREFIX env vars let you pin a version / install location

# Homebrew
brew install copilot-cli
brew install copilot-cli@prerelease     # prerelease channel

# npm
npm install -g @github/copilot
npm install -g @github/copilot@prerelease

# WinGet
winget install GitHub.Copilot
winget install GitHub.Copilot.Prerelease
```

Shell completion for bash / zsh / fish is auto-installed on first launch (v1.0.41+). It can also be fetched manually via the `copilot completion <bash|zsh|fish>` subcommand (v1.0.37).

## Authentication

Authenticate via OAuth device flow or a GitHub Personal Access Token (PAT).

## Basic commands

```bash
copilot                                  # start an interactive session
copilot --experimental                   # enable experimental features
copilot -C <dir>                         # change working directory before launch (v1.0.42)
copilot --attachment <file>              # attach a file in prompt mode (v1.0.41)
copilot --max-autopilot-continues <n>    # cap on autopilot's consecutive continuations (default 5, v1.0.40)
copilot --resume                         # resume a past session from a picker (-r shorthand, v1.0.60)
copilot completion <bash|zsh|fish>       # print shell completion script
```

## In-session commands

| Command | Description |
|---|---|
| `/help` | Show help (slash commands support tab completion) |
| `/model` | Switch model (Auto mode selects the optimal model server-side). Supports model-family aliases `opus` / `sonnet` / `haiku` / `gpt` / `gemini` (v1.0.64) |
| `/experimental` | Enable experimental features (rubber duck, agents, etc.) |
| `/remote on/off` | Toggle remote control from GitHub.com or the mobile app |
| `/statusline` | Customize the status line display (username, etc.) |
| `/usage` | Show quota usage |
| `/env` | List environment variables |
| `/compact` | Manually compact context (can pass a focus instruction to steer the summarization policy). In-flight messages are auto-queued |
| `/context` | Show context window usage, custom instructions, and per-MCP-server token cost breakdown |
| `/model` | Switch the active model |
| `/mcp` | List configured MCP servers |
| `/agent <name>` | Launch a custom agent |
| `/skills` | List/manage skills (`list` / `info` / `reload` / `remove`). `/skill` alias added (v1.0.65) |
| `/lsp` | Show LSP server status |
| `/diff` | Review a change diff |
| `/undo` | Undo the last operation |
| `/remote` | Show remote session info (`on` / `off` toggle) |
| `/keep-alive` | Keep the session running in the background (no experimental flag needed as of v1.0.36) |
| `/fleet` | Break a complex request into subtasks and run them in parallel via subagents (added v1.0.32) |
| `/chronicle` | Session history review / standup (added v1.0.31, experimental) |
| `/research` | Research assistant (added v1.0.41; uses orchestrator/subagent models) |
| `/pr` | Create/reference a PR (added v1.0.40) |
| `/autopilot` | Toggle between interactive and autopilot modes (added v1.0.45). `/autopilot <objective>` (alias `/goal`) pins an objective (v1.0.55) |
| `/security-review` | Security vulnerability review of code changes (added v1.0.51; GA without `--experimental` as of v1.0.64) |
| `/memory` | Enable/disable/show status of Copilot Memory (`on` / `off` / `show`, added v1.0.49; persistent) |
| `/rubber-duck` | Get an independent critique of your work from the rubber-duck agent (added v1.0.49; enabled by default as of v1.0.58) |
| `/every` / `/after` | Scheduled prompt execution (added v1.0.58, experimental). Has a `/loop` alias |
| `/fork [name]` | Fork the current session into an independent new session (added v1.0.45; optional name and origin display added v1.0.47). `/branch` alias added (v1.0.64, aligned with Claude Code) |
| `/session` | Session management (`delete` / `delete-all`, name via `--name`) |
| `/plugin` | Plugin management (`install` / `list` / `remove`) |
| `/subagents` / `/agents` | List/configure subagents (model / reasoning effort / context tier, added v1.0.62) |
| `/cd` | Change working directory (persisted across resume as of v1.0.65; also discovers custom agents in the new directory) |
| `/diagnose` | Analyze session logs (added v1.0.64) |
| `/app` | Open the GitHub app / browser (added v1.0.62) |
| `/theme` | Theme selection (default / dim / high-contrast / colorblind) |
| `/settings` | View/change settings inline |
| `/clear` / `/new` | Reset the conversation (also resets the active agent selection) |
| `/bug` / `/feedback` | Feedback / bug report |
| `/release-notes` | Show release notes |
| `/export` | Export the session |
| `/reset` | Reset settings |
| `/version` | Show version |
| `/update` | Update the CLI (download progress shown as of v1.0.43; optional `prerelease` argument added v1.0.44) |
| `/exit` | End the session |

## Configuration files

| Path | Purpose | Git-tracked |
|---|---|---|
| `~/.copilot/settings.json` | User settings (split out from `config.json` in v1.0.35) | - |
| `~/.copilot/config.json` | CLI internal state (auto-managed) | - |
| `~/.copilot/mcp-config.json` | Global MCP server config | - |
| `~/.copilot/lsp-config.json` | Global LSP config | - |
| `~/.copilot/copilot-instructions.md` | Personal global instructions (applies to all projects) | - |
| `~/.copilot/instructions/*.instructions.md` | Personal global additional instructions (v1.0.12+, auto-loaded) | - |
| `~/.copilot/agents/<name>.agent.md` | User custom agent | - |
| `~/.copilot/skills/<name>/SKILL.md` | User skill | - |
| `AGENTS.md` | Project-specific instructions (read from repo root / CWD / directories specified via `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`) | Yes |
| `.github/instructions/**/*.instructions.md` | Project additional instructions (auto-loaded) | Yes |
| `.github/agents/<name>.agent.md` | Project custom agent | Yes |
| `.github/skills/<name>/SKILL.md` | Project skill (also reads `.claude/skills/` / `.agents/skills/`) | Yes |
| `.github/hooks/hooks.json` | Project hooks | Yes |
| `.github/lsp.json` | Project LSP config | Yes |
| `.mcp.json` | Project MCP (v1.0.22 dropped support for `.vscode/mcp.json` / `.devcontainer/devcontainer.json` and standardized on `.mcp.json`; shows a migration hint when those are detected) | Yes |
| `.github-private/.github/copilot/settings.json` | Enterprise-managed plugin definitions (public preview 2026-05-06) | Yes |
| `.github/copilot-instructions.md` | Custom instructions (legacy) | Yes |

The `COPILOT_HOME` environment variable can change the config directory.

## Key features

- **Autopilot mode**: An autonomous plan/execute/test/fix loop. Toggle with `/autopilot` (v1.0.45)
- **Server-side model routing**: In Auto mode, the optimal model is chosen in real time server-side
- **Auto-approval of read-only `gh`**: As of v1.0.46, read-only `gh` subcommands like `list` / `view` / `status` / `diff` run without a prompt
- **OpenTelemetry**: Aligned with GenAI semantic conventions in v1.0.45; MCP tool calls use the standard `tool_call` span, and the `gen_ai.client.operation.duration` metric measures tool execution time
- **Remote control**: Monitor and operate CLI sessions from a browser or mobile app
- **Tabbed terminal UI**: A new terminal interface went GA on 2026-06-23. Shows Session / Gists tabs at the top, and Issues / Pull requests tabs inside a repository. Theme switching via `/theme` (default / dim / high-contrast / colorblind). GitHub theme and the home tab are enabled by default for all users as of v1.0.64
- **LSP integration**: Leverages type information via integration with servers such as TypeScript Language Server
- **MCP integration**: Integration with Model Context Protocol servers
- **Rubber Duck agent**: Independent critique of your work. Enabled by default as of v1.0.58 (controlled via `builtInAgents.rubberDuck` / `builtInAgents.rubberDuckAutoInvoke`). Remote JSON RPC also enabled by default as of v1.0.58

## Custom agents

Define at `.github/agents/<name>.agent.md` (project) or `~/.copilot/agents/<name>.agent.md` (user). **The extension must be `.agent.md`.** Scope priority is repository > organization > enterprise.

```markdown
---
name: db-specialist
description: Specialist agent for database operations
tools:
  - shell
  - view
  - edit
model: gpt-5
---

Assists with SQL query optimization and schema design.
```

**Frontmatter**:

| Field | Description |
|---|---|
| `name` | Identifier (defaults to filename) |
| `description` | Purpose (required) |
| `prompt` | System prompt (or write it as the Markdown body, max 30,000 characters) |
| `tools` | Allowed tools. `["*"]` allows all, `[]` denies all |
| `model` | Model to use |
| `disable-model-invocation` | If `true`, disables automatic invocation |
| `user-invocable` | If `false`, disables user invocation |
| `mcp-servers` | Available MCP servers |
| `target` | `vscode` / `github-copilot` / both |

**Invocation**:

```bash
copilot --agent db-specialist --prompt "..."      # CLI flag
/agent db-specialist                               # in-session
```

Triggered automatically based on reasoning, or by naming the agent explicitly in a prompt.

## Skills

Complies with the open `Agent Skills` standard. **Supports multiple directories simultaneously, allowing interoperability with skills from other CLIs.**

| Scope | Directories (all are read) |
|---|---|
| Project | `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Personal | `~/.copilot/skills/` / `~/.agents/skills/` |

**SKILL.md frontmatter**:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | lowercase+hyphens. **Must match the directory name**; a mismatch means it won't be loaded |
| `description` | Yes | Key for discovery |
| `allowed-tools` | - | Skip permission confirmation |
| `license` | - | License notice |

**Management commands**: `/skills list | info | reload | remove` (`/skill` alias, v1.0.65). The `copilot skill` subcommand can list/add/remove skills from a file / URL / directory (v1.0.65). As of 2026-04, they can also be managed via GitHub CLI using the `gh skill` subcommand.

## Hooks

`.github/hooks/*.json` (repo) or a `hooks.json` in the CWD.

**Supported events** (both PascalCase and camelCase):

| Event | Description |
|---|---|
| `sessionStart` | Session start |
| `sessionEnd` | Session end |
| `userPromptSubmitted` | Right before a user utterance. As of v1.0.44 can bypass the LLM call and return a response directly |
| `preToolUse` | Before tool execution. Can return `permissionDecision: allow\|deny\|ask` |
| `postToolUse` | After tool execution |
| `postToolUseFailure` | When a tool error occurs (added v1.0.15) |
| `permissionRequest` | Allows programmatic approval from a script (added v1.0.16) |
| `preMcpToolCall` | Controls metadata of the outgoing MCP request (added v1.0.51) |
| `subagentStart` | On subagent spawn (added v1.0.7) |
| `agentStop` / `subagentStop` | Controls agent termination (added v1.0.22) |
| `preCompact` | Right before context compaction (added v1.0.5) |
| `notification` | Async notification (added v1.0.18) |
| `errorOccurred` | On error (generic) |

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "./scripts/guard.sh", "timeoutSec": 30 }
    ]
  }
}
```

Both `bash` / `powershell` keys are supported. `timeoutSec` defaults to 30 seconds.

## Plugins

Place a `plugin.json` at the root to bundle and distribute agents, skills, hooks, MCP, and LSP together.

```text
my-plugin/
├── plugin.json
├── agents/<name>.agent.md
├── skills/<name>/SKILL.md
├── hooks/hooks.json
├── .github/mcp.json
└── lsp.json
```

**Installation**:

```bash
/plugin install owner/repo        # GitHub repository
copilot plugin install ./path     # local
```

## Agent integration

### Instruction files

Files that are loaded:

- **Personal global**: `~/.copilot/copilot-instructions.md` — applies to all projects
- **Project**: `AGENTS.md` — repository root / CWD / directories specified via the `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` env var (comma-separated)
- **Additional**: `.github/instructions/**/*.instructions.md` — auto-loaded, including under `COPILOT_CUSTOM_INSTRUCTIONS_DIRS`

These are automatically loaded by Copilot CLI.

### Registering MCP servers

Add to `~/.copilot/mcp-config.json` (global):

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

It can also be added temporarily via a CLI flag:

```bash
copilot --additional-mcp-config @/path/to/config.json
```

## Pricing plans

Available on all GitHub Copilot plans:

- Free (basic features)
- Pro / Pro+
- Business / Enterprise

## Limitations

- A GitHub account is required
- When using GHES (GitHub Enterprise Server), `GH_HOST` must be configured

## System requirements

- macOS, Linux, Windows
- GitHub account + Copilot plan
