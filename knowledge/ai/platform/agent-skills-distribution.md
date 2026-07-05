---
reviewed: 2026-07-05
tags: [ai-platform, cli, package]
---

# Distributing Agent Skills Across Multiple Agents

How to package, publish, and distribute Agent Skills (`SKILL.md`) so they are usable across the four major coding-agent CLIs — Claude Code, Codex CLI, Gemini CLI, and GitHub Copilot CLI. For the format itself see [`agent-skills-spec.md`](agent-skills-spec.md), for the extension mechanisms see [`agent-extensions.md`](agent-extensions.md), and for public skills see [`agent-skills-catalog.md`](agent-skills-catalog.md).

## The portability reality (read this first)

A single `SKILL.md` is portable because only `name` / `description` are required and each tool ignores frontmatter keys it does not recognize. **But the storage location is not universal.** The `.agents/skills/` convention is discovered by **only three** of the four CLIs — **Claude Code does not read `.agents/skills/`**; it loads only `.claude/skills/`.

| CLI | Discovers `.agents/skills/`? | Native skill paths |
|---|---|---|
| Codex CLI | Yes | `.agents/skills/`, `~/.agents/skills/` (+ `/etc/codex/skills`) |
| Gemini CLI | Yes | `.gemini/skills/` or `.agents/skills/` |
| GitHub Copilot CLI | Yes | `.github/skills/`, `.claude/skills/`, `.agents/skills/` |
| **Claude Code** | **No** | `.claude/skills/` (project, walking to repo root), `~/.claude/skills/` |

Consequences for a "publish once, run everywhere" story — you must do **one** of:

- Put the skill in `.agents/skills/` (covers Codex / Gemini / Copilot) **and add a `.claude/skills/` copy or symlink** for Claude Code, or
- Wrap the skill in a **Claude Code plugin** (below), which is the durable way to ship skills to Claude Code.

## Distribution channels

| Channel | What it is | Best for |
|---|---|---|
| Raw folder in repo | Commit `.agents/skills/<name>/` (and/or `.claude/skills/`) directly | Project-scoped skills; simplest |
| Personal directory | Drop into `~/.agents/skills/` or `~/.<cli>/skills/` | One user, all projects |
| Plugin + marketplace | Bundle skills (+ agents / hooks / MCP) behind a manifest, publish via a git/npm marketplace | Versioned, multi-consumer, updatable |
| npm package installer | Ship skills in an npm package; an `npx … install` copies/symlinks them in | Same skills across many machines (community) |
| Team / enterprise | Admin-pushed marketplaces auto-installed org-wide | Onboarding, fleets |

## Plugins and marketplaces (the main publish mechanism)

A **plugin** bundles skills, subagents, hooks, slash commands, and MCP servers behind a manifest; a **marketplace** is a catalog that lists installable plugins. This is the durable, versioned way to distribute — and the only first-class way to ship skills to Claude Code.

| CLI | Plugin manifest | Marketplace catalog | Install / publish |
|---|---|---|---|
| Claude Code | `.claude-plugin/plugin.json` (components at root: `skills/`, `commands/`, `agents/`, `hooks/`, `.mcp.json`, …) | `.claude-plugin/marketplace.json` (required `name` / `owner` / `plugins[]`) | `/plugin marketplace add owner/repo` → `/plugin install name@marketplace`. Source types: path / `github` / `url` / `git-subdir` / **`npm`**. Validate: `claude plugin validate` |
| Codex CLI | `.codex-plugin/plugin.json` (pointers: `skills`, `mcpServers`, `apps`, `hooks`) | `.agents/plugins/marketplace.json` (repo) / `~/.agents/plugins/marketplace.json` (personal); legacy `.claude-plugin/marketplace.json` also read | `codex plugin marketplace add owner/repo`; scaffold with the `@plugin-creator` skill |
| Gemini CLI | `gemini-extension.json` (root; `name` / `version` / `mcpServers` / `contextFileName`) | GitHub-hosted; auto-gallery via repo topic `gemini-cli-extension` | `gemini extensions install <github-url \| local-path> [--ref] [--auto-update]`; or ship archives via GitHub Releases |
| GitHub Copilot CLI | `plugin.json` (root) | `marketplace.json` in `.github/plugin/` | `copilot plugin install owner/repo[:subdir]`; enterprise-managed plugins auto-install org-wide |

