---
reviewed: 2026-08-10
tags: [ai-platform, cli, package, governance]
aliases: [Agent Package Manager, apm.yml, microsoft/apm]
---

# APM (Agent Package Manager)

`microsoft/apm` is an open-source **dependency manager for AI agent context**. A single `apm.yml` declares the instructions, prompts, agents, skills, hooks, plugins, and MCP servers a repository needs; `apm install` resolves them (including transitive dependencies), writes `apm.lock.yaml`, and deploys them into every agent harness it detects — GitHub Copilot, Claude Code, Cursor, Codex CLI, Gemini CLI, OpenCode, Windsurf, Kiro, and Grok Build. The mental model is `package.json`, but for agent configuration instead of runtime code. As of 2026-08-10 the latest release is **v0.28.0** (2026-08-06), MIT-licensed.

Official: [microsoft.github.io/apm](https://microsoft.github.io/apm/) · Repository: [microsoft/apm](https://github.com/microsoft/apm)

> **Important**: the name collides with two unrelated things — **A**pplication **P**erformance **M**onitoring, and the community prompt framework *Agentic Project Management* (`sdi2200262/agentic-project-management`). This article covers `microsoft/apm` only.

For the skill format itself see [`agent-skills-spec.md`](agent-skills-spec.md), and for the plugin/marketplace distribution channels APM sits alongside see [`agent-skills-distribution.md`](agent-skills-distribution.md).

## Installation

```bash
# Linux / macOS
curl -sSL https://aka.ms/apm-unix | sh
# Windows (PowerShell)
irm https://aka.ms/apm-windows | iex

# Alternatives
brew install microsoft/apm/apm
pip install apm-cli
```

Native binaries are published for macOS, Linux, and Windows x86_64. The CLI updates itself with `apm self-update` (not `apm update`, which refreshes *dependencies*).

## Package anatomy

```text
my-pkg/
├── apm.yml            # Manifest. Only `name` and `version` are required.
├── apm.lock.yaml      # Resolved refs + content hashes. Generated; commit it.
├── apm_modules/       # Installed dependencies. Generated; gitignore.
├── .apm/              # Source primitives you author
│   ├── instructions/  # *.instructions.md (glob-scoped rules)
│   ├── prompts/       # *.prompt.md (also become slash-commands)
│   ├── agents/        # *.agent.md
│   ├── skills/        # <name>/SKILL.md
│   └── hooks/         # *.json lifecycle hooks
├── .github/ .claude/ .cursor/ .codex/   # Compiled output. Generated.
└── apm-policy.yml     # Optional org/repo policy
```

Everything outside `.apm/` in that list is build output — **edit the source under `.apm/` and re-run `apm install`; never edit the deployed copy** (`apm audit` exists specifically to catch hand-edits).

Minimal manifest, with the fields that matter in practice:

```yaml
name: my-pkg
version: 1.0.0
type: skill                 # instructions | skill | hybrid | prompts (optional)
targets: [copilot, claude]  # optional; otherwise auto-detected
dependencies:
  apm:
    - microsoft/apm-sample-package#v1.0.0                 # pinned to a tag
    - anthropics/skills/skills/frontend-design            # single primitive
    - github/awesome-copilot/plugins/context-engineering  # plugin
  mcp:
    - name: io.github.github/github-mcp-server
      transport: http       # MCP transport name, not a URL scheme
devDependencies:            # excluded from `apm pack`
  apm:
    - my-org/internal-test-skills
scripts:                    # run via `apm run <name>`
  start: copilot -p hello.prompt.md
```

`PACKAGE_REF` accepts shorthand (`owner/repo`), HTTPS/SSH Git URLs, FQDN shorthand for any git host (GitHub, GitLab, Bitbucket, Azure DevOps, Gitea, …), local paths, packed bundles (`.zip` / `.tar.gz`), and marketplace refs (`NAME@MARKETPLACE[#ref]`).

## Commands

| Phase | Commands |
|---|---|
| Setup | `init`, `install`, `lock`, `update`, `uninstall` |
| Inspect / audit | `view`, `deps`, `outdated`, `list`, `find`, `audit`, `doctor` |
| Compile / integrate | `compile`, `prune`, `targets`, `runtime` |
| Author / distribute | `pack`, `unpack`, `preview`, `plugin`, `publish`, `marketplace`, `search`, `self-update` |
| Governance | `approve`, `deny`, `policy`, `mcp` |

Key flags on `apm install`:

| Flag | Behavior |
|---|---|
| `--frozen` | Lockfile-only install; fails if `apm.lock.yaml` is missing or out of sync. The CI equivalent of `npm ci` |
| `--target`, `-t` | Force targets (`-t claude,cursor`, or `all`). Precedence: flag → manifest `targets:` → `apm config` → auto-detection |
| `--global`, `-g` | Install to user scope (`~/.apm/`) instead of the project |
| `--dry-run` | Print the plan without deployment writes |
| `--trust-transitive-mcp` | Accept MCP servers pulled in by transitive packages (gated by default) |
| `--force` | Overwrite locally-authored files **and** bypass the security scan's critical-finding block. Use only after independent verification |

## Primitives and reach

A **primitive** is a unit of agent context; a **target** is a harness APM compiles for. `native` means the harness reads APM's output directly, `compiled` means APM transforms it into the harness's own format.

| Primitive | Source | Reach |
|---|---|---|
| instructions | `.apm/instructions/*.instructions.md` | native on Copilot / Claude / Grok Build / Cursor / Antigravity / Windsurf / Kiro; compiled into context files for Codex / Gemini / OpenCode |
| prompts | `.apm/prompts/*.prompt.md` | native on Copilot; compiled to `/commands` elsewhere; unsupported on Codex / Kiro |
| agents | `.apm/agents/*.agent.md` | native on Copilot / Claude / Grok Build / OpenCode; unsupported on Gemini / Antigravity / Windsurf |
| skills | `.apm/skills/<name>/SKILL.md` | **native on every target** — the one primitive with universal reach |
| hooks | `.apm/hooks/*.json` | native on most; merged into `settings.json` on Claude / Gemini; unsupported on Grok Build / OpenCode |
| MCP servers | `apm.yml` → `dependencies.mcp` | native almost everywhere; transitive servers are gated behind explicit trust |
| plugins | `plugin.json` at package root | normalized at install time into the primitives above, then routed per row |

Target output directories: `copilot` → `.github/`, `claude` → `.claude/`, `cursor` → `.cursor/`, `codex` → `.codex/` (+ `.agents/` for skills), `gemini` → `.gemini/`, `opencode` → `.opencode/`, `windsurf` → `.windsurf/`, `kiro` → `.kiro/`, `grok-build` → `.grok/`, `antigravity` → `.agents/` (explicit-only; excluded from `--target all`).

Since skills converged on `.agents/skills/`, per-client skill paths are opt-in via `--legacy-skill-paths` (`APM_LEGACY_SKILL_PATHS=1`).

## Compile: where context files land

`apm compile` handles **instructions only** — the other primitives are deployed by `apm install` straight into the harness directories. It defaults to **distributed placement**: instead of one monolithic root file, APM writes a target file next to each directory matched by an instruction's `applyTo:` glob (an instruction with `applyTo: "scripts/**"` produces `scripts/AGENTS.md`). This follows the Minimal Context Principle, so a fresh compile legitimately creates new `AGENTS.md` / `CLAUDE.md` files in subdirectories. Use `apm compile --single-agents` (or `compilation.single_file: true`) for one root file.

Compile is **optional for `copilot`** — Copilot reads the deployed `.github/instructions/*.instructions.md` natively — and **recommended for every other context-producing target**.

## Security and governance

- **Content scanning**: every `apm install` scans for hidden Unicode that can hijack agent behavior; `apm audit` runs the same checks on demand. Critical findings block the install unless `--force`.
- **Lockfile integrity**: `apm.lock.yaml` records resolved sources plus content hashes; `apm lock export --format cyclonedx|spdx` emits an SBOM of what reached disk (provenance for procurement, not a compliance attestation).
- **Drift detection**: `apm audit` rebuilds agent context in a scratch directory and diffs it against the working tree, catching hand-edits to generated files before they ship. Wire `apm audit --ci` into branch protection.
- **MCP trust boundaries**: transitive MCP servers require explicit consent (`--trust-transitive-mcp` or re-declaration).
- **Policy**: `apm-policy.yml` restricts allowed sources, scopes, and primitives, with **tighten-only inheritance** from enterprise → org → repo and a published bypass contract. `apm-policy.yml` governs what gets *installed*; the agent harness still governs what gets *run* — the two planes do not overlap.
- **Executable content is gated**: Copilot canvas extensions (`.apm/extensions/<name>/extension.mjs`) are experimental, Copilot-only, and a dependency-provided canvas stays blocked until approved via the `executables` block plus `apm approve <pkg>`.

An **OpenAPM v0.1** specification (manifest / lockfile / policy / requirements JSON Schemas, with a machine-readable requirements manifest and spec-conformance tests) ships alongside the docs, signalling intent to standardize the format beyond this one implementation.

## Comparison with similar tools

| Tool | Scope | Distinguishing trait |
|---|---|---|
| **APM** | Manifest + lockfile + transitive resolution + policy across 10 harnesses | The only one with dependency *resolution*, integrity hashes, SBOM, and org policy |
| [`ruler.md`](ruler.md) (`intellectronica/ruler`) | Fan out one `.ruler/` rule set to 30+ agents | Widest harness coverage; no dependencies, no lockfile, no versioning |
| [`agentrc.md`](agentrc.md) (`microsoft/agentrc`) | *Generate* instructions/evals from your codebase | Complementary, not competing: agentrc authors context, APM distributes it (both use `.instructions.md`) |
| Vercel `skills` (`npx skills add`) / `antfu/skills-npm` | Install bare skills from npm/GitHub | Lighter gesture, skills only. `apm install vercel-labs/agent-skills` is a drop-in replacement that adds a manifest and lockfile |
| Plugin marketplaces (Claude / Codex / Copilot / Gemini) | Per-CLI, first-party bundles | Native update paths and pre-install review panes; APM can consume plugins and `apm pack` can emit a standard `plugin.json` |

## Common AI Agent Mistakes

1. **Editing compiled output** — changes to `.github/`, `.claude/`, `.cursor/`, `AGENTS.md` are overwritten on the next install and flagged by `apm audit` drift detection. Edit `.apm/` instead.
2. **Confusing `apm update` with `apm self-update`** — the former re-resolves dependencies, the latter upgrades the CLI binary.
3. **Skipping `--frozen` in CI** — a plain `apm install` may re-resolve mutable refs, so builds stop being reproducible. `--frozen` is the `npm ci` analogue.
4. **Assuming a policy file restricts runtime behavior** — `apm-policy.yml` only governs what is *installed*. Tool permissions and sandboxing remain the harness's job.
5. **Expecting `apm compile` to deploy skills or prompts** — it compiles instructions only; everything else is deployed by `apm install`.
6. **Treating "APM" as unambiguous** — verify whether a source means this tool, Application Performance Monitoring, or the Agentic Project Management framework before acting on it.

## References

- [APM documentation](https://microsoft.github.io/apm/) — [quick start](https://microsoft.github.io/apm/getting-started/quick-start/) / [CLI reference](https://microsoft.github.io/apm/reference/) / [primitives and targets](https://microsoft.github.io/apm/concepts/primitives-and-targets/) / [package anatomy](https://microsoft.github.io/apm/concepts/package-anatomy/)
- [Governance guide](https://microsoft.github.io/apm/enterprise/governance-guide/) / [policy reference](https://microsoft.github.io/apm/enterprise/policy-reference/) / [security](https://microsoft.github.io/apm/enterprise/security/)
- [microsoft/apm](https://github.com/microsoft/apm) / [microsoft/apm-action](https://github.com/microsoft/apm-action)
- Related: [`agent-skills-distribution.md`](agent-skills-distribution.md), [`agent-skills-spec.md`](agent-skills-spec.md), [`agentrc.md`](agentrc.md), [`ruler.md`](ruler.md), [`waza.md`](waza.md)
