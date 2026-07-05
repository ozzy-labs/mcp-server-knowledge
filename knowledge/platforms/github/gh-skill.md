---
reviewed: 2026-06-23
tags: [github, cli, ai-agent]
stability: beta
aliases: [gh skills]
---

# gh skill (GitHub CLI Agent Skills management)

A built-in `gh` (GitHub CLI) subcommand for installing / listing / previewing / publishing / searching / updating Agent Skills (`SKILL.md`) from GitHub repositories. A single command places skills into host-specific directories for 40+ agents, including GitHub Copilot, Claude Code, Cursor, Codex, and Gemini CLI — effectively a cross-tool package manager for skills.

**Preview feature** (as of gh 2.94.0; the spec may change without notice). Alias `gh skills`. Skills are auto-discovered via the [agentskills.io](https://agentskills.io/specification) open standard (`skills/*/SKILL.md` convention).

## Scope and directory model

Where a skill lands is determined by **scope × agent**.

- **scope (default `project`)**: `project` = inside the current git repository, `user` = home directory (effective across all projects)
- **agent (default `github-copilot` in non-interactive mode)**: placed into each agent's host-specific directory
- With project scope, many agents (GitHub Copilot, Cursor, Codex, Gemini CLI, Antigravity, Amp, Cline, OpenCode, Warp, etc.) **share `.agents/skills`**. If you select multiple hosts that resolve to the same destination, the skill is installed there only once.
- `--dir` overrides `--agent` / `--scope` to place the skill in an arbitrary directory.

Installed skills get **source-tracking metadata injected into frontmatter** (`metadata.github-*`), which `gh skill update` uses to detect changes.

## Subcommands

| Command | Purpose | Main aliases |
|---|---|---|
| `install` | Install a skill from a repository / local path | `add` |
| `list` | List installed skills | `ls` |
| `preview` | View `SKILL.md` in the terminal without installing | `show` |
| `publish` | Validate a local skill and publish it as a GitHub Release | — |
| `search` | Search public repositories for skills | — |
| `update` | Update installed skills to the latest version | — |

### install

```bash
gh skill install <repository> [<skill[@version]>] [flags]
```

- **Arguments**: the first argument is `OWNER/REPO`. `--from-local` installs from a local directory (copies rather than symlinking, and injects local-path tracking metadata).
- **Skill specification**: by name / namespaced (`author/skill`) / exact path within the repo (`skills/author/skill`, `.../SKILL.md`). **In large repos, specifying a path instead of a name avoids a full tree walk and is faster.**
- **Version resolution order**: ① latest tagged release → ② default branch HEAD. Pin with `@VERSION` or `--pin <tag|SHA>`.
- **Main flags**: `--agent` (target agent), `--scope {project|user}`, `--dir`, `--all` (install all skills without prompting), `-f/--force`, `--from-local`, `--pin`, `--allow-hidden-dirs` (also target hidden directories such as `.claude/skills/`), `--upstream` (when a republished skill is detected, install from upstream instead).
- In non-interactive runs, `repository` and either a skill name or `--all` are required.

```bash
# Interactively choose repo / skill / agent
gh skill install

# Install a specific skill for Claude Code at user scope
gh skill install github/awesome-copilot git-commit --agent claude-code --scope user

# Pin a version
gh skill install github/awesome-copilot git-commit@v1.2.0

# Install all skills at once
gh skill install github/awesome-copilot --all
```

### list

```bash
gh skill list [--agent <host>] [--scope {project|user}] [--dir <path>] [--json <fields>]
```

Scans all known agent hosts across both project and user scope. JSON fields: `agentHosts, path, pinned, scope, skillName, sourceURL, version`.

### preview

Displays `SKILL.md` in a pager without installing it. Shows the file tree first; in interactive mode you can browse scripts/references etc. individually via a file picker. `@VERSION` accepts a tag, branch, or SHA.

### publish

```bash
gh skill publish [<directory>] [--dry-run] [--fix] [--tag v1.0.0]
```

**Validates** a local repo's skill against the Agent Skills specification and publishes it as a GitHub Release. Discovery conventions match `install` (`skills/*/SKILL.md`, `skills/{scope}/*/SKILL.md`, root-level `*/SKILL.md`, `plugins/{scope}/skills/*/SKILL.md`).

Validation checks:

- Skill name matches agentskills.io's strict naming rules
- Skill name matches the directory name
- Required frontmatter (`name` / `description`) is present
- `allowed-tools` is a **string**, not an array
- Install metadata (`metadata.github-*`) is removed if present

Publishing interactively guides you through: adding the `agent-skills` topic to the repository → choosing a version tag (semver recommended) → creating a Release with auto-generated notes. `--dry-run` validates only, `--tag` publishes non-interactively, `--fix` only strips install metadata (without publishing — review & commit, then rerun).

### search

Searches public repositories for skills matching name/description in `SKILL.md`, via the GitHub Code Search API. Matches in the name rank higher. `--owner` restricts to a user/org, plus `--limit` (default 15) / `--page`. In interactive mode you can install directly from the results. JSON fields: `description, namespace, path, repo, skillName, stars`.

### update

Detects updates by comparing the local tree SHA (`SKILL.md` frontmatter) with the remote. `--pin`ned skills are skipped with a notice (`--unpin` to make them eligible). For skills with no GitHub metadata (installed manually or by another tool), interactive mode asks for the source repo; with `--all` / non-interactive mode they are skipped. `--force` re-downloads even if it matches the remote (overwriting local changes, but local added files are not removed). `--dry-run` is read-only.

## Position in the Agent Skills ecosystem

- Unlike each CLI's own plugin marketplace (Claude Code's `/plugin`, Codex's `openai/plugins`), `gh skill` lets you **distribute to many agents cross-tool using just `gh`**. The source is an ordinary GitHub repository (with the `agent-skills` topic) and its Releases.
- Placement follows the discovery conventions in `ai/platform/agent-skills-spec.md`, resolving to `.agents/skills` (cross-client) or each host's dedicated directory.
- See `ai/platform/agent-skills-catalog.md` for a catalog organized by how to choose and use skills, and `ai/platform/agent-skills-best-practices.md` for authoring guidance.

## References

- [GitHub CLI manual](https://cli.github.com/manual/) (`gh skill <command> --help` is authoritative)
- [Agent Skills specification](https://agentskills.io/specification)
- Related: `platforms/github/gh-cli.md`, `platforms/github/gh-extensions.md`, `ai/platform/agent-skills-spec.md`, `ai/platform/agent-skills-catalog.md`
