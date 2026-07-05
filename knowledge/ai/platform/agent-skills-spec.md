---
reviewed: 2026-06-07
tags: [ai-platform, standards, specification]
---

# Agent Skills Standard Specification (`SKILL.md`)

An open standard format for providing AI agents with specialized knowledge and task procedures on demand. As of 2026, it has been adopted by the four major CLIs — Claude Code, Codex CLI, Gemini CLI, and GitHub Copilot CLI — allowing a skill defined once to be shared across multiple agents.

## Design Philosophy: Progressive Disclosure

Rather than loading all instructions (context) at agent startup, this mechanism **loads only what is needed, when it's needed**.

1. **Discovery**: At startup, only each skill's `description` is loaded (to conserve context).
2. **Activation**: When a user's request matches a `description`, the agent activates (or proposes) the skill.
3. **Execution**: The full text of the activated skill (`SKILL.md`) is loaded, and resources within `scripts/` / `references/` / `assets/` are loaded on demand as needed.

Spec guidelines: metadata of about 100 tokens (always resident), body recommended under 5000 tokens (`SKILL.md` within 500 lines), resources loaded only when referenced.

## Directory Structure

A skill is organized as a self-contained directory. The directory name becomes the default skill name.

```text
.agents/skills/my-skill/
├── SKILL.md               # (required) metadata and instructions
├── scripts/               # (optional) skill-specific executable scripts
├── references/            # (optional) static documentation, schema definitions
└── assets/                # (optional) templates, binaries
```

## SKILL.md Specification

Composed of YAML frontmatter and a Markdown body.

```markdown
---
name: skill-identifier      # skill name (kebab-case recommended)
description: |              # the key to discovery. Describe specifically when and why to use it
  The problem this skill solves, and the trigger conditions under which the agent should activate it.
allowed-tools: Read Grep    # (optional) tools that skip approval (space-separated string. Experimental)
---

# Instructions
This section describes the specific steps, constraints, persona, and how to use tools
in `scripts/` that the agent should follow once the skill is active.
```

### Key Fields

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Unique identifier of the skill. Max 64 characters, lowercase alphanumerics and hyphens only, must match the parent directory name. |
| `description` | **Yes** | **Most important.** Max 1024 characters. Used for automatic delegation and `activate_skill` decisions. |
| `license` | No | The license name applied to the skill, or a reference to a bundled LICENSE file. |
| `compatibility` | No | Max 500 characters. Requirements for the operating environment (target products, required packages, network requirements, etc.). |
| `metadata` | No | An arbitrary key-value mapping (e.g. `author` / `version`). Used to store properties outside the spec. |
| `allowed-tools` | No | A **space-separated string** of tools permitted to run without user confirmation (e.g. `Bash(git:*) Read`). **Experimental**, with differing support across implementations. |

## Discovery Tiers

**Note**: The Agent Skills specification defines only the contents of `SKILL.md` (format and fields), and does **not** specify skill storage locations. The tiers below and the `.agents/skills/` family of paths are a **cross-client convention** derived from client implementation guides, coexisting with each CLI's own paths (e.g. `.claude/skills/`).

Agents typically scan the following scopes:

1. **Built-in**: Standard skills built into the CLI (bundled with the deployment artifact).
2. **User**: `~/.agents/skills/` (shared across all projects) plus client-specific `~/.<client>/skills/`.
3. **Project (Workspace)**: `<project>/.agents/skills/` (project-specific) plus client-specific `<project>/.<client>/skills/`.

`.agents/skills/` is a common convention for making skills interoperable across clients. **On a name collision, the project level overrides the user level** — a rule shared across implementations.

## References

- [Agent Skills Open Standard](https://agentskills.io/)
- Related: `ai/platform/agent-extensions.md` (comparison of support across CLIs)
