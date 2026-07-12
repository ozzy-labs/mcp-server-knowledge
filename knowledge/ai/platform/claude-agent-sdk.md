---
reviewed: 2026-07-12
tags: [library, ai-workflow, commercial, typescript, python]
aliases: [claude-agent-sdk, claude-code-sdk, agent-sdk]
---

# Claude Agent SDK

Anthropic's official library for building production AI agents in **Python and TypeScript**. It exposes the same agent loop, tools, and context management that power Claude Code — "Claude Code as a library." Use the CLI ([`../agents/claude-code.md`](../agents/claude-code.md)) for interactive work, and this SDK for CI/CD, custom applications, and production automation. It was **renamed from the "Claude Code SDK"** (package / type names changed — see below), so training-data imports are usually stale.

Official: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)

## Positioning (SDK vs CLI vs Client SDK vs Managed Agents)

| | Claude Agent SDK | Claude Code CLI | Anthropic **Client** SDK (`anthropic` / `@anthropic-ai/sdk`) | Managed Agents |
|---|---|---|---|---|
| Form | Python / TS library | Terminal app | Python / TS library | Hosted REST API |
| Agent loop | Built-in | Built-in | **You implement it** | Built-in (managed) |
| Tool execution | Built-in + custom tools | Built-in | You execute everything | Managed sandbox |
| Runs in | Your process / infra | Your terminal | Your process | Anthropic-managed infra |
| Best for | CI/CD, apps, automation | Interactive dev | Fine-grained custom loops | Long-running / async |

The key distinction from the **Client SDK** (Messages API): with `anthropic` you write the tool-execution loop yourself (`while stop_reason == "tool_use": ...`); the Agent SDK runs that loop for you and adds tools, MCP, subagents, permissions, hooks, sessions, and context management.

## Packages and versions

The TypeScript and Python packages version **independently** and are both pre-1.0 with near-daily releases — do not assume matching version numbers.

| Language | Package | Latest (2026-07) | Runtime |
|---|---|---|---|
| TypeScript | `@anthropic-ai/claude-agent-sdk` | 0.3.207 (2026-07-11) | Node.js >= 18 |
| Python | `claude-agent-sdk` | 0.2.116 (2026-07-11) | Python >= 3.10 |

The TS package bundles a native Claude Code binary as an optional dependency, so you do not install Claude Code separately. Python depends on `mcp>=1.23.0` and `anyio`.

### Renamed from the Claude Code SDK

| Old | New |
|---|---|
| `@anthropic-ai/claude-code` (SDK) | `@anthropic-ai/claude-agent-sdk` |
| `claude-code-sdk` (PyPI) | `claude-agent-sdk` |
| `ClaudeCodeOptions` | `ClaudeAgentOptions` |

The **default system prompt is now minimal** (not the Claude Code prompt). To restore Claude Code behavior, pass `system_prompt={"type": "preset", "preset": "claude_code"}` explicitly.

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk    # TypeScript (Node >= 18)
pip install claude-agent-sdk                  # Python (>= 3.10)
```

Set `ANTHROPIC_API_KEY` for auth. Amazon Bedrock / Claude Platform on AWS / Google Vertex / Microsoft Foundry are supported via `CLAUDE_CODE_USE_*` env vars. **claude.ai subscription login is not permitted for third-party products** built on the SDK — API-key auth only.

## Minimal agent

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "What files are in this directory?",
  options: { allowedTools: ["Bash", "Glob"] },
})) {
  if ("result" in message) console.log(message.result);
}
```

```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="What files are in this directory?",
        options=ClaudeAgentOptions(allowed_tools=["Bash", "Glob"]),
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

## Core API and concepts

| Concept | Detail |
|---|---|
| `query()` | One-shot; a fresh session per call, returns an async iterator of messages |
| `ClaudeSDKClient` (Python) | Streaming / multi-turn with explicit `connect()` / `receive_response()` / `interrupt()` / `set_model()` / `disconnect()` |
| Custom tools | `@tool(...)` + `create_sdk_mcp_server(...)` register in-process MCP tools, referenced as `mcp__<server>__<tool>` |
| MCP servers | `mcpServers` / `mcp_servers` accept external and in-process servers |
| Subagents | `agents` maps names to `AgentDefinition`; invoked via the built-in **`Agent`** tool (include `"Agent"` in `allowedTools`) |
| Permission modes | `default` / `acceptEdits` / `plan` / `dontAsk` / `bypassPermissions` / `auto`; plus `can_use_tool` callback |
| Hooks | Callbacks at `PreToolUse` / `PostToolUse` / `Stop` / `SessionStart` / `SessionEnd` / `UserPromptSubmit`, etc. |
| Sessions | Capture `session_id`, then `resume` / `continue_conversation` / `fork_session`; state is JSONL on your filesystem |
| Model | `model` + `fallback_model`, plus `effort` (`low`–`max`) and `thinking` |

`setting_sources` (`["user","project","local"]`) controls whether Claude Code filesystem config is read (Skills, `CLAUDE.md`, commands, plugins). TypeScript mirrors these options in camelCase (`allowedTools`, `permissionMode`, `settingSources`).

## Managed Agents (server-hosted, beta)

A separate API-side product where **Anthropic runs both the agent loop and the sandbox**; your app streams events and results over SSE. Concepts: Agent (model + prompt + tools + MCP + skills), Environment (managed or self-hosted sandbox), Session (persistent filesystem + history), Events. Supports mid-run steering and scheduled (cron) deployments. Requires the `managed-agents-2026-04-01` beta header (set automatically). Best when you want long-running / async agents without operating your own sandbox — a common path is to prototype locally with the Agent SDK, then move to Managed Agents for production.

## Common AI Agent Mistakes

1. **Stale package / import names** — `@anthropic-ai/claude-code`, `claude_code_sdk`, `ClaudeCodeOptions` are all renamed. Use `@anthropic-ai/claude-agent-sdk` / `claude_agent_sdk` / `ClaudeAgentOptions`.
2. **Expecting the Claude Code system prompt by default** — it is minimal now; pass the `claude_code` preset to restore it.
3. **Confusing it with the Client SDK** — writing a manual `while stop_reason == "tool_use"` loop when the Agent SDK already runs the loop (or reaching for the Agent SDK when raw Messages API control is all you need).
4. **Forgetting `"Agent"` in `allowedTools`** — subagents are invoked via the `Agent` tool, so omitting it blocks auto-approval.
5. **Assuming subscription login works** — third-party products must use API-key auth, not claude.ai login.
6. **Assuming TS and Python share versions** — they don't (TS 0.3.x, Python 0.2.x), and both are pre-1.0 with frequent churn; pin versions.

## Related

- [`../agents/claude-code.md`](../agents/claude-code.md) — the CLI built on the same engine
- [`anthropic-api.md`](anthropic-api.md) — the Client SDK / Messages API (implement your own loop)
- [`mcp-typescript-sdk.md`](mcp-typescript-sdk.md) — MCP SDK used for custom tools / servers
- [`../practice/scheduled-tasks.md`](../practice/scheduled-tasks.md) — billing note: SDK / `claude -p` usage draws from a separate credit pool

## References

- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Migration guide (Code SDK → Agent SDK)](https://code.claude.com/docs/en/agent-sdk/migration-guide)
- [TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript) / [Python reference](https://code.claude.com/docs/en/agent-sdk/python)
- [Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)
- [npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) / [PyPI](https://pypi.org/project/claude-agent-sdk/)
