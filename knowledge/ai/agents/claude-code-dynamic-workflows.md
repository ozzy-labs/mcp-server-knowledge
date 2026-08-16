---
reviewed: 2026-08-16
tags: [ai-agent, ai-workflow, commercial, multi-agent]
aliases: [dynamic-workflows, ultracode]
---

# Claude Code Dynamic Workflows

A **JavaScript orchestration script execution runtime** built into Claude Code. Claude writes an orchestration script dynamically per task, and the runtime **spawns tens to hundreds of subagents in parallel**, cross-verifies the results, and merges them into a single answer. Released as a research preview on 2026-05-28 (alongside Claude Opus 4.8), it is now **generally available** across the Claude Code CLI, the Desktop app, the IDE extensions, `claude -p`, and the Agent SDK.

Official: [Anthropic blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) / [Claude Code docs](https://code.claude.com/docs/en/workflows)

This feature has a **different plan owner** than Claude Code's subagents / skills / agent teams. With subagents and skills, Claude decides what to spawn next on a turn-by-turn basis, but with a workflow, **the plan is moved into code**, so loops, branches, and intermediate results are held as script variables and do not consume Claude's context window. See `ai/agents/claude-code.md` for Claude Code's core features and extension mechanisms.

## Availability

- Available from **Claude Code v2.1.154 or later** (now GA)
- **All paid plans supported**: Pro / Max / Team / Enterprise. On Pro only, explicit opt-in is required via the Dynamic workflows line in `/config`
- Also available via **Anthropic API / Amazon Bedrock / Google Cloud's Agent Platform / Microsoft Foundry**
- Surfaces: Claude Code CLI / Desktop app / IDE extensions / `claude -p` (non-interactive mode) / Agent SDK

## How to trigger

| Method | Use |
|---|---|
| Include the keyword `ultracode` in the prompt | Runs as a workflow for this turn only (natural-language phrasing like "use a workflow" / "run a workflow" is also accepted as opt-in) |
| `/effort ultracode` | Enables `xhigh` reasoning + automatic workflow orchestration for the whole session. When Claude judges a task is workflow-shaped, it assembles one automatically |
| `claude --effort ultracode` | Launch flag (**v2.1.203+**) that starts the session at `xhigh` + workflow orchestration |
| `/deep-research <question>` | Bundled workflow. Multi-angle web search → cross-check → cited report |
| `/<saved-workflow>` | An instruction saved by pressing `s` in the `/workflows` view |

> **Note:** Before v2.1.160 the keyword was `workflow`, but it has since been unified to `ultracode`. Natural-language phrasing like "as a workflow" is also accepted.
>
> **Since v2.1.210 the keyword is an opt-in only in a prompt you type yourself** — the interactive prompt, an IDE extension panel, a Remote Control client, or an Agent SDK application that stamps the input's `origin` as `{ kind: "human" }`. It no longer starts a workflow from a `-p` prompt, a non-human SDK prompt, a scheduled task prompt, or a webhook payload / pull request comment relayed into the conversation. Press `Option+W` (macOS) / `Alt+W` (Windows, Linux) to dismiss the highlight for the current prompt, or turn off **Ultracode keyword trigger** in `/config` to stop it triggering at all.

## Execution model

1. **Plan generation**: given the user prompt, Claude (the top-tier model) writes a JS script
2. **Approval gate**: on first launch, the script and phase list are shown, and the user chooses `Yes, run it` / `Yes, and don't ask again for <name> in <path>` / `View raw script` / `No` (`Ctrl+G` opens an editor, `Tab` adjusts the prompt; Desktop shows Once / Always / Deny cards, plus a token-usage caution, and the progress view lands in the Background tasks side pane). Whether you are prompted depends on the permission mode: **Auto** prompts on first launch only (any `Yes` records consent in your user settings, and it is skipped entirely while `ultracode` is on), **Manual / accept edits** prompt every run unless you chose *don't ask again* for that workflow in this project, and **Bypass permissions / `claude -p` / Agent SDK** never prompt
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
| `meta` | Required pure literal frontmatter. `name` and `description` are required; `phases` is optional (the docs' reference script omits it) |
| `agent(prompt, opts?)` | Spawns one subagent. `schema` (a **JSON Schema** object) returns the result as a validated object; `label` names the agent in the progress view. `isolation: 'worktree'` isolates via a git worktree (only use when parallel agents touch the same files). The call **resolves to `null`** if you stop it mid-run or it hits an unrecoverable API error |
| `parallel(thunks)` | Runs all thunks in parallel and waits for all to complete at a **barrier**. Use only when you truly need every result |
| `pipeline(items, ...stages)` | Each item flows independently through all stages. No barrier between stages. **This is the default**. It keeps the `null` from a stopped or failed `agent()` in the results array, so end with `.filter(Boolean)` when those entries matter |
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
| No module loading — a script containing `import()` fails before the run starts | The script body is plain JavaScript; work that needs a library belongs in an agent's task |
| Max 16 concurrent agents (fewer when Claude Code has fewer CPUs available, including inside a CPU-limited container) | Protects local resources |
| In a fan-out, agents that share the first agent's prompt-cache prefix start up to **5 s** after it (`CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS`, default `5000`; set `0` to disable the hold) | All but the first read the prefix the first agent cached instead of each processing it uncached |
| **Max 1000 agents** per run | Backstop against runaway loops |

## Bundled `/deep-research`

A built-in workflow that uses the WebSearch tool. It decomposes a question into multiple angles → searches the web in parallel → fetches → adversarially votes on each claim → synthesizes only the surviving claims into a cited report. Available on Pro as well, once the Dynamic workflows row is enabled in `/config`. It requires the WebSearch tool, and a claim the verifier agents could not check (rate limit, API error) is reported as **unverified** rather than counted as refuted.

## Progress monitoring and operations

- `/workflows` lists running / completed workflows, showing each phase's agent count, token total, and elapsed time. `↑` / `↓` selects, `Enter` or `→` drills into a phase and then into an agent (prompt, recent tool calls, result), `Esc` or `←` backs out one level — on **v2.1.203 through v2.1.205** `←` did not back out, so use `Esc` there
- `j` / `k` scroll within an agent's detail when it overflows; `f` filters the selected phase's agent list by status (press again to cycle)
- `p` to pause/resume, `x` to stop the selected agent (or the whole workflow when focus is on the run), `r` to restart a running agent, `s` to save
- A one-line progress summary also appears in the task panel below the input box: `↓` focuses it, `Enter` expands it

The script body is written out to a file under `~/.claude/projects/<session>/`, and Claude receives that path when the run starts — so you can ask for it, read the orchestration, diff it against a previous run's script, or edit it and ask Claude to relaunch from the edited version.

Resume replays in **agent start order**, not by matching script content: cached results stop at the first agent that did not finish, and every agent that started after it runs again even if it had completed. Stopping mid fan-out is therefore expensive, and a workflow spread across many small agents preserves more progress than one long agent. Resume works **within the same session only** — exiting Claude Code while a workflow is running makes the next session start it fresh.

## Saving and reuse

Save a script from `/workflows` with `s`:

- `.claude/workflows/` — shared with the repository
- `~/.claude/workflows/` — personal, usable from all projects (follows `CLAUDE_CONFIG_DIR` when set; the save dialog shows the resolved path)

Once saved, it can be invoked as `/<name>`, alongside other slash commands. Structured data (e.g., a list of issue numbers) can be passed via `args`; Claude passes it as structured data, so the script can call array and object methods on `args` directly without parsing. If `args` is omitted, the global is `undefined`.

Additional save behavior:

- **Monorepos (v2.1.178+)**: the project save writes to the closest existing `.claude/workflows/` between the working directory and the repository root, or to the repo root if none exists. Project workflows load from every `.claude/workflows/` along that path, and the one closest to the working directory wins a name clash
- **Precedence**: a project workflow beats a personal workflow of the same name
- **Symlinks (v2.1.216+)**: Claude Code refuses to write through a symlink. The project location rejects a symlinked `.claude`, `.claude/workflows`, or target file; the personal location rejects only a symlinked target file, so a dotfiles-managed `~/.claude` still works. Earlier versions followed the link and could write outside the chosen location
- **Plugins**: to share across teams or repos, put the script in a `workflows/` directory at the plugin root (or point elsewhere with the `workflows` manifest field). Plugin workflows are namespaced — `meta.name: release-audit` inside plugin `acme-tools` runs as `/acme-tools:release-audit`

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
| Interruption | Restarts the turn | Restarts the turn | Teammates keep running | Resumable within the same session |

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
3. **Model selection**: all agents inherit the session's model unless the script routes a stage elsewhere, and `CLAUDE_CODE_SUBAGENT_MODEL` overrides both. Check `/model`, and ask for a smaller model on stages that don't need the strongest one. If an organization's `availableModels` allowlist blocks the model the script requests, that agent runs on a substituted model and `/workflows` shows a warning naming both
4. The **agent cap** (1000 / 16 concurrent) serves as the ceiling for a runaway script
5. **Cap workflow size**: the **Dynamic workflow size** setting (v2.1.202+) advises Claude to keep a run `small` (<5 agents) / `medium` (<15) / `large` (<50) / `unrestricted` (no guideline). The default is **`medium`** as of **v2.1.219**; earlier versions defaulted to `unrestricted`. Set it from the `/config` row, with `/config workflowSizeGuideline=small`, or (v2.1.219+) via the `workflowSizeGuideline` key in any settings file — a settings file takes precedence over `/config` and hides that `/config` row. It is advice, not a cap: a prompt calling for a different scale still overrides it, the runtime agent caps still apply, and changes take effect on the next prompt. A **Large workflow** warning appears in the task panel above 25 scheduled agents or 1.5M projected tokens — advisory only, suppressed while `ultracode` is on, and a guideline you choose yourself replaces the 25-agent threshold with its own agent count

## Common mistakes AI agents make

1. **Trying to trigger with the "workflow" keyword** — changed to `ultracode` in v2.1.160. Don't rely on older blog posts. Since v2.1.210 the keyword is also ignored outside prompts you type yourself (`-p`, non-human SDK prompts, scheduled tasks, webhooks, PR comments) — invoke a saved workflow command there instead
2. **Overusing barriers via `parallel()`** — waiting for all agents at every stage inflates "idle time for the fastest agent." `pipeline()`, with no barrier between stages, is the correct default
3. **Building a workflow for a small task** — racks up tokens. If "delegating to a single-turn subagent is enough," don't use a workflow. Keep `ultracode` off
4. **Approving without viewing the script** — should be checked via `View raw script` on first launch. Claude sometimes assembles an unexpectedly adversarial loop
5. **Trying to write filesystem operations into the script** — the script is orchestration-only. There is no module loading at all: a script containing `import()` fails before the run even starts. I/O must go through agents
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
