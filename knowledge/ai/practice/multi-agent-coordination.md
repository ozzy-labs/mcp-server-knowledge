---
reviewed: 2026-06-07
tags: [ai-workflow, multi-agent, methodology]
---

# Multi-agent Coordination Patterns

A design pattern approach that solves complex problems by combining multiple specialized agents that interact with each other to achieve a goal, rather than relying on a single LLM model. Based on technical guidance published by Anthropic in April 2026, this is classified into the following 5 core architectures.

## 5 Core Architectures

### 1. Generator-Verifier

Combines an agent that performs "generation" with an agent that "verifies" its output against specific criteria.

- **Workflow**: If the verifier agent rejects the output, it is sent back to the generator agent along with feedback for correction.
- **Best for**: Code generation (writing + running tests), fact-checking, compliance verification.
- **Note**: If the verification criteria are ambiguous, there is a risk of falling into a "self-deception loop" between the agents.

### 2. Orchestrator-Subagent

A central "orchestrator" decomposes tasks and delegates them to short-lived subagents, then aggregates the results.

- **Workflow**: Subagents terminate after completing their task. This is the basic structure of **Claude Code**.
- **Best for**: Parallel tasks with few dependencies (e.g., codebase search while continuing the main work).

### 3. Agent Teams

Similar to the Orchestrator pattern, but subagents are given "persistence."

- **Workflow**: Each agent continues accumulating domain knowledge as a long-term "colleague."
- **Best for**: Ongoing projects that require maintaining context across modules, such as large-scale codebase migrations.

### 4. Message Bus

Agents coordinate with each other via a Publish/Subscribe-style event system.

- **Workflow**: New agents can be added without changing existing wiring. Agents act autonomously, triggered by "specific events."
- **Best for**: Pipelines where the type of alert and the response strategy change dynamically, such as security operations (SOC).

### 5. Shared State

No central coordinator; all agents read from and write to a common database or file system.

- **Workflow**: Agents use each other's discoveries in real time to advance exploration.
- **Best for**: Collaborative exploration where discoveries directly inform the next investigation, such as scientific research or investigating unknown bugs.

## Strategic Takeaways (Anthropic 2026)

- **Delegation Gap**: Developers use AI for 60% of their work, but fully delegate only 0-20% of it. These patterns are a structure for closing this gap.
- **Neuro-symbolic coordination**: In high-risk domains, it is recommended to place a rule-based "deterministic layer" before or in parallel with probabilistic AI patterns to enforce constraints.
- **Token efficiency**: Multi-agent setups consume 3-10x more tokens than a single agent. "Vibes-based multi-agentization" should be avoided; a single agent with appropriate tools should be preferred when sufficient.

## 2026 Implementation Trends

- **Maturation of Agent SDKs**:
  - **Claude Agent SDK** (formerly Claude Code SDK, renamed September 2025): Turns the general-purpose agent foundation that powers Claude Code into a library. Calls subagents as tools with isolated contexts, minimizing orchestration. In 2026, Dynamic Workflows (research preview) reached parallel execution of up to 1,000 subagents per run (up to 16 concurrent).
  - **OpenAI Agents SDK**: Standardizes handoff-based control transfer and persistent memory (a production-ready evolution replacing its experimental predecessor, Swarm).
- **Model Tiering**: Cost/speed optimization by using Haiku 4.5 for routing and Opus 4.8 (current flagship) for reasoning.
- **MCP 2.0**: A common language for agents to share tools and context across frameworks.

## References

- [Anthropic: Multi-agent coordination patterns: Five approaches and when to use them (2026)](https://claude.com/blog/multi-agent-coordination-patterns)
- [OpenAI: Agents SDK Documentation](https://developers.openai.com/api/docs/guides/agents)
- Related: [`ai/practice/agentic-workflow-patterns.md`](agentic-workflow-patterns.md), [`ai/practice/multi-agent-repo.md`](multi-agent-repo.md), [Loop Engineering](loop-engineering.md), [Observability](agentic-observability.md) (subagent tracing)