Notes:

- **Claude Code** hosting: push the marketplace repo to any git host (public for reach, private for internal). Official channels are `claude-plugins-official` (curated, auto-registered) and `claude-community` (submitted via a web form → automated validation + safety screening → **pinned to a commit SHA**). Lightweight no-marketplace path: drop a folder containing `.claude-plugin/plugin.json` under `~/.claude/skills/` (loads as `<name>@skills-dir`); scaffold with `claude plugin init`.
- **Codex** official curated Plugin Directory is **not yet open to third-party submissions** (self-serve publishing "coming soon"); today you distribute via repo-scoped / personal marketplaces or git-backed sources.
- **Gemini** gallery listing is automatic: public repo + `gemini-extension.json` at root + the `gemini-cli-extension` repo topic (crawled daily and validated). Repo moves use a `migratedTo` manifest field.

## npm / npx distribution

- **Claude Code (official):** `npm` is a first-class marketplace **source type** — `{"source": "npm", "package": "...", "version": "...", "registry": "..."}`, installed via `npm install`. Caveat: **set `version`**, or an npm-sourced plugin resolves to `"unknown"` and update detection breaks.
- **Bare skills as an npm package (community, not in the spec):** ship a `skills/` directory in an npm package and have an installer copy/symlink into `.agents/skills/` (or per-CLI dirs). Tooling: **Vercel Labs `skills`** (`npx skills add <pkg>`; the `skills.sh` registry auto-lists by install telemetry) and **antfu `skills-npm`** (a `prepare` script symlinks `node_modules/**/skills/*/SKILL.md` into place). No official Anthropic `npx` installer for bare skills exists.

## Versioning and update propagation

The `SKILL.md` spec keeps versioning out of the core: put `version` / `author` in the arbitrary `metadata` map, and use the optional `license` and `compatibility` fields. Actual **update propagation is driven by the plugin/extension layer**, not by `SKILL.md`:

- **Claude Code:** the update cache key resolves in order `plugin.json` version → marketplace-entry version → **git commit SHA** → `"unknown"` (npm / non-git local). Set explicit semver + keep a `CHANGELOG.md` so users update only on a bump; omit `version` and every commit is treated as a new version. `/plugin update` + auto-update; `dependencies` accept semver ranges.
- **Gemini:** keep manifest `version` synced to GitHub **release tags** (`--auto-update` detects: release = tag query, git clone = commit-hash, local = manifest compare).
- **Codex / Copilot:** `plugin.json` / marketplace `version`; `codex plugin marketplace upgrade`; Copilot enterprise-managed auto-update.

## Cross-repo and dotfiles distribution

Official multi-repo / multi-machine mechanisms are **marketplace / team-based, not file-sync**:

- **Claude Code team marketplaces:** set `extraKnownMarketplaces` + `enabledPlugins` in a project's `.claude/settings.json`; members are auto-prompted to install on folder trust. Org-wide via managed settings.
- **Copilot:** enterprise-managed plugins auto-installed across an org (public preview 2026-05).
- **Codex:** workspace member sharing + repo marketplace under `.agents/plugins/`. **Gemini:** git repo / GitHub Releases + `--auto-update`.

Syncing raw skill folders across machines via **dotfiles symlinks, git submodules, or `chezmoi`** is a community practice with no official per-CLI guidance (see [`../../standards/multi-repo-config-sync.md`](../../standards/multi-repo-config-sync.md)); the emergent community answer for "the same skills everywhere" is the npm-package approach above.

