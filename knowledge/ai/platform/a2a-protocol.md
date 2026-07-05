---
reviewed: 2026-06-29
tags: [ai-platform, spec, multi-agent]
aliases: [A2A, Agent2Agent, Agent2Agent Protocol]
stability: ga
---

# A2A (Agent2Agent) Protocol

An open standard that lets autonomous AI agents built with different vendors and frameworks discover each other, delegate tasks, and exchange data securely. Google published it in 2025-04, donated it to the Linux Foundation on 2025-06-23, and it is now stewarded under neutral, long-term governance as the **Agent2Agent (A2A) Project** (Apache-2.0).

- Official site: <https://a2a-protocol.org>
- Spec repository: `a2aproject/A2A` (formerly `google/A2A`)
- Latest spec: **v1.0.1 (2026-05-28)**. The first stable major, **v1.0.0, shipped 2026-03-12** (introduced several breaking changes).

## Relationship to MCP

**Complements, not competes with**, [[mcp-protocol]]. They operate at different layers.

| | Scope | Role |
|---|---|---|
| **MCP** | Agent ↔ tools / resources | An agent **uses** capabilities (DBs, APIs, functions) |
| **A2A** | Agent ↔ agent | Agents **collaborate** with each other on tasks |

Official framing: "An agentic application uses A2A to communicate with other agents, while each agent internally uses MCP to operate its own tools/resources."

## Core concepts

| Concept | Definition |
|---|---|
| **Agent Card** | JSON metadata published by an A2A Server. Describes identity, capabilities, skills, endpoints, and auth requirements. Can be JWS-signed so clients can verify authenticity before trusting it |
| **A2A Server / Client** | The Server publishes the Agent Card and service endpoints; the Client discovers the card and invokes methods |
| **Message** | One turn between the client and the remote agent. Includes `messageId` / `role` (user / agent) / `parts` / `contextId` / `taskId`, etc. |
| **Part** | The smallest content unit within a Message / Artifact. `text` / `data` (structured JSON) / `url` (file reference) / binary, etc. |
| **Artifact** | A deliverable an agent produces as a task result (document, image, structured data). Composed of multiple Parts |
| **AgentSkill** | An individual capability advertised in the Agent Card. `id` / `name` / `description` / `tags` / `examples` / per-skill input/output modes |

### Agent Card discovery

Published at a well-known URI (RFC 8615):

```text
https://{agent-server-domain}/.well-known/agent-card.json
```

### Task lifecycle (v1.0 enum)

- `TASK_STATE_SUBMITTED` (submitted, queued)
- `TASK_STATE_WORKING` (in progress)
- `TASK_STATE_INPUT_REQUIRED` (paused, awaiting input)
- `TASK_STATE_AUTH_REQUIRED` (paused, awaiting auth)
- Terminal: `TASK_STATE_COMPLETED` / `TASK_STATE_FAILED` / `TASK_STATE_CANCELED` / `TASK_STATE_REJECTED`

## Transports and methods

Has **three functionally equivalent bindings** over a canonical data model:

1. **JSON-RPC 2.0** over HTTP(S)
2. **gRPC** (Protocol Buffers)
3. **HTTP+JSON / REST**

Streaming uses **SSE (Server-Sent Events)**; for disconnections and long-running tasks, **webhook-based push notifications** are used.

Key operations (11 in v1.0; JSON-RPC binding method names in parentheses):

- Send Message (`message/send`) — returns a Task or Message
- Send Streaming Message (`message/stream`) — real-time updates over SSE
- Get Task (`tasks/get`) / List Tasks (with filtering + pagination) / Cancel Task (`tasks/cancel`)
- Subscribe to Task (re-subscribe to streaming updates for an existing task)
- Push Notification Config Create / Get / List / Delete
- Get Extended Agent Card (authenticated metadata)

## Authentication

Declared via `securitySchemes` / `security` in the Agent Card. Clients must authenticate using one of the published `securitySchemes`. Supported schemes: API Key / HTTP Auth (Basic, Bearer) / OAuth 2.0 / OpenID Connect / Mutual TLS. Credentials are sent via binding-specific mechanisms (HTTP headers, gRPC metadata, etc.).

## Agent Card example

Python SDK form (v1.0 replaces the single `url` with a `supported_interfaces` array):

```python
public_agent_card = AgentCard(
    name='Hello World Agent',
    description='Just a hello world agent',
    version='0.0.1',
    default_input_modes=['text/plain'],
    default_output_modes=['text/plain'],
    capabilities=AgentCapabilities(streaming=True, extended_agent_card=True),
    supported_interfaces=[
        AgentInterface(protocol_binding='JSONRPC', url='http://127.0.0.1:9999')
    ],
    skills=[
        AgentSkill(
            id='echo_bot',
            name='Echo Bot',
            description='Acknowledges the request and responds with "Hello World".',
            tags=['a2a', 'echo-example'],
            examples=['hi', 'how are you'],
        )
    ],
)
```

> Note: JSON wire-representation field casing (camelCase in JSON vs. snake_case in proto) differs by binding. For exact JSON samples, refer directly to v1.0 spec §8.5 / `spec/a2a.proto`.

## Adoption (as of 2026-04, per Linux Foundation)

- Backed by **150+ organizations** (up from 50+ at the 2025-04 launch); core repository has 22,000+ stars
- Production SDKs in 5 languages: Python / JavaScript / Java / Go / .NET
- GA cloud integrations: Microsoft (Azure AI Foundry, Copilot Studio) / AWS (Bedrock AgentCore Runtime) / Google Cloud
- Key supporters: AWS / Cisco / Google / IBM / Microsoft / Salesforce / SAP / ServiceNow
- Related: **AP2 (Agent Payments Protocol)** — a complementary protocol for agent-driven payments

## References

- Official spec: <https://a2a-protocol.org/latest/specification/>
- A2A vs. MCP comparison: <https://a2a-protocol.org/latest/topics/a2a-and-mcp/>
- Spec repository (Apache-2.0): <https://github.com/a2aproject/A2A>
- Linux Foundation project launch: <https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents>
