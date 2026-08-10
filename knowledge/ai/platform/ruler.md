---
reviewed: 2026-08-10
tags: [ai-platform, cli, npm, markdown]
aliases: [intellectronica/ruler, "@intellectronica/ruler"]
stability: beta
---

# Ruler (single source of truth for agent instructions)

`intellectronica/ruler` centralizes AI coding-agent instructions in one `.ruler/` directory and **fans them out into each agent's native config file** — `CLAUDE.md`, `AGENTS.md`, `.clinerules`, `.junie/guidelines.md`, and so on — plus per-agent MCP configuration. It covers the widest set of harnesses of any tool in this space (30+ agents as of 2026-08), at the cost of having no dependency resolution, versioning, or lockfile. Distributed on npm as `@intellectronica/ruler`; latest release **v0.3.44** (2026-06-30), MIT, self-described as a **beta research preview**.

Repository: [intellectronica/ruler](https://github.com/intellectronica/ruler)

Compare with [`apm.md`](apm.md), which solves the adjacent problem — installing versioned, hash-pinned context *packages* from other repositories — and with [`agent-skills-distribution.md`](agent-skills-distribution.md) for the plugin/marketplace route.

## Setup

```bash
npm install -g @intellectronica/ruler   # or: npx @intellectronica/ruler apply
ruler init                              # creates .ruler/AGENTS.md + .ruler/ruler.toml
ruler init --global                     # $XDG_CONFIG_HOME/ruler (default ~/.config/ruler)
ruler apply                             # write every configured agent's files
ruler revert                            # restore from .bak backups
```

Requires Node.js `^20.19.0 || ^22.12.0 || >=23`. `apply` searches upward from `--project-root` for the nearest `.ruler/`, falling back to the global config when none is found.

## How rules are assembled

All `.md` files under `.ruler/` are discovered recursively and concatenated, each prefixed with a `<!-- Source: <relative_path> -->` marker for traceability. Precedence, highest first:

1. A repository-root `AGENTS.md` outside `.ruler/` (prepended)
2. `.ruler/AGENTS.md` — the default starter file
3. Legacy `.ruler/instructions.md` (only when `AGENTS.md` is absent)
4. Every remaining `.md` under `.ruler/`, in sorted order

This ordering is what lets you keep a short executive `AGENTS.md` at the root while the detail lives in `.ruler/coding_style.md`, `.ruler/security_guidelines.md`, and so on.

**Nested rule loading** (`--nested`, experimental) discovers a `.ruler/` in each subtree — `src/.ruler/`, `tests/.ruler/` — and scopes generated files to their source directories, for monorepos and mixed frontend/backend repos. Precedence: `--nested` / `--no-nested` on the CLI, then `nested = true` in `ruler.toml`, then disabled. Once a run is nested, child configs cannot turn it off.

## Coverage

Representative rows from the supported-agent matrix (30+ entries; consult the README for the full list):

| Agent | Rules file | MCP config |
|---|---|---|
| Claude Code | `CLAUDE.md` | `.mcp.json` |
| GitHub Copilot | `AGENTS.md` | `.mcp.json` |
| Codex CLI | `AGENTS.md` | `.codex/config.toml` |
| Gemini CLI | `AGENTS.md` | `.gemini/settings.json` |
| Cursor / Windsurf / Zed / OpenCode / Amp | `AGENTS.md` | per-agent JSON |
| Cline / Crush / Goose / Warp | `.clinerules` / `CRUSH.md` / `.goosehints` / `WARP.md` | mostly none |
| Kiro / Junie / Amazon Q / Firebase Studio / Trae / AugmentCode | harness-specific rules path | harness-specific |

Beyond rules, `ruler apply` also propagates **MCP servers** (merged into each agent's native config by default; `--mcp-overwrite` replaces instead), optionally **skills** (`--skills`, experimental, on by default) and **subagents** (`--subagents`, experimental, off by default), and maintains `.gitignore` entries for the files it generates (`--gitignore-local` writes to `.git/info/exclude` instead).

## Key flags

| Flag | Effect |
|---|---|
| `--agents claude,copilot` | Restrict the run to specific agents |
| `--dry-run` | Preview writes without touching the filesystem |
| `--no-mcp` / `--mcp-overwrite` | Skip MCP propagation, or replace rather than merge |
| `--no-backup` | Skip `.bak` files (created by default; `ruler revert --keep-backups` retains them) |
| `--local-only` | Ignore `$XDG_CONFIG_HOME` configuration |

## Common AI Agent Mistakes

1. **Editing a generated `CLAUDE.md` / `AGENTS.md`** — the next `ruler apply` overwrites it. Edit `.ruler/*.md` instead.
2. **Expecting dependency management** — Ruler distributes *your own* rules within one repo. Installing someone else's versioned package is APM's job, not Ruler's.
3. **Assuming subagents propagate by default** — subagent support is opt-in (`--subagents`), and `revert` does not clean subagent directories; that needs `[agents] cleanup_orphaned = true`.
4. **Scaffolding `.ruler/mcp.json`** — deprecated and no longer generated. MCP servers belong in `ruler.toml`.
5. **Treating nested mode as stable** — it is experimental and logs a warning on first use.

## References

- [intellectronica/ruler](https://github.com/intellectronica/ruler) / [@intellectronica/ruler on npm](https://www.npmjs.com/package/@intellectronica/ruler)
- Related: [`apm.md`](apm.md), [`agents-md.md`](agents-md.md), [`agent-skills-distribution.md`](agent-skills-distribution.md), [`agentrc.md`](agentrc.md)
