---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial, github]
aliases: [copilot]
---

# GitHub Copilot CLI

An AI coding agent CLI provided by GitHub. Deeply integrated with GitHub accounts, it autonomously handles planning, execution, testing, and review. GA on 2026-02-25; the current release is **v1.0.80** (2026-08-14).

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

Authenticate via OAuth or a GitHub Personal Access Token (PAT). As of v1.0.77 the **browser-based (web) OAuth flow is the default** for `copilot login` on local interactive terminals (including IDE integrations and local desktop subprocesses without a TTY, v1.0.78); device code remains the default on remote / headless terminals. Force either mode with `--web-flow` / `--device-code`, or pick one in `/login`.

## Basic commands

```bash
copilot                                  # start an interactive session
copilot --experimental                   # enable experimental features
copilot -C <dir>                         # change working directory before launch (v1.0.42)
copilot --attachment <file>              # attach a file in prompt mode (v1.0.41)
copilot --max-autopilot-continues <n>    # cap on autopilot's consecutive continuations (default 5, v1.0.40)
copilot --resume                         # resume a past session from a picker (-r shorthand, v1.0.60)
copilot --plan --mode autopilot          # plan first, then implement without approval (v1.0.79)
copilot --worktree                       # start in a new git worktree (from HEAD as of v1.0.79)
copilot login --web-flow                 # force browser OAuth (--device-code forces device flow, v1.0.77)
copilot completion <bash|zsh|fish>       # print shell completion script
```

## In-session commands

