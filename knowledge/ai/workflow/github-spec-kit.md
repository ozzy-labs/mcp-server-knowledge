---
reviewed: 2026-07-12
tags: [ai-workflow, spec, oss, github, cli]
stability: beta
---

# GitHub Spec Kit

An officially GitHub-provided OSS SDD orchestrator. Distributes a Python-based CLI, `specify`, along with a set of slash command / Agent Skill templates for agents. An agent-agnostic orchestrator that can install the **same SDD workflow** across many AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI, Antigravity, OpenCode, Kiro CLI, Forge, Goose, Junie, etc. — **34 integrations** in the official reference as of 2026-07; the README still says 30+). The latest release is **v0.12.11** (2026-07-10).

Official: [github.com/github/spec-kit](https://github.com/github/spec-kit) / Docs: [github.github.io/spec-kit](https://github.github.io/spec-kit/) / Releases: [Releases](https://github.com/github/spec-kit/releases)

For the overall SDD concept, see `ai/practice/spec-driven-development.md`. For comparison with Kiro / cc-sdd, see `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md`.

## Installation

> **Important**: There is a same-named package on PyPI, but it is **not official**. Always install directly from GitHub.

### Persistent install (recommended)

```bash
# Stable release (replace vX.Y.Z with the latest tag)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z

# pipx also works
pipx install git+https://github.com/github/spec-kit.git@vX.Y.Z

# Install main HEAD (includes unreleased changes)
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

### Ephemeral run

```bash
uvx --from git+https://github.com/github/spec-kit.git@vX.Y.Z specify init <PROJECT_NAME>
```

Verify with: `specify version` / `specify check`.

For enterprise / air-gapped installation, see [docs/installation.md](https://github.com/github/spec-kit/blob/main/docs/installation.md#enterprise--air-gapped-installation).

## Basic commands

```bash
# Initialize a new project
specify init <PROJECT_NAME>

# Add to an existing project
specify init . --integration copilot         # GitHub Copilot integration
specify init --here --integration copilot

# Skills mode (install Agent Skills instead of slash commands)
specify init . --integration <agent> --integration-options="--skills"

# Manage agent integrations
specify integration list          # also: search / info / install / uninstall / switch / use / upgrade / status / scaffold
specify integration catalog list  # also: add / remove

# Extension / Preset
specify extension search
specify extension add <name>
specify preset search
specify preset add <name>

# CLI self-management (update the installed specify)
specify self check                 # Check for a new release (read-only)
specify self upgrade --dry-run     # Preview what would happen
specify self upgrade               # Update in place to the latest stable (auto-detects uv tool / pipx)
specify self upgrade --tag vX.Y.Z  # Pin update to a specific tag
```

## SDD workflow

Slash commands (or Agent Skills) get registered on the agent side. Command names use `/speckit.*` (Codex CLI's skills mode uses `$speckit-*`).

### Core Commands

| Command | Skill name | Role |
|---|---|---|
| `/speckit.constitution` | `speckit-constitution` | Write the project's universal principles as a `constitution` |
| `/speckit.specify` | `speckit-specify` | Define what to build (requirements + user stories) |
| `/speckit.plan` | `speckit-plan` | Technical design plan including tech stack |
| `/speckit.tasks` | `speckit-tasks` | Break the plan down into an actionable task list |
| `/speckit.taskstoissues` | `speckit-taskstoissues` | Convert tasks into GitHub Issues |
| `/speckit.implement` | `speckit-implement` | Execute tasks to implement |

### Optional Commands

| Command | Role |
|---|---|
| `/speckit.clarify` | Resolve ambiguous spec areas via a question format (formerly `/quizme`) |
| `/speckit.analyze` | Consistency check across spec / plan / tasks |
| `/speckit.checklist` | Generate a quality checklist equivalent to "unit tests in English" |

### Recommended flow

```text
/speckit.constitution  ← once only
↓
/speckit.specify       ← per feature
↓
/speckit.clarify       ← optional (recommended)
↓
/speckit.plan
↓
/speckit.tasks
↓
/speckit.analyze       ← optional (recommended)
/speckit.checklist     ← optional
↓
/speckit.implement
```

## Directory structure

`specify init` expands templates / extensions / presets / scripts under `.specify/`. Template priority order:

| Priority | Component | Path |
|---:|---|---|
| ⬆ 1 | Project-Local Overrides | `.specify/templates/overrides/` |
| 2 | Presets | `.specify/presets/templates/` |
| 3 | Extensions | `.specify/extensions/templates/` |
| ⬇ 4 | Spec Kit Core | `.specify/templates/` |

At runtime, the first match found top-down is used. Extension / Preset commands are copied into the agent's discovery directory (e.g., `.claude/commands/`) at install time.

## Extensions and Presets

| Type | Role | Key commands |
|---|---|---|
| **Extension** | Adds new commands / new workflows | `specify extension search` / `add` / `remove` / `list` / `info` / `update` / `enable` / `disable` / `set-priority` |
| **Preset** | Overrides templates / terminology of existing commands | `specify preset search` / `add` / `remove` / `list` / `info` / `enable` / `disable` / `set-priority` |

Additionally, `specify extension catalog list/add/remove` manages external catalogs (community repositories, etc.). For the full list, see [Extensions Reference](https://github.github.io/spec-kit/reference/extensions.html) / [Presets Reference](https://github.github.io/spec-kit/reference/presets.html).

Representative Extensions: GitHub Issues sync, Jira integration, MAQA (Multi-Agent QA), V-Model (concurrent generation of test specs), Worktree Isolation, Security Review.

Preset examples: regulatory-compliant spec formats, domain-specific terminology, localization to another language (there's an actual pirate-speak example).

The Community catalog can be searched via [Community Extensions](https://speckit-community.github.io/extensions/).

## Bundles

**Bundles** (debuted 2026-06) are a distribution and composition layer *on top of* the existing primitives — they package extensions / presets / workflows / steps into a single **versioned, role-based installable unit** and add no new runtime behavior. Official example bundles cover four roles: `developer` / `product-manager` / `business-analyst` / `security-researcher` (this is the "persona-based provisioning" in the README's headline).

A `bundle.yml` manifest declares metadata (`id` / `name` / `version` / `role` / `author` / `license`), `requires` (`speckit_version`, tools, MCP servers), and `provides` (version-pinned extensions / presets [with priority + strategy] / steps / workflows).

```bash
specify bundle search / info / install / update [--all] / remove / list / init / validate / build
specify bundle catalog list | add | remove   # catalog stack is priority-ordered: project > user > built-in
```

Workflows and Steps are also first-class primitives (`workflow.yml`); see the [Workflows Reference](https://github.github.io/spec-kit/reference/workflows.html).

## Supported agents

The official integrations reference lists **34 integrations** (33 named + `Generic`; both CLI and IDE — the README still says 30+). `specify integration list` shows the available list for the installed version. Current roster:

- Amp, Antigravity, Auggie CLI, Claude Code, Cline, CodeBuddy CLI, Codex CLI, Cursor, Devin for Terminal, Firebender, Forge, Gemini CLI, GitHub Copilot, Goose, Hermes, IBM Bob, Junie, Kilo Code, Kimi Code, Kiro CLI, Lingma, Mistral Vibe, Oh My Pi, opencode, Pi Coding Agent, Qoder CLI, Qwen Code, RovoDev, SHAI, Tabnine CLI, Trae, ZCode, Zed, Generic. (iFlow CLI / Roo Code / Windsurf are no longer in the reference list.)

For the full and latest list, see [Supported AI Coding Agent Integrations](https://github.github.io/spec-kit/reference/integrations.html).

Use the `--integration <agent>` flag to initialize for a specific agent.

## Differences from other tools

| | GitHub Spec Kit | Kiro | cc-sdd |
|---|---|---|---|
| Provider | Official GitHub | AWS | OSS (gotalab) |
| Form | Python CLI + templates | IDE + CLI | npm package + skills |
| Agent count | 34 | (Kiro standalone) | 8 |
| OSS | Yes (MIT) | No (commercial) | Yes (MIT) |
| Entry point | `uv tool install` / `pipx` | `curl install.sh` / Desktop | `npx cc-sdd@latest` |
| Spec format | Core templates can be overridden | EARS + design + tasks | Kiro-compatible (EARS + design + tasks) |

## Common mistakes AI agents make

1. **`pip install`-ing the PyPI `specify-cli`** — it's an unofficial, different package. Always install from the GitHub repo with `--from git+https://github.com/github/spec-kit.git@vX.Y.Z`
2. **Remembering the slash command name as `/specify`** — outdated. The current name is `/speckit.specify` (with the `speckit.` namespace prefix)
3. **Calling `/speckit.*` in Codex CLI** — Codex's skills mode uses `$speckit-*` (a `$` prefix). Naming conventions differ by CLI
4. **Recreating `/speckit.constitution` per feature** — the constitution is one thing for the whole project. Per-feature changes belong in `/speckit.specify`
5. **Manually rewriting the output of `/speckit.tasks`** — the downstream `/speckit.implement` will fail dependency analysis. Fix things at the `/speckit.specify` / `/speckit.plan` stage instead
6. **Setting up CI with Extensions / Presets left installed** — install-time writes to `.claude/commands/` etc. persist even after removal attempts. Use `specify extension remove` to properly remove them
7. **Assuming `--integration copilot` alone also works for Claude Code** — output differs per agent for each `--integration`. For multi-agent operation, run init separately for each

## References

- [github.com/github/spec-kit](https://github.com/github/spec-kit)
- [Documentation](https://github.github.io/spec-kit/)
- [CLI Reference](https://github.github.io/spec-kit/reference/overview.html)
- [Supported AI Coding Agent Integrations](https://github.github.io/spec-kit/reference/integrations.html)
- [Extensions Reference](https://github.github.io/spec-kit/reference/extensions.html)
- [Presets Reference](https://github.github.io/spec-kit/reference/presets.html)
- [Community Extensions Catalog](https://speckit-community.github.io/extensions/)
- Related: `ai/practice/spec-driven-development.md` / `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md` / `ai/agents/claude-code.md` / `ai/agents/github-copilot-cli.md` / `ai/agents/codex-cli.md`
