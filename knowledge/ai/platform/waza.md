---
reviewed: 2026-08-10
tags: [ai-platform, cli, test, go]
aliases: [microsoft/waza, skill eval]
---

# waza (Agent Skills evaluation CLI)

`microsoft/waza` is a **Go CLI for creating, testing, and measuring Agent Skills**. It scaffolds a skill plus an eval suite, runs YAML-defined benchmarks against real models in isolated fixture workspaces, scores the runs with pluggable graders, and gates CI on regressions. It answers the question every skill author eventually hits — *"is this skill actually working?"* — with numbers instead of vibes. First released 2026-02-27; as of 2026-08-10 the latest release is **v0.38.5** (2026-08-07), MIT-licensed.

Official: [microsoft.github.io/waza](https://microsoft.github.io/waza/) · Repository: [microsoft/waza](https://github.com/microsoft/waza)

For evaluation methodology (outcome vs trajectory, LLM-as-judge bias, pass@k / pass^k) see [`../practice/agent-evaluation.md`](../practice/agent-evaluation.md); for what makes a skill good in the first place see [`agent-skills-best-practices.md`](agent-skills-best-practices.md).

## Installation

```bash
# macOS / Linux / Git Bash
curl -fsSL https://raw.githubusercontent.com/microsoft/waza/main/install.sh | bash
# native Windows PowerShell
irm https://raw.githubusercontent.com/microsoft/waza/main/install.ps1 | iex
```

Also available as an Azure Developer CLI extension (`azd ext install microsoft.azd.waza`, then `azd waza …`). Building from source needs **Go 1.26+ and Git LFS** (`go install` does not work — the repo embeds Copilot binaries as LFS artifacts). `waza update` re-runs the official installer; the background version check is disabled with `--no-update-check` or `WAZA_NO_UPDATE_CHECK=1`.

Execution goes through the bundled **GitHub Copilot CLI** (`copilot-sdk` executor), extracted to the user cache on first use — so real runs need `copilot login`. Use the `mock` executor for deterministic, credential-free tests.

## Workflow

```bash
waza init my-project && cd my-project   # skills/ + evals/ + .github/workflows/eval.yml
waza new skill my-skill                 # scaffold SKILL.md + eval suite
waza suggest skills/my-skill --apply    # LLM-generated tasks/fixtures (merge-safe)
waza run my-skill -v                    # execute the benchmark
waza check skills/my-skill              # readiness report before publishing
```

A project workspace separates `skills/<name>/SKILL.md` from `evals/<name>/{eval.yaml,tasks/,fixtures/}`; outside a workspace, `waza new skill` emits a self-contained standalone directory instead. APM-managed skills are detected from their compiled `.apm/skills/<name>/SKILL.md` output, with a top-level `SKILL.md` taking precedence when both exist.

## Commands

| Command | Purpose |
|---|---|
| `init` / `new skill` / `new eval` / `new task from-prompt` | Scaffold a workspace, skill, eval suite, or a task YAML recorded from a live prompt run |
| `run` / `grade` / `compare` | Execute a benchmark, grade previously captured output, diff results across runs or models |
| `gate` | CI verdict: compare a candidate results file against a baseline |
| `check` / `quality` / `dev` | Readiness report, LLM-as-judge content scoring, iterative frontmatter improvement |
| `spec verify` / `coverage` | Verify the eval suite exercises `SKILL.md`'s promises; render a skill-to-eval coverage grid |
| `adversarial` | Run offline prompt-injection / scope-bypass fault-injection packs |
| `replay` | Re-run a captured snapshot offline to check determinism (`--bisect` finds the first divergent turn) |
| `tokens count/compare/profile/suggest` | SKILL.md token budgeting, including `--skills --threshold` CI gating against `origin/main` |
| `serve` / `results` / `session` | Dashboard (HTTP, or JSON-RPC via `--tcp`), stored run management, session event logs |
| `models` / `cache clear` / `migrate` | List Copilot SDK models, clear the result cache, check schema migration needs |

## Eval spec

`eval.yaml` is at `schemaVersion: "1.2"` (readers accept same-major minor additions with warnings and reject a different major, pointing at `waza migrate`).

```yaml
name: my-eval
skill: my-skill
schemaVersion: "1.2"

config:
  trials_per_task: 3        # repeat each task to expose flakiness
  max_attempts: 3           # grader retries (default 1)
  timeout_seconds: 300
  executor: copilot-sdk     # or `mock`
  model: claude-sonnet-4-20250514
  instruction_files:
    - .github/instructions/project.instructions.md

inputs:                     # available as {{.Vars.key}} in tasks, hooks, graders
  environment: production

graders:
  - type: text
    name: pattern_check
    config:
      regex_match: ["\\d+ tests passed"]
  - type: behavior
    name: efficiency
    config:
      max_tool_calls: 20
      max_duration_ms: 300000

tasks:
  - "tasks/*.yaml"          # or `tasks_from: ./test-cases.csv` with `range: [1, 10]`
```

Additional blocks: `hooks` (`before_run` / `after_run` / `before_task` / `after_task`), `mcp_mocks` (local stdio MCP servers with `match` / `match_schema` / `match_regex` fixtures, for hermetic runs with no network or credentials), and `adversarial` (pin built-in packs plus `on_unsafe_outcome: fail|warn`).

Per-task, `inputs.context.fixture` copies a fixture file or directory into the fresh workspace, and `inputs.responder` configures an LLM that plays the user for skills that ask follow-up questions — it either replies, stops, or **abstains** (a distinct failure outcome meaning "the brief was too vague"), with `max_followups` capping the loop.

## Graders

Graders return `score` (0.0–1.0), `passed`, `feedback`, and `details`. Twelve types are implemented: `text`, `code`, `file`, `diff`, `json_schema`, `behavior`, `action_sequence`, `skill_invocation`, `tool_constraint`, `trigger`, `prompt` (LLM-as-judge), and `program` (external script; output arrives on stdin, workspace path via `WAZA_WORKSPACE_DIR`, exit code 0 = pass).

Six more are documented but **not implemented** — `llm`, `llm_comparison`, `human`, `human_calibration`, `script`, `tool_calls`. Use `prompt` for LLM-as-judge scoring; Azure AI Evaluation SDK evaluators (relevance, coherence, fluency, groundedness, content safety) map onto it as rubrics.

## CI integration

Exit codes are stable and documented, which is what makes waza usable as a gate:

| Command | Exit codes |
|---|---|
| `run` | `0` all passed, `1` test failure, `2` configuration error |
| `gate` | `0` pass, `1` pass-rate regression beyond threshold, `2` a golden task failed (takes precedence), `3` config error |
| `adversarial` | `0` all packs passed, `2` unsafe outcome with `policy=fail`, `3` config error |

`gate` compares a candidate results file against a baseline with `--max-regression-pct`, golden-task enforcement, and `allow` / `warn` / `fail` policies for newly added and removed tasks, emitting `human`, `json`, `markdown`, or `github-actions` output. `waza run --format github-comment` produces a PR comment body, `--reporter junit:<path>` produces JUnit XML, and `--baseline` runs each task twice (without and with the skill) to measure the skill's actual delta.

## Common AI Agent Mistakes

1. **Using grader type `llm`** — it is listed in the docs but not implemented. LLM-as-judge is the `prompt` grader.
2. **Expecting `--cache` to always apply** — caching is silently disabled for non-deterministic graders (`behavior`, `prompt`), so cached runs are not a substitute for `--trials`.
3. **Measuring trigger precision with skill body injection on** — an eval with `skill: <name>` injects the `SKILL.md` body into the system prompt by default; disable it when the thing under test is *whether the skill fires at all*.
4. **Writing `.token-limits.json`** — deprecated in favor of the `tokens.limits` section of `.waza.yaml`; it still works but warns.
5. **Running real evals without Copilot auth** — the default executor is the bundled Copilot CLI. Without `copilot login` the run fails; use `executor: mock` for scaffolding tests.
6. **Treating a single run as a result** — non-determinism means one pass proves little. Use `trials_per_task` / `--trials` and gate on the aggregate.

## References

- [waza documentation](https://microsoft.github.io/waza/) — [custom agents](https://microsoft.github.io/waza/guides/custom-agents/) / [adversarial harness](https://microsoft.github.io/waza/guides/adversarial/) / [OpenTelemetry tracing](https://microsoft.github.io/waza/guides/otel/)
- [microsoft/waza](https://github.com/microsoft/waza) — [grader reference](https://github.com/microsoft/waza/blob/main/docs/graders/README.md) / [CI/CD guide](https://github.com/microsoft/waza/blob/main/docs/CI-CD-GUIDE.md) / [token limits](https://github.com/microsoft/waza/blob/main/docs/TOKEN-LIMITS.md)
- Related: [`../practice/agent-evaluation.md`](../practice/agent-evaluation.md), [`agent-skills-spec.md`](agent-skills-spec.md), [`agent-skills-best-practices.md`](agent-skills-best-practices.md), [`apm.md`](apm.md)
