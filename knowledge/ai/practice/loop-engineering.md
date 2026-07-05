---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# Loop Engineering

A practice of reframing AI agents not as "something you drive by typing a prompt each time" but as "**something you design as an autonomous loop that keeps running**." The starting premise: now that coding agents have gotten smart enough, the developer's added value has shifted from "writing good prompts" to "**designing the loop the agent runs in (stop conditions, verification, recovery, state)**."

A relatively new term, systematized and named "Loop Engineering" by Addy Osmani in 2026, organized around quotes from Anthropic's Boris Cherny ("I no longer prompt Claude. I run a loop that prompts Claude.") and Peter Steinberger ("Stop prompting coding agents — design loops instead"). It is a community/practitioner-driven concept, not an academically established definition. For agent design patterns in general, see [Agentic Workflow Patterns](agentic-workflow-patterns.md); for context-window usage, see [AI Agent Context Management](ai-context-management.md).

## Positioning relative to prompt / context engineering

| Focus of concern | What is being designed |
|---|---|
| **Prompt engineering** | A single input. Instruction phrasing, examples, output format |
| **Context engineering** | Curation of which tokens go into the context window at inference time |
| **Loop engineering** | The **iterative cycle the agent runs in itself**. Invocation, tools, verification, stopping, recovery, state |

The three are not mutually exclusive but layered. Context engineering operates within each iteration of the loop, and prompt engineering operates within the instructions of each step. Note that the "prompt → context → loop" staged-evolution framing is widely used in secondary commentary, but it is not an explicit staged theory found in primary sources.

## What is an agent loop

Anthropic defines an agent in minimal terms as:

> LLMs autonomously using tools in a loop.

What matters here is the **distinction between agent and workflow** (Anthropic, "Building Effective Agents"):

- **Workflow** — LLMs and tools are orchestrated through **predefined code paths** (control resides on the human-written code side)
- **Agent** — the LLM **dynamically directs its own process and tool use**, retaining control over how the goal is achieved

An agent is nothing more than "an LLM running in a loop, using tools based on feedback from the environment," and the key is that at each step it obtains **ground truth** from the environment (tool results, code execution results) to evaluate progress. The thought → action → observation iteration of ReAct (Yao et al., 2022) is the academic prototype for this loop.

## The typical loop cycle

The official Claude Code documentation explains that an agent iterates by blending three phases:

```text
┌─────────────────────────────────────────┐
│  gather context  →  take action  →  verify  │
└──────────────△──────────────────────┬───┘
               └──── course-correct using what was learned in the previous step ◀┘
```

- **gather context** — grasp the current state via file search, reading, tool calls
- **take action** — edits, command execution. Each tool result feeds back into the next decision
- **verify** — confirm one's own output via tests, type checks, cross-checking against expected output
- Repeat this until completion, applying what was learned in the previous step to course-correct the next

The agent itself (the CLI side) is positioned as the **agentic harness** that runs this loop. The quality of the loop is determined by "how carefully you design the tools and the loop" (Simon Willison, "Designing agentic loops").

## Components of loop design

### 1. Termination / stop conditions

The key to preventing infinite loops and token waste. The very definition of "achieving a goal" implies the existence of a stop condition.

- The basic pattern is natural termination on task completion, but explicit stop conditions such as a **maximum iteration count** should be added to retain control (Anthropic)
- Set a **budget limit** for costly tools (Willison)
- Configurations that delegate the completion judgment to a separate small model/check (e.g., continue until a condition becomes true) are also used

### 2. Verification / self-correction feedback loop

An agent performs better when it **can verify its own output**. Building "a means to cross-check against the correct answer" into the loop is the single highest-ROI investment.

- Give the agent a **verification target** — a test suite, screenshots, expected output, etc.
- Put verification first, e.g. "get an end-to-end test passing before implementing the feature" (Anthropic, "Effective harnesses for long-running agents")
- Reflection (where the generated output is critiqued and fixed by itself or another agent) is one form of a verification loop. See [Agentic Workflow Patterns](agentic-workflow-patterns.md) for details

