---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, multi-agent]
stability: research-preview
aliases: [dynamic-workflows, ultracode]
---

# Claude Code Dynamic Workflows

A **JavaScript orchestration script execution runtime** built into Claude Code. Claude writes an orchestration script dynamically per task, and the runtime **spawns tens to hundreds of subagents in parallel**, cross-verifies the results, and merges them into a single answer. Released as a research preview on 2026-05-28, alongside the release of Claude Opus 4.8.

Official: [Anthropic blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) / [Claude Code docs](https://code.claude.com/docs/en/workflows)

This feature has a **different plan owner** than Claude Code's subagents / skills / agent teams. With subagents and skills, Claude decides what to spawn next on a turn-by-turn basis, but with a workflow, **the plan is moved into code**, so loops, branches, and intermediate results are held as script variables and do not consume Claude's context window. See `ai/agents/claude-code.md` for Claude Code's core features and extension mechanisms.

## Availability

- Available from **Claude Code v2.1.154 or later** (research preview)
- **All paid plans supported**: Pro / Max / Team / Enterprise. On Pro only, explicit opt-in is required via the Dynamic workflows line in `/config`
- Also available via **Anthropic API / Amazon Bedrock / Vertex AI / Microsoft Foundry**
- Surfaces: Claude Code CLI / Desktop / VS Code extension / `claude -p` (non-interactive mode) / Agent SDK

## How to trigger

| Method | Use |
|---|---|
| Include the keyword `ultracode` in the prompt | Runs as a workflow for this turn only (natural-language phrasing like "use a workflow" / "run a workflow" is also accepted as opt-in) |
| `/effort ultracode` | Enables `xhigh` reasoning + automatic workflow orchestration for the whole session. When Claude judges a task is workflow-shaped, it assembles one automatically |
| `/deep-research <question>` | Bundled workflow. Multi-angle web search → cross-check → cited report |
| `/<saved-workflow>` | An instruction saved by pressing `s` in the `/workflows` view |

> **Note:** Before v2.1.160 the keyword was `workflow`, but it has since been unified to `ultracode`. Natural-language phrasing like "as a workflow" is also accepted.

## Execution model

1. **Plan generation**: given the user prompt, Claude (the top-tier model) writes a JS script
2. **Approval gate**: on first launch, the script and phase list are shown, and the user chooses `Yes` / `View raw script` / `No` (Auto mode only confirms on the first run)
3. **Execution in an isolated environment**: the script runs in a runtime separate from the conversation. Only the final result is returned to Claude's context
4. **Subagent spawning**: `agent()` calls in the script spawn subagents. Each subagent is fixed to `acceptEdits` mode and inherits the session's tool allowlist
5. **Progress tracking**: the runtime persists each agent's result incrementally, enabling resume after interruption and monitoring (`/workflows`)

## Script structure

Scripts are built from the following primitives.

```js
export const meta = {
  name: 'review-changes',
  description: 'Review the current diff and verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

// One agent reviews per dimension → adversarially verify each finding
const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { phase: 'Review', schema: FINDINGS_SCHEMA }),
  review => parallel(review.findings.map(f => () =>
    agent(`Verify: ${f.title}`, { phase: 'Verify', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v }))
  ))
)
return { confirmed: results.flat().filter(f => f.verdict?.isReal) }
```

Key primitives:

| Primitive | Role |
|---|---|
| `meta` | Required pure literal frontmatter. Declares `name` / `description` / `phases` |
| `agent(prompt, opts?)` | Spawns one subagent. Passing `schema` returns the result as a Zod-like-validated object. `isolation: 'worktree'` isolates via a git worktree (only use when parallel agents touch the same files) |
| `parallel(thunks)` | Runs all thunks in parallel and waits for all to complete at a **barrier**. Use only when you truly need every result |
| `pipeline(items, ...stages)` | Each item flows independently through all stages. No barrier between stages. **This is the default** |
| `phase(title)` | Groups subsequent `agent()` calls into one progress-display group |
| `log(message)` | Emits a one-line progress message to the user |
| `args` | Input passed to a saved workflow (the `args` parameter on the command line) |
| `budget` | Token target. Use `budget.remaining() > 50_000` to decide loop depth dynamically |
| `workflow(name, args?)` | Calls another workflow as a sub-step (up to one level of nesting) |

## Constraints (enforced by the runtime)

| Constraint | Reason |
|---|---|
| No user input mid-run (only agent permission prompts are allowed) | If a stage needs approval, split it into a separate workflow per stage |
| The **script** itself cannot touch the filesystem / shell directly | I/O is handled by agents; the script does orchestration only |
| Max 16 concurrent agents (fewer on machines with fewer CPU cores) | Protects local resources |
| **Max 1000 agents** per run | Backstop against runaway loops |

## Bundled `/deep-research`

A built-in workflow that uses the WebSearch tool. It decomposes a question into multiple angles → searches the web in parallel → fetches → adversarially votes on each claim → synthesizes only the surviving claims into a cited report. Available on Pro as a research preview too (toggle required).

## Progress monitoring and operations

- `/workflows` lists running / completed workflows. Arrow keys to select, `Enter` for details
- `p` to pause/resume, `x` to stop, `r` to restart an individual agent, `s` to save

The script body is written out to a file under `~/.claude/projects/<session>/`; if you edit it and rerun, **unchanged `agent()` calls are restored instantly from cache** (within the same session only).

## Saving and reuse

Save a script from `/workflows` with `s`:

- `.claude/workflows/` — shared with the repository
- `~/.claude/workflows/` — personal, usable from all projects

Once saved, it can be invoked as `/<name>`, alongside other slash commands. Structured data (e.g., a list of issue numbers) can be passed via `args`.

## Disabling

| Method | Scope |
|---|---|
| Dynamic workflows toggle in `/config` | This user (persistent) |
| `"disableWorkflows": true` in `~/.claude/settings.json` | This user (persistent) |
| `CLAUDE_CODE_DISABLE_WORKFLOWS=1` | Wherever the environment variable is set |
| `"disableWorkflows": true` in managed settings | Organization-wide |
| [Claude Code admin settings](https://claude.ai/admin-settings/claude-code) | Organization-wide |

Disabling it removes access to both `/deep-research` and `ultracode`, and `ultracode` disappears from the `/effort` menu.

## Comparison with other Claude Code extension mechanisms

| | Subagent | Skill | Agent team | Dynamic Workflow |
|---|---|---|---|---|
| What it is | A worker Claude spawns | Instructions Claude follows | A lead agent supervising peer sessions | A script the runtime executes |
| Who decides what runs next | Claude (turn by turn) | Claude (follows the prompt) | Lead agent (turn by turn) | The script |
| Where intermediate results live | Claude's context window | Claude's context window | Shared task list | Script variables |
| Unit of reuse | Worker definition | Instructions | Team definition | The orchestration itself |
| Scale | A few per turn | Same | A few long-lived peers | **Tens to hundreds** per run |
| Interruption | Turn resumes | Turn resumes | Teammates keep running | Resumable within the same session |

Use a workflow when you want to "rerun the same script every time," "investigate broadly with hundreds of parallel agents," or "add adversarial verification between stages." Use a subagent when you just want to delegate one or two specialist tasks within a single turn.

## Real-world example

Jarred Sumner used dynamic workflows to **port the entirety of Bun (written in Zig) to Rust**. Roughly **750,000 lines** of Rust, **11 days from first commit to merge**, with **99.8% of existing tests passing**.

The process was not a single workflow but multiple workflows chained in a pipeline:

1. **Lifetime mapping** — one workflow to infer Rust lifetimes for each Zig struct field
2. **Per-file behavior port** — parallel agents write behaviorally equivalent Rust, cross-checked per file by two reviewers
3. **Fix loops** — a loop that auto-generates fixes from build errors until the build is clean
4. **Overnight optimization** — an overnight workflow that surfaces hot-path optimization opportunities

Other internally demonstrated use cases:

- Codebase-wide bug sweeps (including dead-code detection; surfaces issues static analysis misses)
- Profiler-guided optimization audits
- Security audits (auth checks, unsafe patterns)
- Large-scale migrations (framework swaps, API deprecations, language ports spanning thousands of files)

## Cost

A single run **consumes far more tokens than a normal session**. It counts against plan quotas and rate limits the same way.

Practical ways to control it:

1. **Try on a small slice first**: start with one directory instead of the whole repo, a narrow question instead of a broad one
2. **Monitor per-agent token consumption in `/workflows`** and press `x` to stop once it exceeds tolerance (completed work is not lost)
3. **Model selection**: all agents inherit the session's model. Check `/model`, and explicitly route lightweight stages to Haiku within the script
4. The **agent cap** (1000 / 16 concurrent) serves as the ceiling for a runaway script

## Common mistakes AI agents make

1. **Trying to trigger with the "workflow" keyword** — changed to `ultracode` in v2.1.160. Don't rely on older blog posts
2. **Overusing barriers via `parallel()`** — waiting for all agents at every stage inflates "idle time for the fastest agent." `pipeline()`, with no barrier between stages, is the correct default
3. **Building a workflow for a small task** — racks up tokens. If "delegating to a single-turn subagent is enough," don't use a workflow. Keep `ultracode` off
4. **Approving without viewing the script** — should be checked via `View raw script` on first launch. Claude sometimes assembles an unexpectedly adversarial loop
5. **Trying to write filesystem operations into the script** — the script is orchestration-only. The `fs` module is unavailable. I/O must go through agents
6. **Using `Math.random()` / `Date.now()`** — the runtime throws, since these break determinism on resume. Express randomness via agent prompts or indices instead
7. **Leaving `ultracode` on during everyday coding** — every task turns into a workflow and keeps consuming tokens. Drop back to `/effort high` once back to routine work
8. **Writing unbounded loops that trust the 1000-agent cap** — the cap is a safety net. The script itself should check `budget.remaining()` to converge properly
9. **Forgetting agent tool permissions** — subagents within a workflow inherit the session's allowlist but are fixed to `acceptEdits`. For long runs, pre-allowlist any commands needed so permission prompts don't interrupt

## References

- [Introducing dynamic workflows in Claude Code (Anthropic)](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- [Claude Code Docs: Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Introducing Claude Opus 4.8 (release announcement)](https://www.anthropic.com/news/claude-opus-4-8)
- [InfoQ: Claude Code Adds Dynamic Workflows for Parallel Agent Coordination](https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/)
- Related: `ai/agents/claude-code.md` / `ai/agents/claude-code-routines.md` / `ai/practice/multi-agent-coordination.md` / `ai/practice/agentic-workflow-patterns.md` / `ai/platform/agent-extensions.md`
