---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# Observability for AI Agents

Making the **internal behavior of autonomously operating AI agents understandable, debuggable, and improvable from externally emitted signals (traces, metrics, logs)**. It extends conventional "LLM observability" (looking at the input/output of a single inference call) to the entire agent, including **loops, tool calls, subagents, and long-running execution**. It is the foundation for pinpointing production incidents, detecting cost runaways, and continuously improving quality.

An agent is not a single request/response pair — within one task it makes dozens of decisions, tool executions, and course corrections non-deterministically. Failures cannot be identified without visibility into "which step broke, and why," and **emergent failures** can occur where each individual step looks fine but the whole run goes off the rails. This is why observability is a mandatory design element, and it is also the foundation underpinning the verification/debugging aspects of [loop engineering](loop-engineering.md).

## What to observe

### The three signals (agent version)

| Signal | Content in an agent |
|---|---|
| **Trace (most important)** | The execution tree. Records each LLM call, tool call, retrieval, and subagent as a **nested span**, reconstructing causality |
| **Metrics** | Tokens / cost (USD) / latency / task success rate / tool error rate / iteration count |
| **Logs** | Structured events (prompts, API requests, tool results, errors). A simple implementation like Claude Code's progress log is one form of this |

### Typical span hierarchy

```text
session (entire user journey)
└─ trace (1 task = agent workflow)
   └─ interaction / invoke_agent (1 turn of the loop)
      ├─ llm_request (model call: model name, tokens, latency)
      ├─ execute_tool (tool call: input, output, success/failure, latency)
      └─ invoke_agent (subagent → nested in the same trace)
```

