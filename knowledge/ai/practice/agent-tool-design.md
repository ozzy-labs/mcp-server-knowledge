---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# Tool Design for AI Agents (Agent-Computer Interface / ACI)

Tools are what drive an agent's [loop](loop-engineering.md), and **tool quality directly determines agent success or failure**. Anthropic argues you should **invest as much effort in the agent-facing interface (ACI: Agent-Computer Interface) as you do in the human-facing UI (HCI)**. This article summarizes design principles for tools that agents can use effectively.

The key is: **do not simply wrap a human- or system-facing API as-is**. Unlike a traditional API (`getWeather("NYC")` always behaves the same way), an agent is a **non-deterministic caller** that can misuse a call or hallucinate arguments. Design tools with this assumption in mind.

## Basic principles of ACI

From Anthropic's "Building effective agents" (Appendix 2) / "Writing effective tools for AI agents":

- **Write from the model's perspective** — "Looking at the description and parameters, is usage self-evident, or does it require thought? If it requires thought, the model will get stuck too."
- **Like a docstring for a junior developer** — write parameter names and descriptions with the same care you'd put into a good docstring handed to a new team member
- **Poka-yoke design** — change arguments to make mistakes harder. Real example: on SWE-bench, a model kept getting relative paths wrong; switching to **mandatory absolute paths** made it work perfectly
- A good tool definition should include: **usage examples, edge cases, input format requirements, and clear boundaries with other tools**

## Tool consolidation

Rather than proliferating fine-grained tools, **consolidate so a single tool handles multiple operations internally**. Design at the same granularity a human would use to break down a task, so the agent can solve it the same way:

| ✗ Fine-grained sprawl | ✓ Consolidated, capable tool |
|---|---|
| `list_users` + `list_events` + `create_event` | `schedule_event` (find open slot + book) |
| Raw `read_logs` | `search_logs` with context |
| Stacking individual lookups | `get_customer_context` (bundles recent transactions + notes) |

## Schema and naming

- **Eliminate ambiguous naming** — `user_id` instead of `user`. `search_customer_orders` instead of `query_db_orders` / "Execute order query"
- **Namespacing** — make boundaries explicit with prefixes (`asana_projects_search` / `notification-send-user` vs `notification-send-channel`). Similarly named tools invite misselection
- **JSON Schema** — constrain input with `type` / `properties` / `required`, enums, and other constraints. [MCP](../platform/mcp-protocol.md) tools are defined with `name` / `description` / `inputSchema` / optional `outputSchema`
- Name and description are also **matched against by Tool Search**, so making them clear and descriptive improves discoverability

## How to return errors

Design error messages so the agent can **use them to recover**. Rather than opaque codes or stack traces, prompt-engineer the error response itself to be **specific and actionable**:

- Instead of throwing an exception and swallowing it, return a **structured, recoverable error**
- MCP distinguishes two categories: **Protocol Error** (JSON-RPC, e.g. unknown tool or invalid arguments) and **Tool Execution Error** (set `isError: true` on the result, with an explanation such as "API rate limit exceeded" in `content`)
- Steer errors toward token-efficient strategies (e.g. nudge the agent to use a filter instead of a broad search)

## Tool count and dynamic loadouts

**"More tools is not necessarily better."** An agent's context is finite; more tools means worse selection accuracy, and definitions consume tokens:

- **Misselection and wrong parameters** among similarly named tools are the most common failure
- Tool definitions alone can reach tens of thousands of tokens (examples of tens of thousands of tokens across multiple MCP server configurations)
- Countermeasures via dynamic loadouts:
  - **Tool Search Tool / `defer_loading`** — load only critical tools initially, and search and expand definitions only when needed (reported to reduce tokens and improve selection accuracy)
  - **Code execution with MCP** — instead of reading all definitions up front, expose the MCP server as a code API so the agent reads only the tools it needs

## Token efficiency and response design

- **Return only high-signal information** — only what's contextually relevant. Let a verbosity enum parameter (e.g. `concise` / `detailed`) toggle this
- Implement **pagination, filtering, and truncation** with sensible defaults. Set a default cap on tool responses (Anthropic's implementation example uses 25,000 tokens)
- **Return identifiers just-in-time** — instead of embedding full details every time, return identifiers ([MCP](../platform/mcp-protocol.md)'s `resource_link`, etc.) and let the agent fetch details when needed
- The optimal response structure (XML / JSON / Markdown) varies by task and agent, so choose empirically through evaluation

## Eval-driven tool refinement

Small improvements to tool descriptions can have dramatic effects (Anthropic reports that Claude Sonnet achieved SOTA on SWE-bench Verified after refining descriptions).

- Build [evals](agent-evaluation.md) around **realistic, multi-step tasks based on real workflows**, run them programmatically through the agentic loop, and iterate
- You can also hand Claude the eval transcripts and have it **analyze and refactor the tool definitions itself**

## Security (when exposing MCP)

- **Insert HITL** — the MCP spec states there should "always be a human in the loop who can deny tool invocations" ([Human-in-the-Loop](human-in-the-loop.md))
- **Tool Poisoning** — an indirect [prompt injection](prompt-injection.md) that embeds malicious instructions in metadata not readily visible to users, such as a tool's description, parameter descriptions, or `inputSchema`. Because LLMs treat this metadata as ground truth, it's dangerous. Treat annotations from untrusted servers as untrusted

## Anti-patterns

- **Turning a human-facing API into a tool as-is** — doesn't account for a non-deterministic caller and invites misuse
- **Lining up a large number of fine-grained tools** — hurts selection accuracy and consumes context. Use consolidation and dynamic loadouts
- **Returning raw stack traces** — the agent can't recover. Use actionable, structured errors instead
- **Returning entire tool output wholesale** — wastes tokens. Use high-signal responses + pagination + identifier returns
- **Writing tool descriptions carelessly** — underinvesting in ACI. Refine through evals

## References

- Anthropic: [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) / [Building effective agents (Appendix 2: ACI)](https://www.anthropic.com/research/building-effective-agents)
- Anthropic: [Advanced tool use (Tool Search / Programmatic Tool Calling)](https://www.anthropic.com/engineering/advanced-tool-use) / [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP tool specification (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) / [OWASP: Tool Poisoning (MCP03:2025)](https://owasp.org/www-project-mcp-top-10/2025/MCP03-2025%E2%80%93Tool-Poisoning)
- Related: [Loop Engineering](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [Agent Evaluation](agent-evaluation.md), [Prompt Injection Defenses](prompt-injection.md), [MCP Protocol](../platform/mcp-protocol.md)
