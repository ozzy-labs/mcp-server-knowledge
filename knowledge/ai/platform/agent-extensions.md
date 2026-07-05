---
reviewed: 2026-07-05
tags: [ai-workflow, methodology]
---

# AI Agent Extension Mechanisms (Skills / Subagents / Hooks / Plugins)

As of 2026, the four major coding-agent CLIs — Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI — have converged on a nearly common mental model for **extension mechanisms**. This article compares them across CLIs. For individual CLI specifications, see `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`.

## The 4 extension mechanisms

Every modern agent CLI is extended through the following four layers.

| Layer | Purpose | Typical location |
|---|---|---|
| **Skills** | A bundle of prompt + context "to read when this kind of task comes up" | `.agents/skills/<name>/SKILL.md` (open standard) |
| **Subagents (Custom agents)** | Definitions of specialized agents that run in independent context | `.<cli>/agents/<name>.md` |
| **Hooks** | Shell scripts hooked into tool execution / session events | `hooks.json` / the `hooks` section of the config file |
| **Plugins / Extensions** | Packages that bundle and distribute the above | Plugin marketplaces |

These are complementary. **Skills are "reusable task prompts invoked on demand," Subagents are "persistent agent definitions to delegate to," Hooks are "event-driven automation," and Plugins are "the distribution unit for all of it."**

## Open standards: `AGENTS.md` and Agent Skills

As of early 2026, two common standards are established.

- **`AGENTS.md`**: A common file for project guidance. Standardized by the Agentic AI Foundation under the Linux Foundation. All 4 CLIs support it (Claude Code primarily uses `CLAUDE.md` but also reads `AGENTS.md`). See `ai/platform/agents-md.md` for details
- **Agent Skills (`SKILL.md`)**: A common format for skill definitions. `name` / `description` are required frontmatter. All 4 CLIs — Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI — load it

As a result, **a single `SKILL.md` is portable across agents** (only `name` / `description` are required, and each tool ignores frontmatter it does not recognize). But the storage location is not universal: `.agents/skills/` is discovered by **Codex CLI / Gemini CLI / GitHub Copilot CLI**, whereas **Claude Code reads only `.claude/skills/`** — to share a skill with Claude Code, add a `.claude/skills/` copy/symlink or ship it as a plugin. See [`agent-skills-distribution.md`](agent-skills-distribution.md).

## Skills cross-comparison

| Item | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Project path | `.claude/skills/` | `.agents/skills/` | `.gemini/skills/` or `.agents/skills/` | `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Personal path | `~/.claude/skills/` | `~/.agents/skills/` | `~/.gemini/skills/` | `~/.copilot/skills/` etc. |
| Management command | Within the `/plugin` UI | `/skills` | `/skills list\|link\|disable\|enable\|reload` | `/skills list\|info\|reload\|remove` |
| Auto-trigger | Automatic on `description` match | `$skill-name` mention + implicit | `activate_skill` tool (user confirmation) | Inference-based |

**Note**: GitHub Copilot CLI is designed to also support `.claude/skills/` and `.agents/skills/` simultaneously, allowing it to **interoperate with other CLIs' skills**.

### Standard SKILL.md frontmatter

```markdown
---
name: code-review
description: Review code for best practices and security. Use when reviewing PRs.
allowed-tools: Read Grep Glob
---