Nesting subagent spans (e.g., Claude Code's Task tool) under the parent span, so that the **entire delegation chain becomes a single trace**, is the key to multi-agent observability.

## OpenTelemetry GenAI semantic conventions

A vendor-neutral effort to standardize span attributes. It is becoming a de facto common language, but its **status is "Development" (experimental), not stable**. Attribute names change over short periods (e.g., migrating per-message events to aggregate attributes, splitting `invoke_agent` into CLIENT/INTERNAL), so re-check the latest spec before adopting it in production. The convention has been split into its own repository, [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai).

Main attributes and operation names:

- **Common**: `gen_ai.provider.name` (e.g., `anthropic` / `openai`), `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens` / `output_tokens`, `gen_ai.response.finish_reasons`
- **Agent**: `gen_ai.agent.id` / `gen_ai.agent.name` / `gen_ai.agent.description`
- **Tool**: `gen_ai.tool.name`, `gen_ai.tool.call.id`
- **`gen_ai.operation.name`**: `chat` / `embeddings` (client-side); `create_agent` / `invoke_agent` / `invoke_workflow` / `plan` (task decomposition) / `execute_tool` (agent-side)

> **Note**: Arize's **OpenInference** is a separate LLM span convention from the official OTel `gen_ai.*` conventions. The two are complementary/competing, so check which schema a tool uses when selecting one.

Content (prompt bodies, tool arguments) is **not recorded by default**. Recording is opt-in, chosen from three modes: "do not record / store in span attributes / external storage + reference."

## Agent-specific signals and alerts

- **Tool call success/failure and argument hallucination** — record every call with input/output/latency/status
- **Loop iteration count and termination reason** — detects wasted repetition (runaway loops); pairs with the stopping conditions in [loop engineering](loop-engineering.md)
- **Context window usage rate and overflow (context overflow)** — occurrence of compaction
- **Guardrail triggers / prompt injection** — screen input before it reaches a subagent ([prompt injection defenses](prompt-injection.md))
- **Number of human-in-the-loop interventions** — annotation of high-risk decisions ([HITL patterns](human-in-the-loop.md))

The top-priority alerts to set up are **"tool call loops" and "context overflow."** Both tend to become silent failures and are the costliest. Define an explicit **budget for step count, elapsed time, total tokens, and tool call count** for each agent, and alert on overruns.

## The closed loop between online monitoring and offline evaluation

The value of observability doesn't stop at monitoring. The essence is a **closed loop that feeds production traces back into improvement**:

```text
Production trace ─▶ annotate failure ─▶ build dataset ─▶ eval ─▶ improve prompt/tool ─▶ regression test
      ▲                                                                              │
      └──────────────────────────────────────────────────────────────────────────┘
```

- **LLM-as-judge** — score subjective criteria such as conciseness, faithfulness, and hallucination using another LLM. Supplement objective criteria with code-based eval
- **Distinguish single-turn / multi-turn** — for multi-turn, evaluate achievement of the user's goal and context retention
- Feed scores back onto the trace and use regression tests to prevent recurrence

## Claude Code's OpenTelemetry support

Claude Code / Agent SDK has built-in OTel support (off by default; enabled via `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus at least one exporter). Honeycomb, Datadog, Grafana, Langfuse, and self-hosted collectors are officially documented as export destinations.

| Signal | Environment variable | Content |
|---|---|---|
| Metrics | `OTEL_METRICS_EXPORTER` | `claude_code.token.usage` / `cost.usage` (input/output/cache tokens, USD, session, lines added/removed, edit accept/reject counts) |
| Logs | `OTEL_LOGS_EXPORTER` | Structured records for prompt / API request / API error / tool result |
| Traces (**beta**) | `OTEL_TRACES_EXPORTER` + `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` | Spans: `claude_code.interaction` → `llm_request` / `tool` (child spans include permission wait `blocked_on_user`, `execution`) / `hook` |

- **Trace context propagation**: the SDK automatically propagates W3C trace context (`TRACEPARENT` / `TRACESTATE`) to the CLI and Bash child processes, nesting `claude_code.interaction` under the application-side span
- **Subagents**: Task tool spans are nested under the parent `claude_code.tool`, so the entire delegation chain is a single trace
- **Audit and confidentiality**: by default only structure (duration, model name, tool name) is recorded. Content is opt-in (`OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_TOOL_DETAILS=1`, etc.). An end-user identifier can be injected as a resource attribute to forward a per-user audit trail to a SIEM

> Span names use Claude Code's own `claude_code.*` naming; compliance with the official OTel `gen_ai.*` conventions is not stated in the official documentation (traces are beta and attributes may change).

## Major tools/platforms

| Tool | OSS | OTel | Characteristics |
|---|---|---|---|
| **Langfuse** | OSS (self-hostable) | Native (receives OTLP) | Observability + evals + prompt mgmt + datasets |
| **Arize Phoenix** | OSS (no API key required) | OTel + OpenInference | Self-hosted tracing + `phoenix.evals` (faithfulness/hallucination/toxicity) |
| **OpenLLMetry** (Traceloop) | OSS (Apache 2.0) | Built on OTel | Non-invasive instrumentation; sends to any OTel backend |
| **LangSmith** | SaaS | Yes (neutral option) | Tightly coupled with LangChain/LangGraph. Eval and regression testing |
| **Datadog LLM Observability** | SaaS | Native `gen_ai.*` v1.37+ | Redaction/sampling/enrichment via Collector |
| **Helicone** / **W&B Weave** / **Braintrust** | Partly OSS/SaaS | Broadly supported | Gateway-style / ML integration / experiment-and-eval oriented |

For self-hosted OSS, **Langfuse / Phoenix / OpenLLMetry** are the starting point; to align with an existing APM, **Datadog / Grafana + OTel Collector** is the starting point.

## Best practices

- **Instrument everything before optimizing** — attach a trace ID across the entire session and roll up the whole flow into a single trace instead of individual calls
- **PII / sensitive information off by default + redaction at the Collector** — apply redaction/sampling/enrichment via OTel Collector processors before data leaves the network
- **Attach cost attribution per LLM call** — aggregate tokens by agent/model/route and alert on budget overruns
- **Do sampling at the Collector layer** — keeps costs down at high throughput

## Anti-patterns

- **Logging only the final output** — you can't tell which step broke, and you miss loop/tool failures
- **Not measuring tokens/cost** — you won't notice runaway billing from runaway loops or context overflow
- **Letting production traces end at monitoring** — quality doesn't improve unless they feed back into an eval dataset
- **Unconditionally recording full prompt text** — risks PII leakage and storage bloat; opt-in + redaction is a prerequisite

## References

- OpenTelemetry: [GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) / [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai)
- Claude Code Docs: [Observability with OpenTelemetry](https://code.claude.com/docs/en/agent-sdk/observability)
- Datadog: [Supporting the OTel GenAI semantic conventions](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)
- Langfuse: [OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry) / Arize: [Phoenix docs](https://arize.com/docs/phoenix) / Traceloop: [OpenLLMetry](https://www.traceloop.com/openllmetry)
- LangChain: [Agent Observability](https://www.langchain.com/resources/agent-observability)
- Related: [Loop Engineering](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [AI Context Management](ai-context-management.md), [Prompt Injection Defenses](prompt-injection.md)
