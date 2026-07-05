---
reviewed: 2026-06-07
tags: [ai-driven-development, methodology, ai-workflow]
---

# AI-Driven Development (AIDD)

An umbrella term for development methodologies that place LLMs at the core of the software development process. It spans everything from code completion to fully autonomous agents completing tasks end to end, shifting the developer's role from "writing code" to "**communicating intent and constraints to the agent and verifying the result**."

This is a separate axis from Spec-Driven Development (SDD), and the two are compatible. See `ai/practice/spec-driven-development.md` for SDD.

## Definition

There is no single official definition of "AI-Driven Development," but in practice the term usually refers to a development style satisfying the following three elements:

1. **LLM as primary owner of code generation/editing**: humans focus on review, acceptance, and course correction
2. **Interactive, iterative development loop**: not completed in a single prompt, but refined through repeated feedback
3. **Agent actively operates the development environment**: autonomously edits files, runs tests, creates PRs, etc.

This is sometimes distinguished from "AI-Assisted Development." The former has AI in the lead role, the latter has humans in the lead role with AI assisting — a difference in degree.

## Historical Background

| Year | Milestone | Form |
|---|---|---|
| 2021 | GitHub Copilot general availability | autocomplete |
| 2022-11 | ChatGPT released | chat |
| 2023 | Cursor / Continue / Aider | chat-in-IDE / CLI |
| 2024 | Claude / GPT-4-based coding agents (Devin, SWE-agent, etc.) | semi-autonomous agent |
| 2024-2025 | Claude Code, Codex CLI, Gemini CLI, Copilot CLI reach GA | terminal-native agent |
| 2025-2026 | Orchestrators such as Routines / Codex cloud / Spec Kit / Kiro emerge | autonomous workflow |

Direction of evolution: **"humans receive completions" → "humans and LLMs converse" → "LLMs act on humans' behalf" → "LLMs operate continuously."**

## Key Patterns

### 1. Autocomplete

Suggests the next token, line, or function in the editor. GitHub Copilot, Tabnine, Cursor Tab, etc. Because **a human is always in the judgment loop**, the risk of errors slipping in is low, but productivity gains are limited to the short term.

### 2. Chat

Generates/modifies code through conversation with an LLM inside an IDE or browser. ChatGPT, Cursor Chat, Continue, etc. Since the human controls the amount of context, **intent is easier to make explicit**, but manually applying the generated output to files remains a chore.

### 3. Agent

The LLM enters a loop where it autonomously **edits files, runs commands, and runs tests**. Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI, etc. A permission model lets humans approve only the critical points. Understanding context windows, token consumption, and loop control is essential (see `ai/practice/ai-context-management.md`).

### 4. Autonomous Workflow

A form where agents are triggered by **schedules / events / API triggers** and create PRs without human involvement. Claude Code Routines, Codex cloud (the `@codex` GitHub bot / cloud-delegated tasks), GitHub Copilot Coding Agent, etc. See `ai/practice/scheduled-tasks.md` for details.

## Relationship to Spec-Driven Development

AIDD is about "**who** primarily writes the code," while SDD is about "**what** gets written first" — different axes. There are 4 possible combinations:

| | With SDD | Without SDD |
|---|---|---|
| **With AIDD** | Agent reads the spec and implements it (e.g., cc-sdd, GitHub Spec Kit) | Human conveys intent through prompts and dialogue |
| **Without AIDD** | Human writes spec → human implements (traditional) | Human writes code directly |

Combining SDD and AIDD works well because it suppresses "ambiguity of intent," and tools from 2025 onward (Kiro, GitHub Spec Kit, cc-sdd) are designed around this combination by default. See `ai/practice/spec-driven-development.md` for details.

## Benefits

- **Productivity**: boilerplate, routine code, and tests are produced faster than by humans
- **Always-on operation**: automates review, dependency updates, and small fixes via schedule/event triggers (see `ai/practice/scheduled-tasks.md`)
- **Distributed learning cost**: agents can produce a first draft even in unfamiliar languages/libraries
- **Documentation currency**: referencing official docs each time avoids staleness in training data

## Pitfalls

### 1. Confidently lying

LLMs fabricate API names, flags, and URLs. A mechanism that **forces reference to a verified knowledge base / context7 / official docs** is essential. This repository's knowledge MCP exists for exactly this purpose.

### 2. Consistency breaks down on large-scale changes

Refactors spanning 10+ files tend to partially succeed and partially fail. Mitigate by scoping tasks to **1 PR = 1 topic**, having the agent run its own tests, and making CI gates mandatory.

### 3. Forgetting about prompt injection

Agents may follow instructions embedded in external data (web pages, files, MCP tool results). **Trust-boundary design** is required (see `ai/practice/prompt-injection.md`).

### 4. Neglecting context window design

Long sessions forget earlier decisions. Combine compaction, subagents, and progressive disclosure via skills (see `ai/practice/ai-context-management.md`).

### 5. Collapse of review culture

Skipping human review because "it works" erodes consistency in design, naming, and architecture. The practical solution is that **a human always reads even auto-generated PRs before squash-merging**.

### 6. Licensing / copyright

Code derived from training data may be output verbatim. Mitigations include enabling Copilot's **filter for matching public code** for commercial code.

### 7. Vendor lock-in

Accumulating skills/scripts that assume a specific CLI/model raises migration costs. Route through agent-agnostic common specs such as `AGENTS.md` / agent-extensions (see `ai/platform/agents-md.md`, `ai/platform/agent-extensions.md`, `ai/practice/multi-agent-repo.md`).

## Common Mistakes AI Agents Make

1. **Starting from training data** — CLIs/APIs/SDKs in particular go stale on a roughly six-month cycle. **Always check** `knowledge` MCP / context7 / official docs **first**
2. **Making sweeping changes in one big PR** — a PR with 100+ lines across 10+ files is unreviewable. Design around 1 task = 1 PR, assuming squash merge
3. **Not writing tests, or writing only tests while the implementation is a sham** — having the implementation and tests written together, TDD-style starting from a failing test, is more stable
4. **Reporting "done" without verification** — do not consider a task complete until you've **actually run and inspected the results of** `pnpm run test` / `npm run build` / lint
5. **Treating conversation history as the sole source of truth** — information that vanishes when the session ends leaves no record. Write decisions down in `CLAUDE.md` / `AGENTS.md` / commit messages / PR descriptions
6. **Overusing AskUserQuestion** — in autonomous mode, answers can't be returned. The scope of "what may proceed autonomously" needs to be made explicit at prompt time

## References

- Related: `ai/practice/spec-driven-development.md` / `ai/practice/ai-context-management.md` / `ai/practice/prompt-injection.md` / `ai/practice/multi-agent-repo.md` / `ai/practice/scheduled-tasks.md` / `standards/test-driven-development.md`
- Agent CLIs: `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
- Extension mechanism: `ai/platform/agent-extensions.md`
- AGENTS.md: `ai/platform/agents-md.md`
