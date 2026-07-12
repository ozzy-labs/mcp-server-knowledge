---
reviewed: 2026-07-12
tags: [ai-workflow, spec, commercial, aws, ide]
stability: ga
---

# Kiro

An agentic AI IDE from AWS built on spec-driven development (SDD). It comes in three forms: the browser-based Kiro Web IDE, a desktop editor ([kiro.dev/downloads](https://kiro.dev/downloads/)), and the headless Kiro CLI (post-GA messaging as of 2025-11-17 centers on the Web IDE). Its pitch is "take projects from prototype to production, spec-driven," taking a different approach from the conversational coding style of Cursor / Claude Code.

Official: [kiro.dev](https://kiro.dev/) / Docs: [kiro.dev/docs](https://kiro.dev/docs/) / CLI Docs: [kiro.dev/docs/cli](https://kiro.dev/docs/cli/)

See `ai/practice/spec-driven-development.md` for the overall SDD concept. See `ai/platform/agent-extensions.md` for a cross-agent comparison.

## Installation

### Desktop IDE

Get the macOS / Linux / Windows binary from the official site [kiro.dev/downloads](https://kiro.dev/downloads/).

### CLI

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

CLI 2.0 (2026-04-13) added Windows 11 support and headless CI/CD execution (`KIRO_API_KEY` + `--no-interactive`). CLI 2.1 (2026-04-24) added shell output streaming, Tool Search, the Skills slash command, device flow auth, and RHEL support. CLI 2.2.0 (2026-04-27) added adaptive thinking and fixed subagent dispatch. CLI 2.3.0 (2026-05-12) added the `KIRO_HOME` env var, V2 TUI keybinding configuration, OAuth Client ID for MCP servers without DCR support, and the `$AGENT_DISPLAY_OUT` / `$AGENT_CONTEXT_OUT` agent output side channels. CLI 2.4.0 (2026-05-20) added conversation rewind, `/effort` (low–max reasoning effort), and a unified `/settings` menu. CLI 2.5.0 (2026-05-29) added thinking display, a subagent review loop, and `/settings display`. CLI 2.6.0 (2026-06-05) added transcript export (`/transcript save`), a terminal window title (`/title`), the `chat --effort` flag, and persistence of model/effort preferences. CLI 2.7.0–2.12.0 (2026-06 to 07) added `/goal` (2.7.0), **Kiro CLI v3 Early Access** (2.8.0, 2026-06-17 — opt in via `kiro-cli --v3`, non-destructive alongside the 2.x install; previews **terminal-based SDD**, a capability-based permissions model, a standalone hooks file format, and tag-based agent configuration), Entra ID session refresh (2.9.0), config hot-reload + resource inheritance (2.10.0), and MCP auth-management commands / OAuth extensions (2.11–2.12.0). The latest is **CLI 2.12.0** (2026-07-09). The IDE and CLI share the same spec files. See [kiro.dev/changelog/cli](https://kiro.dev/changelog/cli/) for the version history.

## Operating model

- **Models**: **`Auto`** (Kiro's model router across multiple frontier models) is the recommended default. The Free tier includes open-weight models + Claude Sonnet 4.5; paid tiers add **Claude Sonnet 5** (added 2026-07-01: 1M context, 1.3x credit), Sonnet 4.6, and Claude Opus 4.6 / 4.7 / 4.8 (4.8: 1M context, 128K max output, 2.2x credit). Open-weight models — Qwen3 Coder Next, DeepSeek 3.2, MiniMax M2.5 (M2.1), GLM-5 — are available even on the Free tier
- **MCP**: Native support. Docs / databases / APIs etc. can be connected via MCP servers (`ai/platform/mcp-protocol.md`)
- **Steering files**: Project-wide guidance files (an `AGENTS.md`-like concept; see `ai/platform/agents-md.md`)
- **Multimodal chat**: Accepts images / UI mockups as input
- **Agent hooks**: Automatically run commands in response to events such as file save or git commit

## SDD workflow (3 stages)

| Stage | Artifact | Content |
|---|---|---|
| 1. Requirements | `requirements.md` | Converts natural language into unambiguous acceptance criteria using **EARS notation** |
| 2. Design | `design.md` | Analyzes the codebase and proposes architecture, system design, and tech stack |
| 3. Implementation | `tasks.md` | Breaks work into discrete tasks ordered by dependency, which the agent then implements |

All three stages are committed to the repo as Markdown files, so a human or a different agent can later recover the context. Tasks are traceable back to the spec's acceptance criteria.

### What is EARS notation

**Easy Approach to Requirements Syntax.** Requirements are written using a structured template such as "When X, the system shall Y," eliminating ambiguous phrasing and preventing context drift with the LLM. Kiro's `requirements.md` defaults to EARS notation.

## Key features

| Feature | Description |
|---|---|
| **Spec view** | Edit the three spec files (requirements/design/tasks) in a dedicated UI |
| **Agent hooks** | Automatically run tests / lint on event triggers such as save or commit |
| **Smart context management** | Automatically compresses and curates the context window (`ai/practice/ai-context-management.md`) |
| **Native MCP** | Add MCP servers directly from Settings |
| **Multimodal chat** | Text + images + UI screenshots |
| **Intelligent error diagnostics** | Suggests a fix plan from runtime errors |
| **Generate Git commit messages** | Generates commit messages from a diff |

## CLI mode (Kiro CLI / CLI 2.0+)

Supports headless execution and CI/CD integration. It uses the same spec files as the IDE, letting CI drive spec → tasks → implement via the `kiro` command. Windows support started with CLI 2.0.

```bash
kiro --help
```

### Key headless flags

- `--no-interactive` — non-interactive mode
- `--trust-all-tools` — skip approval for all tools
- `--trust-tools=<categories>` — skip approval by category, e.g. `read` / `grep` / `write`
- `--require-mcp-startup` — exit immediately if MCP startup fails

**Note**: Headless API key authentication is **limited to Pro / Pro+ / Power subscribers** (not available on Free). See [kiro.dev/docs/cli/headless](https://kiro.dev/docs/cli/headless) for details.

See [kiro.dev/docs/cli](https://kiro.dev/docs/cli/) for more.

## Pricing

See [kiro.dev/pricing](https://kiro.dev/pricing/) for the latest plans. Even after GA ([2025-11-17 announcement](https://kiro.dev/blog/general-availability/)), a Free tier remains permanently available ($0/month, 50 credits/month, open-weight models [Qwen3 Coder Next / DeepSeek v3.2 / MiniMax 2.1] + Claude Sonnet 4.5). Paid plans: Pro at $20/month (1,000 credits, Auto / Claude Sonnet 5 / Opus 4.8, etc.), Pro+ at $40/month (2,000 credits), **Pro Max at $100/month (5,000 credits)**, Power at $200/month (10,000 credits). Overage is $0.04/credit; AWS GovCloud runs about 20% higher. New users get a **$20 signup credit** on their first paid upgrade via social login / Builder ID, and a Students tier is also available (started 2026-03-18). Per-prompt credit consumption is visible inside the IDE.

Authentication supports AWS Builder ID / IAM Identity Center / GitHub / Google accounts, plus Okta / Microsoft Entra ID as of CLI 1.25.1.

## How it differs from competitors

| | Kiro | Claude Code / Codex CLI | Cursor |
|---|---|---|---|
| Form | IDE + CLI | CLI (terminal-native) | IDE (VS Code fork) |
| SDD integration | core philosophy | bolted on (Skill / cc-sdd, etc.) | none (agent-only) |
| Spec files | `requirements.md` / `design.md` / `tasks.md` by default | project's discretion | project's discretion |
| Models | Auto (recommended) / Sonnet 5 / Opus 4.8, etc. | Anthropic / OpenAI / Google, various | various |
| Philosophy | "the spec is truth," traced top-down | "the code is truth," conversation-driven | same (with stronger autocomplete) |

Relationship between Kiro and cc-sdd: cc-sdd explicitly states it is Kiro-inspired and is compatible with Kiro's spec format (EARS + design + tasks). It's possible to write a spec in Kiro and hand it to Claude Code via cc-sdd.

## Common AI agent mistakes

1. **Filling `requirements.md` with plain bullet points** — Kiro assumes EARS notation when generating design / tasks. "List-style requirements" cause intent to drift at the design stage. Stick to the `When ... the system shall ...` structure
2. **Hand-writing `tasks.md` instead of going through Spec view** — this breaks the dependency analysis between tasks and prevents parallel execution. Generate it via Spec view's **Generate tasks**
3. **Overloading Agent hooks** — attaching a hook to every event leads to infinite loops or CI wait hell. Start minimal (e.g. save → format / commit → test)
4. **Enabling all MCP connectors in Settings at once** — the same problem as Claude Code Routines. Enable only the connectors needed per project (`ai/agents/claude-code-routines.md`)
5. **Not choosing a model and just relying on Auto mode** — Auto optimizes for speed and cost. For debugging / design review, explicitly specifying a strong model (e.g. Opus 4.8 / Sonnet 5) gives more stable quality
6. **Calling `kiro` from the CLI and having the session never close** — when calling from CI, always set an exit code and a timeout. Check the CLI 2.0 headless mode docs
7. **Forgetting that the CLI keeps evolving fast even post-GA** — the CLI hit 2.0 in 2026-04 and has kept adding features at a near-weekly pace up through 2.6.0 (2026-06). Pin the version if embedding it in production CI

## References

- [Kiro official site](https://kiro.dev/)
- [Docs](https://kiro.dev/docs/)
- [CLI Docs](https://kiro.dev/docs/cli/)
- [CLI Changelog](https://kiro.dev/changelog/cli/)
- [Specs guide](https://kiro.dev/docs/specs/)
- [Pricing](https://kiro.dev/pricing/)
- [Downloads](https://kiro.dev/downloads/)
- [GA announcement (2025-11-17)](https://kiro.dev/blog/general-availability/)
- Related: `ai/practice/spec-driven-development.md` / `ai/practice/ai-driven-development.md` / `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/agents/claude-code.md` / `ai/platform/mcp-protocol.md`
