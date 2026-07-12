---
reviewed: 2026-07-12
tags: [methodology, ai-workflow, spec]
---

# Spec-Driven Development (SDD)

A workflow in which **intent (spec) and plan are written down as documents before implementation**, and code is generated/verified starting from those documents. AI agents handle structured specs more reliably than ambiguous natural language, so this approach spread rapidly from 2025 onward in combination with AI-driven development.

For its relationship to AI-driven development, see `ai/practice/ai-driven-development.md`. Individual tool articles live under `ai/workflow/`.

## Definition

The basic flow has three stages:

1. **Spec**: Describe "what to build" in natural language (requirements, acceptance criteria, non-functional requirements)
2. **Plan**: Break down "how to build it" technically (architecture, file split, task list)
3. **Implement**: Implement each task in the plan and verify against the spec's acceptance criteria

The difference from traditional agile development is that each stage remains as a **version-controlled artifact**. An agent can pick up each task in the plan in order and execute it autonomously.

## Historical background

| Era | Form | Character |
|---|---|---|
| 1970s-80s | formal specification (Z, VDM, B-method) | Mathematical rigor, heavy in practice |
| 1990s | UML / use case | Documentation-centric, diverges from code |
| 2000s | TDD (Test-Driven Development) | Spec expressed as tests |
| 2010s | BDD (Cucumber, etc.) | Spec written in natural language (for humans) |
| 2024-2025 | AI-era SDD (GitHub Spec Kit, Kiro, cc-sdd) | Spec written as a structured prompt for agents |

The idea of "writing a spec" itself is old, but the AI era's distinguishing feature is that **the spec written directly drives implementation work**. Because agents read the spec and carry it through to implementation, the spec never becomes a dead document.

## Advantages specific to AI-era SDD

1. **Absorbs ambiguity of intent**: An agent works more reliably against "satisfy this acceptance criterion" than against "build something nice"
2. **Task parallelization**: If plan tasks are independent, multiple agents can execute them in parallel
3. **Regression prevention**: Because the spec doubles as acceptance criteria, re-reading the spec during later changes reveals what broke
4. **Onboarding**: A human/agent joining later can regain context by reading the spec
5. **Clarified code-review criteria**: An operational rule such as "reject anything not written in the spec" becomes viable

## Major workflow tools

Representative SDD orchestrators as of 2026:

| Tool | Provider | Characteristics | Details |
|---|---|---|---|
| **GitHub Spec Kit** | GitHub | Agent-agnostic (34 agents in the integrations reference; README still says "30+"), installed via `uv tool install specify-cli`; persona **Bundles** provision PM/dev/security-researcher sets | `ai/workflow/github-spec-kit.md` |
| **Kiro** | AWS | Dedicated IDE + CLI, Spec view, agent hooks; **Auto mode** is the recommended starting point (Sonnet 5 added 2026-07, Opus 4.8 available) | `ai/workflow/kiro.md` |
| **cc-sdd** | OSS (gotalab) | npm package, installs Kiro-compatible specs into 8 agents (Claude Code / Codex / Cursor / Copilot / Windsurf / OpenCode / Gemini / Antigravity) | `ai/workflow/cc-sdd.md` |

Two other OSS orchestrators have grown large enough to note (both ~50-60k GitHub stars as of 2026-07): **OpenSpec** (Fission-AI) is repo-native and needs no API key or MCP, tracking scoped **deltas** against a source-of-truth spec (propose → apply → archive) — a direct answer to the tool-format lock-in pitfall below; **BMAD-METHOD** orchestrates a virtual agile team (analyst / PM / architect / SM / dev / QA) across a plan-then-build two-phase flow, sitting at the SDD ⇄ AIDD boundary.

Each tool differs in "where to place the spec," "how finely to slice the plan," and "which agent to hand it to." A practical selection criterion is **which CLI/IDE you already use**.

## Relationship between SDD and AIDD

| | With AIDD | Without AIDD |
|---|---|---|
| **With SDD** | Have an agent read the spec and implement it (cc-sdd, Spec Kit, Kiro) | Human writes spec → human implements (traditional V-model) |
| **Without SDD** | Have an agent implement directly via conversational prompts (Cursor / Claude Code alone) | Write code directly |

The combination of AI-driven development + SDD is the mainstream hypothesis as of 2026, and all three workflow tools listed above are designed on the premise of this combination.

## Pitfalls

### 1. Over-documenting the spec

Aiming to "describe every feature in a perfect spec" makes the time spent writing exceed implementation time and stops paying off. Start from a **minimally viable spec** (just acceptance criteria and a plan outline) and supplement as needed.

### 2. Divergence between spec and implementation

A case where the spec was written but is not being followed. Without also setting up a mechanism to **turn the spec's acceptance criteria into tests run in CI**, it quickly goes stale.

### 3. Wrong plan granularity

If plan tasks are as coarse as "implement login feature," the agent will guess and make sweeping changes. If too fine-grained, orchestration overhead balloons. Empirically, **granularity of 1 task = 1 PR that can be squash-merged** is the most manageable.

### 4. Confusing spec with a decision log

A spec describes "what to build"; a decision log describes "why it was decided that way." Mixing the two bloats the spec until it stops being read. Keep decision rationale in a separate file (ADR, `decisions/`, etc.).

### 5. Lock-in to tool-specific spec formats

A spec written in Kiro-specific notation, cc-sdd-specific notation, or Spec Kit templates is hard to port to other tools. Writing in **Markdown + light structuring** withstands tool switches.

### 6. The reviewer disappears

Mechanically merging because "it matches the spec" removes the human who reviews the validity of the spec itself. A practical solution is to **split spec PRs and implementation PRs for two-stage review**.

## Mistakes AI agents commonly make

1. **Jumping straight into implementation without writing a spec** — Told "just write it," agents skip the spec and start implementing. The prompt needs to explicitly say "first create spec.md"
2. **Trying to consume all plan tasks in a single session** — The context window runs out. A separate session/PR per task is more stable
3. **Changing the implementation without updating the spec** — Leads to a state where "the implementation is truth, the spec is stale." Establish a rule that **an implementation-change PR must include the corresponding spec fix**
4. **Reporting "done" without checking the spec's acceptance criteria** — Design it so the agent **turns each spec item into a checklist and runs through it itself**, rather than just running `pnpm run test`
5. **Writing a new spec without reading existing ones** — Leads to duplicate/contradictory specs existing in parallel. Grep existing specs before creating a new one
6. **Cramming the spec into a single Markdown file** — One file per feature, or splitting into a `specs/<feature>.md` directory, is easier to reference later

## References

- Related: `ai/practice/ai-driven-development.md` / `ai/practice/ai-context-management.md` / `ai/practice/multi-agent-repo.md`
- Workflow tools: `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md`
- Agent CLIs: `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