## Trust and security

Plugins execute arbitrary code with your privileges — **install only from sources you trust**, and audit bundled `scripts/` and MCP servers before adopting.

- **Claude Code (most explicit):** a pre-install **"Will install" review pane** lists every command / agent / skill / hook / MCP / LSP plus a context-cost estimate; managed `strictKnownMarketplaces` / `pluginSuggestionMarketplaces` restrict sources; community submissions get automated validation + safety screening and are **SHA-pinned**; plugin-provided subagents **cannot** declare `hooks` / `mcpServers` / `permissionMode` (privilege-escalation prevention); reserved official-marketplace names are blocked.
- **Codex:** marketplace entries carry a `policy` block (`installation`, `authentication: ON_INSTALL`) plus enterprise controls.
- **Gemini:** fingerprints project hooks and warns on change; the gallery validates before listing; `--consent` gate on install.
- **Copilot:** enterprise-managed baseline; duplicate names resolved first-found-wins.
- **Namespacing:** Claude `plugin-name:skill-name`; Codex `<plugin>@<marketplace>`; Gemini `<extension>.<command>`; Copilot repo-name based.
- **No cryptographic signing / provenance** is documented by any of the four; the strongest integrity guarantee in use is **commit-SHA pinning** plus repo-ownership / topic-based gallery validation.

## Choosing a method

- **Quick project share** → commit to `.agents/skills/` (+ a `.claude/skills/` copy for Claude Code).
- **Versioned, multi-consumer, updatable** → plugin + marketplace (git-hosted; `npm` source on Claude Code).
- **Org-wide / onboarding** → team marketplace (Claude Code) or enterprise-managed plugins (Copilot).
- **Personal, many machines** → dotfiles symlink from an SSOT, or an npm-package installer (`skills-npm` / Vercel `skills`).

## Common mistakes AI agents make

1. **Assuming `.agents/skills/` reaches Claude Code** — it does not. Claude Code reads only `.claude/skills/`; add a symlink/copy there or ship a plugin.
2. **Omitting the plugin `version`** — npm-sourced and non-git-local plugins then resolve to `"unknown"`, so update detection silently breaks. Set semver and keep a `CHANGELOG.md`.
3. **Confusing a skill folder with a plugin** — a plugin is a manifest-backed bundle (skills + agents / hooks / MCP), the unit of *distribution*; a skill folder is the unit of *capability*.
4. **Treating `allowed-tools` as a security boundary for third-party skills** — it only skips approval prompts; audit scripts and use namespacing / managed marketplace restrictions instead.
5. **Expecting cryptographic signatures** — none exist; rely on SHA-pinning, trusted sources, and the pre-install review pane.

## References

- [Agent Skills open standard](https://agentskills.io/)
- Claude Code: [Plugins](https://code.claude.com/docs/en/plugins) / [Plugins reference](https://code.claude.com/docs/en/plugins-reference) / [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) / [Discover plugins](https://code.claude.com/docs/en/discover-plugins) / [Skills](https://code.claude.com/docs/en/skills)
- Codex CLI: [Build plugins](https://developers.openai.com/codex/plugins/build) / [Plugins in Codex](https://help.openai.com/en/articles/20001256-plugins-in-codex)
- Gemini CLI: [Extensions](https://geminicli.com/docs/extensions/) / [Releasing extensions](https://geminicli.com/docs/extensions/releasing/)
- GitHub Copilot CLI: [Creating a plugin](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-creating) / [Plugin marketplace](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-marketplace)
- Community npm distribution: [vercel-labs/skills](https://github.com/vercel-labs/skills) / [antfu/skills-npm](https://github.com/antfu/skills-npm)
- Related: [`agent-skills-spec.md`](agent-skills-spec.md), [`agent-extensions.md`](agent-extensions.md), [`agent-skills-catalog.md`](agent-skills-catalog.md), [`agent-skills-best-practices.md`](agent-skills-best-practices.md)
