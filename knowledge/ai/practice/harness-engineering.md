---
reviewed: 2026-07-12
tags: [ai-workflow, methodology, practice]
aliases: [harness, agentic-harness, harness-engineering]
---

# Harness Engineering

The practice of designing the **harness** — everything around an LLM that isn't the model itself — so that agents work reliably. The core framing is **`Agent = Model + Harness`**: the harness is all the code, configuration, tools, verification, and execution logic that turns a raw model into a working agent. As models commoditize, the harness is increasingly where engineering effort and differentiation live. It is the superset that [Loop Engineering](loop-engineering.md) (the iterative cycle) sits inside.

## What is a harness

Viv Trivedy's framing (LangChain, "The Anatomy of an Agent Harness", 2026-03-10): **"If you're not the model, you're the harness."** A harness is every piece of code, configuration, and execution logic that isn't the model — the scaffold that decides how work is split, which tools the agent gets, how output is verified, and when the job is done. Claude Code, Codex, Cursor, Aider, and Cline are all production harnesses; despite different underlying models they converge on similar harness patterns.

**Why it matters**: the same model performs very differently depending on its harness. Trivedy reports moving a coding agent from roughly the top 30 to the top 5 on Terminal Bench 2.0 by **changing only the harness, not the model**. HumanLayer summarizes the mindset shift as *"it's not a model problem, it's a configuration problem."*

## Positioning (harness ⊃ loop ⊃ context ⊃ prompt)

| Layer | What is engineered |
|---|---|
| **Harness engineering** | The whole engineered scaffold around the model (`Agent = Model + Harness`) |
| **Loop engineering** | A slice *inside* the harness: the iterative cycle (invocation, tools, verification, stopping, recovery, state). See [Loop Engineering](loop-engineering.md) |
| **Context engineering** | Which tokens enter the window per inference. See [Context Management](ai-context-management.md) |
| **Prompt engineering** | Shaping a single input |

These nest rather than compete. LangChain's "The Art of Loop Engineering" (2026-06-16) frames the harness as the overall engineered system and loops as the iterative mechanisms within it. Some practitioners use "harness" and "loop" near-synonymously; the cleanest distinction is **loop engineering as the iterative-cycle subset of harness engineering**.

## Constituent elements of a harness

| Element | Concern | Related |
|---|---|---|
| **Agent loop** | The gather → act → verify cycle (ReAct) | [Loop Engineering](loop-engineering.md) |
| **Tools / ACI** | Tool set, skills, MCP servers and their descriptions; bash/code execution | [Tool Design (ACI)](agent-tool-design.md) |
| **Context management** | Compaction, just-in-time loading, context resets, memory files | [Context Management](ai-context-management.md) |
| **Verification / feedback** | Tests-first, evaluators, generator–evaluator split, back-pressure signals | [Agent Evaluation](agent-evaluation.md) |
| **Environment / sandbox** | Filesystem + git for durable state, sandboxing, bundled runtimes/browser | [Multi-Agent Repo](multi-agent-repo.md) |
| **Orchestration** | Subagent spawning/handoffs, model routing, planner/evaluator splits, dynamic workflows | [Multi-Agent Coordination](multi-agent-coordination.md) |
| **Execution control / hooks** | Deterministic hooks, destructive-action blocking, linting, compaction triggers | [Reliability & Guardrails](agent-reliability-guardrails.md) |
| **Recovery** | git revert, checkpoints, health checks | [Loop Engineering](loop-engineering.md) |
| **Permissions / guardrails** | Tool boundaries, prompt-injection mitigation, scoped credentials | [Prompt Injection](prompt-injection.md) |
| **Observability** | Logs, traces, cost/latency metering | [Agentic Observability](agentic-observability.md) |

## Anthropic guidance

Anthropic uses the terms "harness" and "harness design" (though not the branded "harness engineering"):