### 3. Error recovery

In long-running loops, prepare a recovery path from failure from the outset.

- **Revert bad changes with git** so you can return to a working state (Anthropic)
- A mechanism to quickly detect "has this been left in a broken state" (health checks, checkpoints)
- Claude Code edits are reversible via checkpoints

### 4. State / memory

Persist progress outside the conversation. The foundation for continuing a loop beyond the context window.

- Leave a record of "what was done" in a **progress log file** (e.g., `claude-progress.txt`), committing and updating progress at the end of a session (Anthropic)
- For context management (compaction, sub-agents, just-in-time loading), see [AI Agent Context Management](ai-context-management.md)

### 5. Observability

Making it visible whether the loop is running away or spinning idle. Tracking of thoughts, tool calls, and token consumption. In primary sources this often appears as the implementation of a "progress log"; full-fledged agent observability such as OpenTelemetry is still developing.

### 6. Human-in-the-loop (HITL)

Balancing full autonomy against human control.

- **Stop for human feedback** at checkpoints or when a blocker is encountered (Anthropic)
- Approval-by-default operation vs. fully automatic ("YOLO mode") is a tradeoff. Fully automatic is productive but dangerous, so isolate it with **sandboxing in Docker / remote environments** and **tightly scoped credentials** (Willison)
- For design details, see [Human-in-the-Loop Patterns](human-in-the-loop.md)

## Implementation elements for assembling a loop

Osmani lists the concrete parts that replace "yourself typing prompts." Most correspond to existing articles.

| Element | Role | Related article |
|---|---|---|
| **Automations / scheduled invocation** | Run the loop on a schedule or trigger | [Scheduled Execution of AI Agents](scheduled-tasks.md) |
| **Worktrees** | Isolate parallel agents via git worktree | — |
| **Skills** | Encode project knowledge for constant reference | [Agent Skills Spec](../platform/agent-skills-spec.md) |
| **Plugins / connectors** | Integrate tools via MCP | [MCP Protocol](../platform/mcp-protocol.md) |
| **Sub-agents** | Separate ideation and verification into different contexts | [Multi-Agent Coordination](multi-agent-coordination.md) |
| **State / Memory** | Persistently track progress outside the conversation | [Context Management](ai-context-management.md) |

The observation that a practical agent can be built from just "an LLM + a loop + enough tokens" — Thorsten Ball's "How to Build an Agent" demonstrated this in under 400 lines, and Geoffrey Huntley's "Ralph Loop" is a simple shell loop that repeatedly feeds the same prompt via `while :; do … done` — supports the claim that the loop itself is the central source of value.

## Anti-patterns

- **A loop with no stop condition** — repeats the same fix without improvement, wasting tokens (the "infinite loop" in [Agentic Workflow Patterns](agentic-workflow-patterns.md))
- **A loop with no means of verification** — without a verify target (tests, expected output), the agent cannot notice its own mistakes
- **Lack of a recovery path** — without revert/checkpoints, you cannot return from a broken state once it occurs, and the damage accumulates
- **Full automation without observation** — running YOLO operation with no logging or approval in a production environment with no scoped permissions or sandbox
- **Over-application of "loopify"** — wrapping even one-off tasks in a loop/automation. This violates the principle in [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) of "start with the simplest solution and only add complexity when needed"

## References

- Anthropic: [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) (2024-12, the agent/workflow distinction, stopping conditions, ACI)
- Anthropic: [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (2025-09-29, "LLMs autonomously using tools in a loop", compaction / sub-agent / just-in-time)
- Anthropic: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (2025-11-26, verification tools, git revert, progress logs)
- Claude Code Docs: [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works) (gather context → take action → verify, agentic harness)
- Addy Osmani: [Loop Engineering](https://addyosmani.com/blog/loop-engineering/) (2026-06-07, systematization of the term)
- Simon Willison: [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/) (2025-09-30, loop design, budget limits, sandboxing)
- Thorsten Ball: [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent)
- Yao et al.: [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629) (the original source of the thought/action/observation loop)
