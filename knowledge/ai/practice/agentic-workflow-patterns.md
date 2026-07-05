---
reviewed: 2026-06-07
tags: [ai-workflow, methodology, practice]
---

# Agentic Workflow Patterns

A set of design patterns that let AI agents move beyond simple response tools and autonomously complete complex tasks. Centered on the four fundamental patterns proposed by Andrew Ng, as of 2026 they have evolved into "structured orchestration" with higher reliability and observability.

## The Four Core Patterns

| Pattern | Overview | 2026 characteristics |
|---|---|---|
| **Reflection** | The generated output is critiqued by the agent itself (or another agent), with fixes applied iteratively. | Advanced through role-based, multi-perspective critique. |
| **Tool Use** | External APIs, search, and code-execution environments are used to perform actions. | **Tool-first design**. High interoperability driven by the spread of MCP. |
| **Planning** | Goals are decomposed into steps and executed sequentially. | Dynamic replanning (Plan-Act-Reflect-Repeat) is now mainstream. |
| **Multi-agent** | Multiple specialized agents collaborate to accomplish the task. | Manager-led command hierarchies. The "microservicing" of AI. |

## 2026 Trend: Production-Ready Design

The field is shifting from experimental prompting toward structures robust enough for enterprise production use.

### 1. Structured State Management (State Machines)

Rather than relying on emergent behavior, graph structures and state transitions are explicitly defined. Inputs and outputs for each phase are fixed to ensure predictability (driven by the spread of LangGraph and related tools).

### 2. Observability

The agent's reasoning process, tool-call results, and token consumption are monitored and visualized in real time, making root-cause identification (debugging) easier on failure.

### 3. Guardrails and Governance

Automated security checks and compliance validation are inserted at each step of the workflow. The [Human-in-the-Loop](human-in-the-loop.md) pattern is built in for critical decisions.

## Common Mistakes AI Agents Make

1. **Infinite loops** — In Reflection, the same fix is repeated without improvement, wasting tokens.
2. **Poor tool selection** — When too many tools are available, an unnecessarily heavy tool is chosen, slowing execution.
3. **Rigid plans** — The agent clings to its initial plan and fails to flexibly course-correct in response to execution errors or changing conditions.

## References

- [Andrew Ng: What's next for AI agentic workflows?](https://www.deeplearning.ai/the-batch/issue-242/)
- Related: `ai/practice/ai-driven-development.md`, `ai/practice/human-in-the-loop.md`, `ai/platform/mcp-protocol.md`
- Related (deep dives on individual patterns): [Loop Engineering](loop-engineering.md) (loop design), [Tool Design (ACI)](agent-tool-design.md) (Tool Use), [Agent Evaluation](agent-evaluation.md) (quantifying Reflection), [Observability](agentic-observability.md) (infinite loops, observability), [Reliability & Guardrails](agent-reliability-guardrails.md)
