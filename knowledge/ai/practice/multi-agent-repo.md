---
reviewed: 2026-06-07
tags: [ai-workflow, methodology]
---

# Designing a Multi-Agent-Compatible Repository

Design guidance for making a single repository usable by Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI alike. For the specification of the extension mechanism itself, see `ai/platform/agent-extensions.md`; for the shared instruction file, see `ai/platform/agents-md.md`.

## Design Goals

| Goal | Approach |
|---|---|
| DRY instructions | `AGENTS.md` as the single source of truth. CLI-specific files hold only the diff |
| Skill reuse | Place in `.agents/skills/` so multiple CLIs can discover them |
| Consistent hooks | Call common shell scripts, referenced from each CLI's hooks.json |
| Team sharing | Share project scope via Git; leave user scope to individuals |
| Easy support for new CLIs | Keep CLI-specific config thin, generic assets thick |

## Recommended Directory Layout

```text
<repo>/
├── AGENTS.md                       # Instructions shared across all CLIs
├── CLAUDE.md                       # Claude Code-specific diff
├── .agents/
│   └── skills/                     # Common skills discovered by 4 CLIs
│       └── <skill-name>/SKILL.md
├── .claude/
│   ├── settings.json               # Claude Code permissions/hooks
│   ├── agents/<name>.md            # Claude Code-specific subagent
│   ├── commands/<name>.md          # Claude Code-specific command
│   └── rules/                      # Additional rules
├── .codex/
│   └── config.toml                 # Codex CLI-specific config
├── .gemini/
│   ├── settings.json               # Gemini CLI-specific config
│   └── commands/<ns>/<cmd>.toml    # Gemini-specific command
├── .github/
│   ├── agents/<name>.agent.md      # Copilot CLI-specific agent
│   ├── hooks/hooks.json            # Copilot CLI hooks
│   └── skills/                     # (optional) Copilot-only skill
├── .mcp.json                       # Project MCP (Claude/Gemini/Copilot)
└── scripts/
    └── hooks/                      # Shared hooks written in shell
        ├── pre-tool-use.sh
        └── post-tool-use.sh
```

**Principles**:

- **Center everything on `.agents/skills/`**. It's the one shared directory readable by all 4 CLIs
- **Keep CLI-specific directories limited to CLI-specific features**. Put generic assets on the shared side
- **`.mcp.json` is named for Claude Code, but Gemini/Copilot can reference similar paths too** — see `ai/platform/mcp-protocol.md` for details

## Splitting Instruction Files

```text
AGENTS.md          ... Project overview / tech stack / key commands / links to conventions
  │
  ├─ CLAUDE.md     ... "See AGENTS.md for shared policy" + Claude-specific skills/hooks notes
  ├─ GEMINI.md     ... Gemini-specific extra context (optional)
  └─ .github/copilot-instructions.md ... Legacy compatibility only
```

**The key to DRY**: at the top of `CLAUDE.md`, redirect with "see AGENTS.md for shared policy," leaving only Claude Code-specific items (list of Skills, output style, status line, etc.). The same technique works equally well for Gemini CLI / Copilot CLI.

## Interoperable Skill Design

### Where to place shared Skills

```text
.agents/skills/code-review/SKILL.md
.agents/skills/release-notes/SKILL.md
```

| CLI | Read behavior |
|---|---|
| Codex CLI | Reads `.agents/skills/` as the **primary location** |
| Gemini CLI | Reads `.gemini/skills/` or `.agents/skills/` |
| Copilot CLI | Reads all of `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Claude Code | By default, only `.claude/skills/` |

**Trick for getting Claude Code to participate**: have Claude Code's `.claude/skills/` reference the shared directory via a symlink.

```bash
ln -s ../../.agents/skills ./.claude/skills
```

> **Note**: On Windows, creating symlinks requires admin privileges or developer mode. As an alternative, use an `mklink /J` junction, or package the shared skill as a plugin for distribution (see the Plugins section of `ai/platform/agent-extensions.md`).

### Writing SKILL.md (common to all 4 CLIs)

```markdown
---
name: code-review
description: Review code for security and best practices. Use when reviewing PRs or changed files.
allowed-tools: Read Grep Glob
---

# Code Review

## Checkpoints
- Security vulnerabilities
- Performance issues
- Test coverage
```

**Commonly usable fields**: `name`, `description`, `allowed-tools`

**Split CLI-specific fields into separate files**:

- Codex CLI-specific: `agents/openai.yaml` (in the same directory)
- Claude Code-specific: `when_to_use` / `argument-hint` / `paths` / `hooks` (ignored by other CLIs)

Mixing CLI-specific fields into SKILL.md **is not fatal since other CLIs simply ignore them**, but if portability matters, stick to the minimal common spec.

## Subagent Design

**Subagents have poor interoperability across CLIs**. Each CLI's directory and frontmatter formats differ, so sharing a single definition isn't realistic.

Recommended approach:

1. **Use Skills instead, wherever they suffice**. Some CLIs (Claude Code) can spawn a child agent from a Skill with `context: fork`
2. **Write a subagent only when CLI-specific capability is actually needed**. Place it individually in each CLI's `agents/` directory
3. **Since the definitions tend to be similar**, one option is to keep a template at `.agents/agents-template/<name>.md` and a generator script that produces the per-CLI version

## Consolidating Hooks

Each CLI's hooks format differs, but **the shell script itself can be shared**.

### Shared shell script

```bash
# scripts/hooks/pre-tool-use.sh
#!/usr/bin/env bash
# The stdin JSON field names differ per CLI (Claude Code uses tool_name;
# Codex / Copilot each use a different schema). Check each CLI's docs for
# the JSON structure it sends before implementing, and adjust branching accordingly.
input=$(cat)
if echo "$input" | jq -e '.tool_name == "Bash" and (.tool_input.command | test("rm -rf"))' > /dev/null; then
  echo '{"permissionDecision": "deny", "reason": "destructive rm blocked"}'
  exit 0