When reviewing code, check the following:
- Security vulnerabilities
- Performance issues
```

`name` and `description` are required. `allowed-tools` is commonly supported by many CLIs. Claude Code has its own `when_to_use` / `argument-hint` / `paths` / `hooks` / `effort` / `context: fork`, etc.; Copilot CLI has its own `license`; Codex CLI has its own `agents/openai.yaml`.

### Progressive disclosure

Across all 4 CLIs, **only the `description` is resident at startup**, and the body is loaded once triggered. This keeps the context footprint low even as the number of skills grows. See `ai/practice/ai-context-management.md` for details.

## Subagents cross-comparison

| Item | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Project path | `.claude/agents/<name>.md` | `.codex/agents/` | `.gemini/agents/` | `.github/agents/<name>.agent.md` |
| Personal path | `~/.claude/agents/` | `~/.codex/agents/` | `~/.gemini/agents/` | `~/.copilot/agents/` |
| Trigger model | Auto-delegation + `/agents` + Agent tool | **Explicit spawn only** | Auto-delegation + forced `@name` | `/agent` + `--agent` + inference |
| Required frontmatter | `name`, `description` | `name`, `description`, `developer_instructions` | `name`, `description` | `description` (`name` is optional) |
| Model inheritance | `inherit` | Model must be specified | `inherit` allowed | Model can be specified |
| Recursive invocation | Possible via the `Agent` tool | Controlled via `max_depth` (default 1) | **Not possible** | Unspecified |

**Note the difference in trigger models**: Codex CLI subagents **spawn only when the user explicitly requests it**. This is a different design philosophy from Claude Code's auto-delegation.

### Principles for delegation decisions

- Broad exploration scope (grepping/reading many files) → delegate
- Many failures requiring trial and error → delegate (avoids polluting the parent context)
- Result is small and faster to do directly in the parent → don't delegate

See the subagent section of `ai/practice/ai-context-management.md` for details.

## Hooks cross-comparison

| Item | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Number of events | ~29 | 10 | 12 | 13 |
| Configuration location | `hooks` in `settings.json` | `~/.codex/hooks.json` / `<repo>/.codex/hooks.json` | `hooks` in `settings.json` | `.github/hooks/*.json` (or `hooks.json` in CWD) |
| Enabled by | Default | Default (disable via `[features] hooks = false`; `codex_hooks` is a deprecated alias) | Default | Default |
| Decision return | `hookSpecificOutput.permissionDecision` (`allow`/`deny`/`ask`/`defer`) | exit 2 or permissionDecision | exit 2 = block | permissionDecision only for `preToolUse` |
| Handler types | `command` / `http` / `prompt` / `agent` / `mcp_tool` | `command` | `command` | `command` (`bash`/`powershell`) |

### Common core events

Core events supported by all 4 CLIs:

- **SessionStart / SessionEnd**: Hooks at startup/shutdown
- **PreToolUse**: Before tool execution (opportunity to allow/deny)
- **PostToolUse**: After tool execution (result verification)
- **UserPromptSubmit**: Immediately before the user's utterance

Events that Claude Code has particularly fleshed out (other CLIs have some equivalents):

- `WorktreeCreate` / `WorktreeRemove` / `TeammateIdle` / `InstructionsLoaded` / `CwdChanged` / `FileChanged` / `ConfigChange` / `Elicitation` / `ElicitationResult`, etc. — Claude Code specific
- `SubagentStart` / `SubagentStop` also exist in Codex CLI / Copilot CLI; `PreCompact`-family events are also present in Codex (`PreCompact` / `PostCompact`), Gemini (`PreCompress`), and Copilot (`preCompact`)

### Where to use hooks

- **Deny destructive commands in PreToolUse** (inspecting `rm -rf`, `git push --force`)
- **Auto-formatter in PostToolUse** (running prettier / biome after an edit)
- **Secret scanning in SessionStart** (checking for already-committed secrets with Gitleaks)
- **Evacuate important information to memory in PreCompact** (Claude Code only)

See each CLI's article for details.

## Plugins / Extensions cross-comparison

| Item | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Manifest | `.claude-plugin/plugin.json` | Plugin marketplace (added early 2026) | `gemini-extension.json` | `plugin.json` |
| What can be bundled | skills / agents / hooks / commands / MCP / monitors | skills / agents / MCP | commands / hooks / skills / agents / policies / themes / MCP | agents / skills / hooks / MCP / LSP |
| Installation | `/plugin install <name>` | `/plugins` (interactive browser) | `gemini extensions install <github-url>` | `/plugin install owner/repo` |
| Namespacing | `plugin-name:skill-name` | `<plugin>@<marketplace>` (e.g. `gmail@openai-curated`) | `<extension>.<command>` on name collision | Repository-name based |

**Security constraints**:

- **Claude Code**: Subagents provided by plugins do not support `hooks` / `mcpServers` / `permissionMode` (to prevent privilege-escalation attacks)
- **Gemini CLI**: Fingerprints project hooks and warns when they change

## MCP (Model Context Protocol) integration

All CLIs natively integrate MCP servers. This is **the external-resource-connection facet of the extension mechanism**. See `ai/platform/mcp-protocol.md` for details.

| CLI | Configuration location | Scope |
|---|---|---|
| Claude Code | `~/.claude.json` (user) / `.mcp.json` (project) / `settings.local.json` (local) | Local > Project > User |
| Codex CLI | `[mcp_servers.<id>]` in `~/.codex/config.toml` | - |
| Gemini CLI | `mcpServers` in `settings.json` | Project > User |
| Copilot CLI | `~/.copilot/mcp-config.json` / `.mcp.json` / `.github/mcp.json` | - |

## Feature support matrix

| Feature | Claude Code | Codex CLI | Gemini CLI | Copilot CLI |
|---|---|---|---|---|
| AGENTS.md | Yes (CLAUDE.md takes priority) | Yes | Yes | Yes |
| Skills (open standard) | Yes | Yes | Yes | Yes |
| Subagents | Yes (auto-delegation) | Yes (explicit only) | Yes (auto + @) | Yes (multiple methods) |
| Hooks | ~29 events | 10 events | 12 events | 13 events |
| Plugins / Extensions | Yes (mature) | Yes (marketplace) | Yes (Extensions) | Yes |
| MCP | Yes | Yes | Yes | Yes |
| Custom slash commands | Integrated into Skills | Deprecated (Skills recommended) | `.toml`-based | Via plugins |
| Output styles | Yes | No | No | No |
| Status line | Yes | No | No | No |

## Differences in auto-trigger conditions

**When an agent fires Skills / Subagents** differs by CLI design philosophy.

- **Claude Code**: Aggressively auto-delegates by matching `description` text. Controlled via `disable-model-invocation: true` / `user-invocable: false`
- **Codex CLI**: Subagents are designed to **spawn only when the user explicitly requests it**. Skills have some implicit triggering but are conservative
- **Gemini CLI**: Skills require user confirmation via the `activate_skill` tool. Subagents use auto-delegation + forced `@name`
- **Copilot CLI**: Inference-based auto-triggering. Explicit selection also possible via `/agent`

This difference is a tradeoff between **context pollution and security**. Auto-triggering is convenient, but carries the risk of a malicious skill being invoked via prompt injection (see `ai/practice/prompt-injection.md`).

## Common mistakes AI agents make

1. **Confusing skills with subagents** — A skill is a "task prompt"; a subagent is "an independent context to delegate to." A skill only runs in a child agent once `context: fork` is specified
2. **Mistaking `allowed-tools` for a deny list** — It is merely a whitelist that skips the permission confirmation. Prohibitions must be made explicit via `disallowed-tools` / `denyTools`, etc.
3. **Confusing directory paths between CLIs** — GitHub Copilot CLI's custom agents live in `.github/agents/` (not `.agents/`), with the extension `.agent.md`
4. **Writing `skip-tools` for Claude Code subagents** — The correct key is `disallowedTools`. This typo persists in older documentation
5. **Confusing exit 2 with exit 1 in hooks** — In many CLIs, exit 2 means "block," while exit 1 means "error exit but does not block"
6. **Forgetting the plugin namespace** — A Claude Code plugin skill must be invoked as `plugin-name:skill-name`

## References

- [Agent Skills open standard](https://agentskills.io/)
- [AGENTS.md](https://agents.md/)
- This repository's `ai/platform/agents-md.md` — common instruction files
- This repository's `ai/practice/ai-context-management.md` — context design
- This repository's `ai/practice/prompt-injection.md` — security of extension mechanisms
- This repository's `ai/practice/multi-agent-repo.md` — designing repositories for multiple agents
