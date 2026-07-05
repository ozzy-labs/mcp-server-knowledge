---
reviewed: 2026-06-07
tags: [ai-workflow, spec, oss, npm, javascript]
stability: beta
---

# cc-sdd

An OSS SDD orchestrator (gotalab/cc-sdd). Distributed as an npm package; `npx cc-sdd@latest` installs **17 Agent Skills** (discovery / spec / impl / steering, etc.) into 8 kinds of AI coding agents in one shot. Explicitly "Kiro-inspired" and compatible with Kiro's spec format (EARS + design + tasks).

Official: [github.com/gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) / npm: [cc-sdd](https://www.npmjs.com/package/cc-sdd)

For the overall SDD concept, see `ai/practice/spec-driven-development.md`. For comparisons in the same space, see `ai/workflow/kiro.md` / `ai/workflow/github-spec-kit.md`.

## Installation

```bash
cd your-project
npx cc-sdd@latest
```

Default is Claude Code skills + English docs. To switch agent/language:

```bash
npx cc-sdd@latest --codex-skills --lang ja          # Codex CLI / Japanese
npx cc-sdd@latest --cursor-skills --lang zh-TW       # Cursor IDE / Traditional Chinese
npx cc-sdd@latest --gemini-skills                    # Gemini CLI
npx cc-sdd@latest --copilot-skills                   # GitHub Copilot
npx cc-sdd@latest --windsurf-skills                  # Windsurf IDE
npx cc-sdd@latest --opencode-skills                  # OpenCode
npx cc-sdd@latest --antigravity                      # Antigravity (experimental)
```

Supports 13 languages (`--lang ja`, `zh-TW`, `en`, and others).

## Operating model

- **Distributed as Agent Skills**: 17 skills loaded via progressive disclosure through `SKILL.md`. See `ai/platform/agent-extensions.md` for details
- **Kiro-compatible spec**: `requirements.md` (EARS) / `design.md` (includes File Structure Plan) / `tasks.md` (`_Boundary:_` + `_Depends:_`)
- **Per-task subagent**: each task in `/kiro-impl` spawns a fresh implementer + an independent reviewer + auto-debug
- **TDD enforced**: the implementer follows a RED → GREEN cycle, implementing behind a feature flag
- **Boundary-first**: task boundaries are determined from the File Structure Plan in design.md; the reviewer detects boundary violations

## SDD workflow (v3 Skills mode)

`/kiro-*` slash commands are registered on the agent side.

### Primary slash commands

| Command | Role |
|---|---|
| `/kiro-discovery` | Entry point. Classifies new work (extend an existing spec / implement directly with no spec / new spec / split into multiple specs / mixed). Generates `brief.md` and, if needed, `roadmap.md` |
| `/kiro-spec-init` | Initializes a single spec |
| `/kiro-spec-requirements` | Defines requirements in EARS notation |
| `/kiro-spec-design` | Architecture + Mermaid diagrams + File Structure Plan |
| `/kiro-spec-tasks` | Task list with boundary/dependency annotations |
| `/kiro-spec-batch` | Generates multiple specs in parallel from a roadmap + cross-spec review |
| `/kiro-impl` | Executes implementation. No task argument = autonomous mode (per-task subagent trio) / with a task argument = manual mode (TDD + review gate in the main context) |
| `/kiro-validate-impl` | Feature-level integration verification. Checks requirements coverage / design alignment / full-suite evidence across tasks and returns `GO` / `NO-GO` / `MANUAL_VERIFY_REQUIRED` |
| `/kiro-steering` | Updates guidance files that apply project-wide |

### Supporting Skills (called internally from `/kiro-impl`)

| Skill | Role |
|---|---|
| `kiro-review` | Adversarial review protocol. Checks spec compliance / boundaries / mechanical verification / RED phase evidence |
| `kiro-debug` | Root-cause-first analysis. Returns `ROOT_CAUSE` / `CATEGORY` / `FIX_PLAN` / `NEXT_ACTION` (max 2 rounds) |
| `kiro-verify-completion` | Fresh-evidence gate. Returns `VERIFIED` / `NOT_VERIFIED` / `MANUAL_VERIFY_REQUIRED` |

### Recommended flows

| Scenario | Flow |
|---|---|
| New feature / product-sized planning | `kiro-discovery` → `kiro-spec-init` → `kiro-spec-requirements` → `kiro-spec-design` → `kiro-spec-tasks` → `kiro-impl` → `kiro-validate-impl` |
| Extending an existing system | `kiro-steering` → `kiro-discovery` or `kiro-spec-init` → `kiro-validate-gap` (optional, diff verification against existing code) → `kiro-spec-design` → `kiro-spec-tasks` → `kiro-impl` → `kiro-validate-impl` |
| Decomposing a large initiative | `kiro-discovery` → `kiro-spec-batch` |
| Small change that doesn't need a spec | `kiro-discovery` → direct implementation |

### Inside `/kiro-impl`

Calling it with **no task argument** triggers **autonomous mode**: for each task, the following are spawned as independent subagents (each maps to the Supporting Skills above):

1. **Implementer**: implements behind a feature flag using TDD (RED → GREEN)
2. **Reviewer** (`kiro-review`): reviews in an independent context; detects boundary violations / spec deviations
3. **Auto-debug** (`kiro-debug`): investigates root cause in a clean context when the implementer gets stuck or the reviewer rejects twice

Calling it **with a task argument** triggers **manual mode**: TDD runs in the main context, and only the review gate runs.

Learnings propagate to subsequent tasks via the `## Implementation Notes` section in `tasks.md`. Designed as 1 task per iteration, safe to resume after interruption.

## Supported agents (v3 Skills mode)

| Agent | Install flag | Stability |
|---|---|---|
| **Claude Code** | `--claude-skills` (default) | Stable |
| **Codex** | `--codex-skills` | Stable |
| **Cursor IDE** | `--cursor-skills` | Beta |
| **GitHub Copilot** | `--copilot-skills` | Beta |
| **Windsurf IDE** | `--windsurf-skills` | Beta |
| **OpenCode** | `--opencode-skills` | Beta |
| **Gemini CLI** | `--gemini-skills` | Beta |
| **Antigravity** | `--antigravity` | Beta (experimental) |
| **Qwen Code** | `--qwen` | Legacy (commands mode only) |

All 8 Skills variants **share the same set of 17 skills**. "Beta" reflects differences in real-world platform integration usage, not feature gaps.

Legacy mode (slash commands placed directly: `--claude` / `--claude-agent` / `--cursor` / `--copilot` / `--windsurf` / `--opencode` / `--opencode-agent` / `--gemini`) is **deprecated** in v3 (scheduled for removal in a future version, but still works today). Only `--codex` (prompts mode) is **blocked** (errors at install time). The `/kiro:*` naming is legacy; the current naming is `/kiro-*` (no colon).

## Philosophy

> Treat a spec not as "instructions to the agent" but as "a contract between parts of the code." The code is truth; the spec makes boundaries explicit.

cc-sdd positions the spec as a contract, aiming for a division of labor where humans approve at phase gates (when the spec is finalized) and agents move freely inside the contract.

Details: [Why cc-sdd?](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/why-cc-sdd.md)

## Differences from other tools

| | cc-sdd | Kiro | GitHub Spec Kit |
|---|---|---|---|
| Provider | OSS (gotalab) | AWS | GitHub official |
| Form | npm package | IDE + CLI | Python CLI |
| Entry point | `npx cc-sdd@latest` | `curl install.sh` / Desktop | `uv tool install` |
| Number of agents | 8 | 1 (Kiro only) | 30+ |
| Spec format | Kiro-compatible (EARS) | EARS native | Core templates overridable |
| Autonomous impl | Yes (`/kiro-impl` per-task subagent + reviewer + auto-debug) | Yes (in-IDE) | Yes (`/speckit.implement`) |
| TDD enforcement | Yes (RED → GREEN + feature flag) | Yes | Via extension |
| Boundary annotation | Yes (`_Boundary:_` / `_Depends:_`) | No | Via extension |
| License | MIT | Commercial | MIT |

cc-sdd suits use cases that want **"Kiro's spec format outside of Kiro"** and **"stricter per-task subagent + boundary discipline."**

## Common AI agent mistakes

1. **Using `/kiro:*` (with colon)** — naming used up through v2.x. v3 Skills mode uses `/kiro-*` (hyphen). See the Migration Guide
2. **Installing with legacy mode (`--claude` / `--cursor` etc.)** — current flags are `--*-skills`. Legacy flags are deprecated (scheduled for removal in a future version). Only `--codex` is blocked (errors at install time)
3. **Assuming the default install covers all agents** — a single `npx cc-sdd@latest` installs for **one agent only**. Multiple agents require multiple runs
4. **Trying to make `/kiro-impl` consume all tasks in one session** — each task is designed to run in a separate subagent. It can run concurrently / be paused and resumed, but waiting for everything in the main session consumes the context window
5. **Writing `requirements.md` as plain bullet points** — assumes Kiro-compatible EARS notation. If not generated via `/kiro-spec-requirements`, the downstream reviewer may misdetect boundary violations
6. **Omitting the File Structure Plan in `design.md`** — this is the source of the `_Boundary:_` annotations in `tasks.md`. Omitting it lets the per-task subagent touch out-of-boundary code, and the reviewer enters a reject loop
7. **Skipping `/kiro-discovery` and starting from `/kiro-spec-init`** — discovery routes the work (extend an existing spec vs. new, etc.). Skipping it causes duplicate/conflicting specs
8. **Referencing docs using the legacy `/kiro:*` naming** — the v3 Migration Guide has many breaking changes. At least skim the executive summary

## References

- [github.com/gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)
- [npm: cc-sdd](https://www.npmjs.com/package/cc-sdd)
- [Skill Reference](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/skill-reference.md)
- [Migration Guide (v2.x → v3.0)](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/migration-guide.md#5-v2x-to-v30)
- [Why cc-sdd? A philosophy note](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/why-cc-sdd.md)
- Related: `ai/practice/spec-driven-development.md` / `ai/workflow/kiro.md` / `ai/workflow/github-spec-kit.md` / `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/platform/agent-extensions.md`