| Command | Description |
|---|---|
| `/help` | Show help (slash commands support tab completion) |
| `/model` | Switch model (Auto mode routes server-side by task and gives a **10% AI-credit discount**). Model-family aliases `opus` / `sonnet` / `haiku` / `gpt` / `gemini` (v1.0.64). **Session-scoped by default as of v1.0.79** — use `/config model` to set defaults for future sessions; `-s` / `--session` added v1.0.72, and `/model plan` (`--plan`) picks a plan-mode-only model (v1.0.74). The picker groups models into Recent / Recommended / New with Shift+Tab (v1.0.79). Current models span GPT-5.6 (Luna/Sol/Terra), Claude Opus 5 (v1.0.75) / Sonnet 5 / Opus 4.8 (+ 4.8 Fast), Gemini 3.6 Flash (v1.0.74) and 3.5 Flash, grok-4.5 (v1.0.76), and kimi-k3 (v1.0.79) / kimi-k2.7-code |
| `/refine` | Rewrite a rough prompt into clear instructions (v1.0.70) |
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
| `/autopilot` | Toggle between interactive and autopilot modes (added v1.0.45). `/autopilot <objective>` (alias `/goal`) pins an objective (v1.0.55). Autopilot stays selected after `task_complete` by default as of v1.0.76 (set `stayInAutopilot` to `false` to return to interactive) |
| `/security-review` | Security vulnerability review of code changes (added v1.0.51; GA without `--experimental` as of v1.0.64) |
| `/memory` | Enable/disable/show status of Copilot Memory (`on` / `off` / `show`, added v1.0.49; persistent) |
| `/rubber-duck` | Get an independent critique of your work from the rubber-duck agent (added v1.0.49; enabled by default as of v1.0.58) |
| `/every` / `/after` | Scheduled prompt execution (added v1.0.58, experimental). Has a `/loop` alias |
| `/fork [name]` | Fork the current session into an independent new session (added v1.0.45; optional name and origin display added v1.0.47). `/branch` alias added (v1.0.64, aligned with Claude Code) |
| `/session` | Session management (`delete` / `delete-all`, name via `--name`) |
| `/plugin` / `/plugins` | Plugin management (`install` / `list` / `remove`); the `/plugins` dashboard (v1.0.69) manages installed plugins and reloads extensions without a session restart. v1.0.71 added `plugins marketplace` (list / add / remove / browse / update), v1.0.72 added `update` / `uninstall` verbs plus `--plugin` / `--mcp` / `--skill` targeting, and v1.0.76 added enable/disable for plugins, instructions, agents, LSP servers, and hooks |
| `/subagents` / `/agents` | List/configure subagents (model / reasoning effort / context tier, added v1.0.62) |
| `/cd` | Change working directory (persisted across resume as of v1.0.65; also discovers custom agents in the new directory) |
| `/diagnose` | Analyze session logs (added v1.0.64) |
| `/app` | Open the GitHub app / browser (added v1.0.62) |
| `/theme` | Theme selection (default / dim / high-contrast / colorblind). **Deprecated** — color palette settings were consolidated under `/settings theme` in v1.0.66, and `/theme` now prints a deprecation notice (v1.0.79) |
| `/settings` | View/change settings inline |
| `/clear` / `/new` | Reset the conversation (also resets the active agent selection) |
| `/bug` / `/feedback` | Feedback / bug report |
| `/release-notes` | Show release notes |
| `/export` | Export the session |
| `/reset` | Reset settings |
| `/version` | Show version |
| `/update` | Update the CLI (download progress shown as of v1.0.43; optional `prerelease` argument added v1.0.44) |
| `/permissions` | Switch between approval modes (added v1.0.78) |
| `/rewind` | Restore the conversation and/or the files Copilot changed; no longer requires git and skips files whose contents no longer match what Copilot last wrote (v1.0.78) |
| `/worktree` / `/move` | Split in v1.0.71: `/worktree` creates a new worktree and leaves uncommitted changes behind, `/move` carries them into it. `/worktree new` starts a new session in a new worktree and `worktreeBaseRef` controls HEAD vs. remote default branch — all now default to HEAD (v1.0.79). Experimental `/new-worktree` starts a new conversation in one (v1.0.78) |
| `/sandbox` | Sandbox configuration dialog; `/sandbox policy` shows effective paths, denials, and network access (v1.0.79) |
| `/tasks` | Browse subagent tasks — nested tree navigation, current/all and finished filters, and a steerable live timeline (v1.0.79) |
| `/limits` | AI-credit limits; `/limits predict` suggests a session limit based on similar sessions (v1.0.76) |
| `/instructions` | Pick which instruction files load (respects `--no-custom-instructions`, v1.0.76) |
| `/config` | Set defaults for future sessions, e.g. `/config model` (v1.0.79) |
| `/voice` | Voice mode; `/voice devices` chooses and persists the microphone (v1.0.71) |
| `/login` | Choose the OAuth flow interactively (v1.0.77) |
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
| `.github/copilot/settings.json` | Repo-level pinning of model / effort / context tier for a trusted repo (v1.0.70) | Yes |
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
- **Sandbox** (v1.0.67+): An OS-level shell sandbox toggled with `--sandbox` / `--no-sandbox`. A sandbox-policy badge is shown, and `web_fetch` honors the sandbox network policy (proxied when outbound is allowed, denied when `network.allowOutbound` is false, v1.0.76). A first-run splash offers opt-in to the default sandbox (v1.0.74), opt-in git / gh auth runs inside it (v1.0.72), and enterprise admins can enforce a restrictive floor via managed settings and macOS / Windows MDM (v1.0.76-77). Blocked commands offer a re-run outside the sandbox (v1.0.78, Linux in v1.0.79). **Breaking settings-key renames in v1.0.79 with no migration**: `sandbox.gitAuth` / `sandbox.ghAuth` → `sandbox.auth.git` / `sandbox.auth.gh`, and `allowDevToolCaches` → `allowDevToolAccess` (old keys are silently ignored)
- **Repo-level model pinning** (v1.0.70): a trusted repo can pin model / effort level / context tier in `.github/copilot/settings.json`; `/settings` and `/model` gain `--repo` / `--local` flags
- **Plan mode hardening** (v1.0.71+): plan mode hard-blocks built-in tools that would mutate the workspace (MCP and external tools still run); session-folder planning artifacts are allowed as of v1.0.74. `--plan --mode autopilot` plans first, then implements without waiting for approval (v1.0.79)
- **Multi-session UI** (v1.0.76 experimental, GA-by-default surfaces in v1.0.79): manage concurrent sessions from a Sessions tab and sidebar; switching sessions no longer restarts MCP servers or rebuilds hook state (v1.0.78)
- **tgrep** (v1.0.79): large monorepos use trigram-indexed grep instead of ripgrep for regex search
- **Subagents**: default `subagents.maxDepth` lowered from 6 to 4 in v1.0.71 to curb runaway recursion (usage-based-billing users can raise it up to 128); multi-turn subagents are always enabled as of v1.0.72, so follow-up messages can be sent to running agents
- **Tool durations** (v1.0.78): timeline headers show live, right-aligned elapsed time for tool calls lasting at least 5 seconds (`showToolDurations`)

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
| `agentStop` / `subagentStop` | Controls agent termination (added v1.0.22). As of v1.0.72 the CLI ends the turn after 8 consecutive blocks, and hooks receive a `stop_hook_active` flag so they can detect a forced continuation and self-limit |
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

Both `bash` / `powershell` keys are supported. `timeoutSec` defaults to 30 seconds. Hook output is bounded at 10 MiB per invocation, and malformed `userPromptSubmitted` return values are rejected with a warning rather than corrupting the session (v1.0.76).

## Plugins

Place a `plugin.json` at the root to bundle and distribute agents, skills, hooks, MCP, and LSP together. Open Plugin Spec v1 manifests and `mcp.json` configuration are supported as of v1.0.74, and Agent Plugins spec plugins can ship extensions under `com.github.copilot/extensions/` (v1.0.79). First-party plugins auto-update at session start (v1.0.78); set `"autoUpdate": true` on an `extraKnownMarketplaces` entry to auto-update its plugins too (v1.0.79).

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
