---
reviewed: 2026-06-23
tags: [ai-platform, practice, methodology]
---

# Agent Skills Authoring Best Practices

This article summarizes how to write `SKILL.md` and guidelines for effective skill design. For format spec, field definitions, and discovery tiers, see `ai/platform/agent-skills-spec.md`. This article focuses on **how to write a good skill** (authoring) and **notable major public skills** worth referencing.

Sources: Anthropic's official "Skill authoring best practices" documentation and the official repository `anthropics/skills`. Skills run on Claude.ai / Claude Code / Claude Agent SDK / Claude Developer Platform, and are adopted as an open standard by 26+ tools (Codex CLI, Gemini CLI, GitHub Copilot, Cursor, VS Code, etc.).

## Write with Progressive Disclosure in mind

Skills load in 3 stages. **Being conscious of the token budget at each stage** is the core of authoring.

1. **Metadata (~100 tokens, always resident)**: the `name` + `description` of every skill are always loaded at startup.
2. **Body (recommended under 5000 tokens)**: the `SKILL.md` body loads when a skill becomes active.
3. **Resources (loaded only on reference)**: `scripts/` / `references/` / `assets/` consume no context until read.

Placement guidelines:

- **Keep the `SKILL.md` body under 500 lines.** If it's likely to exceed this, split into separate files.
- **Keep reference files at most 1 level deep from `SKILL.md`.** Deeper nesting risks the agent judging based only on a `head -100` preview and getting incomplete information.
- **Add a table of contents to reference files over 100 lines.** This conveys the overall picture even from a partial read.
- Split files by domain (`references/finance.md`, `references/sales.md`, etc.). Don't force loading of irrelevant context.

## Writing `description` (the key to discovery — most important)

Agents select which skill to use from among 100+ skills based solely on the `description`. This is the most important field (max 1024 characters).

- **Include both "what it does" and "when to use it."** Include concrete trigger keywords.
- **Always write in third person.** Good: `Processes Excel files and generates reports.` / Avoid: `I can help you…` `You can use this to…`
- **Good example**: `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.`
- **Avoid**: vague descriptions like `Helps with documents` / `Processes data`.

## Naming conventions

- **Gerund form recommended**: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`. Noun phrases (`pdf-processing`) or verb forms (`process-pdfs`) are also acceptable.
- Avoid generic terms like `helper` / `utils` / `tools` / `documents` / `data`.
- Constraints: 1–64 characters, lowercase alphanumerics and hyphens only, must match the parent directory name, reserved words `anthropic` / `claude` are not allowed (see the spec article for details).

## Write concisely (context is a public good)

> "The context window is a public good."

The default assumption is **"Claude is already smart."** Only add information Claude doesn't already have. Question the token cost of every paragraph. Prefer the essential point (50 tokens) over a verbose explanation (150 tokens).

## Calibrate degrees of freedom (instructions vs. scripts)

Adjust the specificity of instructions to the fragility of the task. Guardrails for a narrow bridge, only rough direction for an open field.

| Freedom | Format | Suited for |
|---|---|---|
| High | Prose instructions | Multiple valid answers, context-dependent (e.g., code review) |
| Medium | Pseudocode / parameterized scripts | A recommended pattern exists |
| Low | Fixed script (no parameters) | Fragile, consistency matters (e.g., DB migration. "Run this script exactly. Do not modify it.") |

## Deciding whether to bundle scripts

Turn processes that need determinism and efficiency into code ("sorting via token generation is far more costly than running a sorting algorithm"). Utility scripts **improve reliability, save tokens, save time, and guarantee consistency**.

- **Make execution intent explicit**: distinguish `Run analyze_form.py` (execute) from `See analyze_form.py for the algorithm` (read).
- **"Fix, don't punt"**: handle errors explicitly.
- **No "voodoo constants"**: document the rationale behind magic numbers.

## Testing and iteration (evaluation-driven)

- **Build evaluations first (evaluation-driven development)**: run Claude without the skill to identify gaps → create 3+ test scenarios → measure a baseline → write minimal instructions → iterate. (The official documentation's eval JSON schema has `skills` / `query` / `files` / `expected_behavior` fields, but **there is no official runner**, so you must build your own.)
- **Test across all target models**: Haiku / Sonnet / Opus. A skill that works on Opus may need more detailed instructions on Haiku.
- **Claude A / Claude B loop**: have one Claude write the skill, have a fresh Claude use it, observe the gaps, and feed back.

## Anti-patterns (explicitly called out officially)

- Windows-style backslash paths (always use forward slashes; this works cross-platform).
- Offering too many choices ("pypdf or pdfplumber or PyMuPDF or…"). Present **one default plus an escape hatch**.
- Time-bound information ("before August 2025…"). Instead, use a collapsible "Old patterns" section.
- Inconsistent terminology (mixing endpoint / URL / route).
- Deep nesting, ambiguous file names (`doc2.md`).
- Assuming a package is already installed (list dependencies explicitly).
- Always write MCP tools with the fully qualified `ServerName:tool_name` form.

## Security

- **"Only install skills from trusted sources."** Audit code dependencies, bundled resources, and instructions that could direct Claude to untrusted external sources (a prompt-injection vector).
- `allowed-tools` (a space-separated list of tools allowed without confirmation) is **experimental**, with differing support across implementations. Do not treat it as a guaranteed boundary.
- Execution environment differences: claude.ai can install from npm / PyPI / GitHub, but the **Claude API has neither network access nor runtime package installation**.

## Notable public Skills: `anthropics/skills`

The official repository `github.com/anthropics/skills` (`./skills` / `./spec` / `./template`). Most are Apache-2.0; the four document skills (docx/pdf/pptx/xlsx) are source-available (a production reference implementation, not OSS). Disclaimed as "provided for demo and educational purposes."

Installation example in Claude Code:

```text
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