- **"Effective harnesses for long-running agents"** (2025-11-26) — a **two-agent architecture** (an *initializer* agent for one-time environment setup + a *coding* agent for incremental work), a **feature-list JSON** with pass/fail status as the source of truth, a `claude-progress.txt` plus git history for context-window handoffs, `init.sh` startup scripts, one feature at a time, git-based recovery, and **verification-first** development. A strongly worded guardrail: *"It is unacceptable to remove or edit tests"* to make a feature pass.
- **"Harness design for long-running application development"** (2026) — adds **generator–evaluator separation** (a separate agent judges the work, countering self-evaluation bias), **sprint contracts** (pre-negotiated done-conditions), and **context resets** between sessions to prevent premature completion ("context anxiety").
- **"A harness for every task: dynamic workflows in Claude Code"** (2026-06-02) — Claude **writes its own harness on the fly** as a JavaScript workflow that spawns and coordinates subagents. Names three single-context failure modes — **agentic laziness, self-preferential bias, goal drift** — and orchestration patterns (fan-out-and-synthesize, adversarial verification, tournament, classifier). See [`../agents/claude-code-dynamic-workflows.md`](../agents/claude-code-dynamic-workflows.md).

## Practice: fix the environment, not the prompt

Mitchell Hashimoto's rule (the earliest verified use of "harness engineering", 2026-02-05): whenever an agent makes a mistake, engineer a **permanent** fix into its environment — update `AGENTS.md`, add a verification script, add a blocking hook — so it **never makes that mistake again**. HumanLayer's operational corollaries:

- **Fix only observed failures.** Don't preemptively over-configure; shape the harness from your codebase's *specific* failure history.
- **Keep instruction files small** (they keep `CLAUDE.md` / `AGENTS.md` under ~60 lines).
- **Sub-agents as a "context firewall"** — run discrete tasks in isolated context windows.

## Common AI Agent Mistakes

1. **"Blame filing"** — blaming the model and waiting for the next version instead of fixing the harness. Most failures are harness/configuration problems.
2. **Downloading a "universal" harness** — the right harness is shaped by your codebase's failure history; a generic one under-fits.
3. **Preemptive over-configuration** — encoding rules for problems you haven't observed bloats instruction files and hurts adherence. Fix observed failures only.
4. **Marking work complete without testing** (agentic laziness) — require end-to-end verification and a feature-list checklist, not just "tests pass".
5. **Self-evaluation bias** — the agent judging its own work is lenient; separate the generator from the evaluator.
6. **Deleting or commenting out tests to go green** — block it with pre-commit hooks; per Anthropic it is "unacceptable".

## Term status and attribution

"Harness engineering" is a **practitioner/community term, not Anthropic-official** (the same status as [Loop Engineering](loop-engineering.md)). Attribution is contested: the exact phrase was **proposed by Mitchell Hashimoto** (Feb 2026, who noted no industry term existed yet) and **popularized by Viv Trivedy's "The Anatomy of an Agent Harness"** (Mar 2026), which supplied the `Agent = Model + Harness` framing that others cite. By mid-2026 it had heavy pickup (O'Reilly Radar, Thoughtworks, community `awesome-harness-engineering` lists), with some skeptics arguing it renames an old idea. Definitions vary across sources.

## Related

- [Loop Engineering](loop-engineering.md) — the iterative-cycle subset of the harness
- [Tool Design for AI Agents (ACI)](agent-tool-design.md) / [Context Management](ai-context-management.md) / [Reliability & Guardrails](agent-reliability-guardrails.md)
- [Multi-Agent Coordination](multi-agent-coordination.md) / [`../agents/claude-code-dynamic-workflows.md`](../agents/claude-code-dynamic-workflows.md) — orchestration and self-writing harnesses

## References

- Viv Trivedy: [The Anatomy of an Agent Harness](https://www.langchain.com/blog/the-anatomy-of-an-agent-harness) (2026-03-10, `Agent = Model + Harness`)
- Mitchell Hashimoto: [My AI Adoption Journey](https://mitchellh.com/writing/my-ai-adoption-journey) (2026-02-05, coins "harness engineering")
- HumanLayer: [Skill Issue: Harness Engineering for Coding Agents](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) (2026-03-12)
- Anthropic: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (2025-11-26)
- Anthropic: [A harness for every task: dynamic workflows in Claude Code](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code) (2026-06-02)
- LangChain: [The Art of Loop Engineering](https://www.langchain.com/blog/the-art-of-loop-engineering) (2026-06-16, loop ⊂ harness)
