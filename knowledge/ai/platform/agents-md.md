---
reviewed: 2026-06-07
tags: [ai-workflow, methodology, markdown]
---

# AGENTS.md

A common file format for writing project guidance for AI coding agents. A single `AGENTS.md` shares policy across more than 20 agents, including OpenAI Codex / Gemini CLI / Jules / GitHub Copilot Coding Agent / Cursor / Windsurf / Devin / JetBrains Junie / Aider / goose / opencode / Zed / Warp / VS Code / Amp / RooCode / Augment Code / Factory / Ona / Kilo Code / Phoenix / Semgrep / UiPath Autopilot & Coded Agents (as listed on the official site; adopted by 60k+ OSS projects as of 2026-06).

## Background

Previously, each agent required its own file name (`CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`, `.cursorrules`, etc.). `AGENTS.md` was proposed in August 2025 as an open common convention (the `openai/agents.md` repository was created on 2025-08-19), and major CLI/IDE agents adopted it in turn (adopted by 60k+ OSS projects as of 2026-06). The format is now stewarded by the Agentic AI Foundation, under the Linux Foundation.

## Placement and loading

- Placement: repository root
- Loading: automatic at startup. No explicit configuration needed
- Subdirectory `AGENTS.md`: usable in monorepos to give directory-specific instructions (agent-dependent)

## Recommended sections

Agents can interpret structure, so writing with natural headings works well. Representative sections:

| Section | Content |
|---|---|
| Project overview | What this repository builds |
| Tech Stack | Languages, runtime, package manager, key libraries |
| Key commands | `install`, `build`, `test`, `lint`, etc. |
| Verification (required) | Checks that must pass before reporting (e.g., `pnpm run build && pnpm run typecheck`) |
| Coding conventions | Indentation, line breaks, naming conventions |
| Prohibited actions | Direct push to `main`, staging `.env`, etc. |
| Links to conventions | References to external rules such as Conventional Commits / GitHub Flow |

## Per-agent adapters

`AGENTS.md` alone covers most agents, but agent-specific features (skills, subagents, custom commands, etc.) are supplemented with separate files.

| Agent | Additional file |
|---|---|
| Claude Code | `CLAUDE.md`, files under `.claude/` |
| Codex CLI | `AGENTS.md` + `.agents/skills/` |
| Gemini CLI | `AGENTS.md` + `GEMINI.md` / `CONTEXT.md` |
| GitHub Copilot CLI | `AGENTS.md` + `.agents/` |
| Cursor | `AGENTS.md` + `.cursor/rules/` (`AGENTS.md` is also officially supported) |

**Tip**: Writing "Common policy: see AGENTS.md" at the top of `CLAUDE.md`, and keeping only Claude-specific parts in `CLAUDE.md`, keeps things DRY.

## Writing principles

- **Short, imperative sentences**: write in the imperative ("do X", "don't do Y"). Avoid formal or verbose phrasing
- **State triggers explicitly**: write execution timing, such as "after changes" or "before creating a PR"
- **Give reasons for prohibitions**: e.g., "Don't `--force` push (for production safety)"
- **Make example commands concrete**: in an executable form, e.g. `pnpm run build`
- **Use relative links to external documents**: e.g. `.claude/rules/git-workflow.md`

## Anti-patterns

- Diving deep into tool-specific CLI flags (goes stale across agents)
- Duplicating the content of `README.md` or `CONTRIBUTING.md` → reference via a link instead
- Long, essay-like background explanations → keep only decisions and rules
- Vague instructions like "please understand X as an AI agent"