| Skill | Category | Purpose |
|---|---|---|
| `skill-creator` | Meta | Creating/improving/measuring skills. Runs evals, benchmarking with variance analysis, description optimization for trigger accuracy |
| `pdf` | Document | PDF text/table extraction, merge/split, rotation, watermarking, generation, form filling, encryption, image extraction, OCR |
| `docx` | Document | Creating/reading/editing Word `.docx` (TOC, headings, page numbers, letterhead, images, track changes, comments) |
| `pptx` | Document | Creating/extracting/editing/merging/splitting `.pptx`, templates, layouts, speaker notes |
| `xlsx` | Document | Reading/editing spreadsheets (`.xlsx/.xlsm/.csv/.tsv`), formulas, formatting, charts, cleanup |
| `mcp-builder` | Development | Guide for building high-quality MCP servers (Python FastMCP / Node TypeScript SDK) |
| `webapp-testing` | Development | Testing local web apps with Playwright (verification, debugging, screenshots, browser logs) |
| `web-artifacts-builder` | Development | Multi-component HTML artifacts on claude.ai (React / Tailwind / shadcn/ui) |
| `claude-api` | Development | Claude API / Anthropic SDK reference (model ids, pricing, streaming, tool use, caching, etc.) |
| `algorithmic-art` | Creative | Generative art with p5.js (seeded randomness, flow fields, particle systems) |
| `canvas-design` | Creative | Visual art as `.png` / `.pdf` (posters, designs) |
| `frontend-design` | Creative | Intentional, distinctive UI visual design |
| `theme-factory` | Creative | Artifact styling (10 presets or generated themes) |
| `slack-gif-creator` | Creative | Slack-optimized animated GIFs (with constraints + validation tools) |
| `brand-guidelines` | Enterprise | Applying Anthropic's official brand colors/typography to artifacts |
| `internal-comms` | Enterprise | Internal communication documents (status reports, leadership updates, FAQs, incident reports) |
| `doc-coauthoring` | Enterprise | Co-authoring workflow for documents/proposals/specs/decision documents |

Guidelines recommended by the `skill-creator` meta-skill: write descriptions "pushy" with explicit triggers; prefer imperative + *why* over rigid "ALWAYS"; bundle repeated helpers into `scripts/`; add a table of contents to references over 300 lines. The README also references **Notion Skills for Claude** as a partner skill.

## References

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Equipping agents for the real world with Agent Skills (engineering blog)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [anthropics/skills (official public skills repository)](https://github.com/anthropics/skills)
- [skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
- Related: `ai/platform/agent-skills-spec.md` (format spec), `ai/platform/agent-extensions.md` (per-CLI support status)