fi
exit 0
```

### Referencing from each CLI

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "bash ./scripts/hooks/pre-tool-use.sh" }
        ]
      }
    ]
  }
}
```

```json
// .github/hooks/hooks.json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "./scripts/hooks/pre-tool-use.sh", "timeoutSec": 30 }
    ]
  }
}
```

**Note**: the stdin JSON schema differs by CLI (e.g., Claude Code uses `tool_name` / `tool_input`). Before actually using this, verify the key names in each CLI's docs and adjust the script accordingly. Also keep in mind that Gemini CLI provides `CLAUDE_PROJECT_DIR` as a compatible environment-variable alias.

## Sharing MCP Configuration

Claude Code reads `.mcp.json`, and other CLIs read similar paths. A single definition for project-scoped MCP can be achieved as follows:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["./node_modules/@your-org/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

Referenced from each CLI's config file:

- Claude Code: reads `.mcp.json` automatically
- Gemini CLI: duplicate the same content in `.gemini/settings.json`'s `mcpServers` (or via `extends`)
- Codex CLI: duplicate the same content in `config.toml`'s `[mcp_servers.knowledge]`
- Copilot CLI: duplicate in `.github/mcp.json` or `~/.copilot/mcp-config.json`

**Auto-sync script**: make `.mcp.json` the single source of truth and prepare a `scripts/sync-mcp.mjs` that generates the configuration for the other CLIs — this eases maintenance.

## Scope Design

```text
┌────────────────────────────────────────┐
│ Enterprise / Managed settings           │ ← Overridden by org policy
├────────────────────────────────────────┤
│ Project (Git-managed, .claude/ / .github/) │ ← Team shared
├────────────────────────────────────────┤
│ Personal (~/.claude/ / ~/.codex/ etc.)  │ ← Individual settings
└────────────────────────────────────────┘
```

| Layer | Contents |
|---|---|
| Project | Project-specific skills, rules, prohibitions, MCP config |
| Personal | Preferred output style, personal helper skills, credentials |
| Managed | Org-wide deny list, enforced hooks |

Put `*.local.json` / `**/secrets/**` in `.gitignore` to keep personal information out of the project layer.

## CI/CD Integration

When multiple people operate an agent repository, check the following in CI:

- `SKILL.md` frontmatter validation (`name` / `description` required)
- Line-count limits on `AGENTS.md` / `CLAUDE.md` (prevent bloat)
- Content consistency between `.mcp.json` and each CLI's config (a byproduct of the sync script)
- Tests for hook scripts (feed mock JSON and verify exit code / output)

Static checks are possible with markdownlint + a runtime validator such as zod.

## A Framework for Adoption Decisions

**You don't need to support every CLI**. It's more realistic to support only the CLIs your team actually uses.

| Team composition | Recommended support |
|---|---|
| Claude Code only | Just `CLAUDE.md` + `.claude/`. `AGENTS.md` is optional |
| Claude Code + Codex CLI | `AGENTS.md` + `CLAUDE.md` + `.agents/skills/` |
| Everyone uses something different | Carefully weigh whether the cost of unification is worth it. At minimum, `AGENTS.md` + shared skills |

**Over-engineering warning**: continuing to write configuration for an unused CLI is pure cost. Support only the CLIs that are actually in use.

## Common Mistakes AI Agents Make

1. **Duplicating the same content in `AGENTS.md` and `CLAUDE.md`** — defeats the purpose of DRY. `CLAUDE.md` should hold only the diff
2. **Placing Skills only in `.claude/skills/`** — other CLIs won't discover them. Use `.agents/skills/` if you want them shared
3. **Forcing a single subagent definition to work across all 4 CLIs** — the formats differ. CLI-specific definitions are fine
4. **Duplicating hooks as whole JSON files, making diff management impossible** — create a shared shell script and reference it from each hooks.json
5. **Manually syncing `.mcp.json` content across CLIs** — configuration drift causes trouble. Write a sync script
6. **Preemptively writing support for a CLI that isn't in use** — increases dead configuration. Add it based on actual demand

## References

- `ai/platform/agent-extensions.md` in this repository — cross-cutting spec for the extension mechanism
- `ai/platform/agents-md.md` in this repository — how to write `AGENTS.md`
- `ai/practice/ai-context-management.md` in this repository — measures against instruction-file bloat
- `ai/platform/mcp-protocol.md` in this repository — MCP server design
- `ai/practice/prompt-injection.md` in this repository — security for Skills / Hooks
