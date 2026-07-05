---
reviewed: 2026-06-23
tags: [ai-platform, cli, practice]
---

# Agent Skills Catalog by Use Case (Engineering / Documentation / Research)

Organizes widely-used public Agent Skills into three domains: **engineering, documentation, and research**, based on common software development practice. Covers both Claude Code and Codex CLI. See `ai/platform/agent-skills-spec.md` for the format spec and `ai/platform/agent-skills-best-practices.md` for general authoring guidance.

Quality and maintenance status of public skills vary widely, and some bundle executable scripts. Both Anthropic and OpenAI recommend "**installing only from trusted sources**." As with star counts and CVEs, always inspect a skill's contents before use.

## Cross-tool prerequisites (Claude Code ↔ Codex CLI)

Agent Skills is an open standard (`SKILL.md` requires `name` / `description`). The contents of `SKILL.md` are portable across both tools, but discovery paths and invocation methods differ.

| | Claude Code | Codex CLI |
|---|---|---|
| Standard discovery | `.claude/skills/` + cross-tool convention `.agents/skills/` | **Primary location is `.agents/skills/`** (`$CWD` → parent → repo root → `$HOME` → `/etc/codex/skills` → built-in) |
| Explicit invocation | `/skill-name` | `$skill-name` or `/skills` |
| Implicit invocation | Auto-delegation on description match (aggressive) | Auto-selection on description match, but conservative. Controlled via `policy.allow_implicit_invocation` in `agents/openai.yaml` |
| Tool permissions | `allowed-tools` (experimental) | `allowed-tools` has low reliability. Use `agents/openai.yaml` policy + `approval_policy="granular"` in `config.toml` → `skill_approval` |
| Distribution unit | plugin marketplace (`/plugin`) | **Plugins** (bundles skills/apps/MCP; `openai/plugins`) |

- **Interoperability**: Standard-compliant skills placed in `.agents/skills/` work on both tools. However, Claude-specific frontmatter (`when_to_use` / `argument-hint` / `paths` / `hooks`) is ignored by Codex, and Codex-specific `agents/openai.yaml` is ignored by Claude. **Body content + `name` / `description` are portable**, but functional parity is not guaranteed.
- **Codex's token budget**: The skill list shown at startup is capped at "2% of context, or 8,000 characters if unknown." Body content loads only when selected (progressive disclosure).
- **AGENTS.md** originated at OpenAI and is now a cross-vendor standard (agents.md). It is an always-on instruction independent of skills, with no direct coupling.
- Codex's legacy `~/.codex/prompts/*.md` (custom prompts) was deprecated on 2026-01-22; migration to Skills is the official direction.

## Engineering (requirements, design, implementation, testing, review)

### Public skills (engineering)

| Skill | Source | Purpose | Phase |
|---|---|---|---|
| `mcp-builder` | `anthropics/skills` (official) | MCP server build guide (FastMCP / TS SDK) | Design/Implementation |
| `webapp-testing` | `anthropics/skills` (official) | Test local web apps with Playwright | Testing |
| `web-artifacts-builder` | `anthropics/skills` (official) | Build UI with React/Tailwind/shadcn | Implementation |
| `frontend-design` | `anthropics/skills` (official) | Intentional UI visual design | Design (UI) |
| `skill-creator` | `anthropics/skills` (official) | Create/improve skills, measure evals (meta) | Process setup |
| `/code-review`, `/security-review`, `/run`, `/verify` | Bundled with Claude Code | Diff review / vulnerability review / app-launch verification | Review/Testing |
| `anthropics/claude-code-security-review` | Official GitHub Action | SQLi/XSS/authN-authZ/dependency vulnerability scanning | Review (CI) |
| `kiro-spec-requirements/-design/-tasks/-impl` etc. | `gotalab/cc-sdd` (17 skills) | SDD flow from EARS requirements → design → tasks → implementation. Supports **both Claude and Codex** (`--codex-skills`) | Requirements–Implementation |
| `speckit-specify/-plan/-tasks/-clarify/-analyze` | `github/spec-kit` | Spec-driven development. Codex uses `$speckit-*`, installed via `--skills` | Requirements/Design |
| `getsentry/sentry-pr-code-review`, `trailofbits/differential-review` | Vendor-official (aggregated via VoltAgent) | PR code review / diff review | Review |
| Codex Security plugin / `gh-address-comments` | `openai/plugins` (official) | Vulnerability scanning / PR comment resolution | Review |

> Codex's official skills migrated from `openai/skills` (**deprecated**) to `openai/plugins` (plugin format). `build-web-apps` / `build-ios-apps` / `build-macos-apps` etc. are implementation-focused. SE-specific role templates are not included in `openai/role-specific-plugins`.

### Best practices (engineering)

- **The core is tuning degrees of freedom.** "A narrow bridge between cliffs = low freedom (fixed script)" vs. "an open field with no obstacles = high freedom (prose)."
  - High: code review, design decisions (prose procedures)
  - Medium: codegen with recommended patterns (pseudocode/parameterized)
  - Low: **DB migrations, test execution** (`migrate.py --verify --backup`, "no adding/changing flags")
- **Script brittle, consistency-critical operations**: write `validate_form.py` rather than having the model generate it. Distinguish execution intent with `Run` vs. `See ... for the algorithm` (reference).
- **Process-type skills use a checklist + feedback loop**: a copyable `- [ ]` checklist plus a "run validator → fix → repeat" cycle. Destructive operations use **plan-validate-execute** (write the plan to `changes.json` → validate → execute → confirm). Applies to TDD loops, review procedures, and SDD flows.
- **Knowledge-type skills put domain-specific material in `references/`, one level deep** (API schemas, conventions). Zero token cost until read.

## Documentation (proposals, specs, design docs, technical writing, slides)

### Public skills (documentation)

| Skill | Source | Purpose |
|---|---|---|
| `doc-coauthoring` | `anthropics/skills` (official) | Co-authoring proposals / technical specs / decision docs (RFC/PRD). Three stages: context → refinement → reader testing. Pure procedure type with no resources |
| `internal-comms` | `anthropics/skills` (official) | Internal communications (3P updates / newsletters / FAQ / status / incident). `examples/` holds format-specific style guides |
| `docx` / `pptx` / `pdf` / `xlsx` | `anthropics/skills` (official, **source-available / not OSS**) | Generate, edit, extract, and convert Office documents. `scripts/` (pack/unpack/validate, soffice, markitdown) + OOXML schema |
| `theme-factory` | `anthropics/skills` (official) | Style artifacts (slides/docs/HTML) with 10 presets or generated themes. `assets/` + `themes/*.md` |
| `brand-guidelines` | `anthropics/skills` (official) | Apply brand colors/typography as post-processing (knowledge type) |
| cc-sdd `kiro-spec-requirements/-design`, Spec Kit `speckit-specify/-checklist` | `gotalab/cc-sdd` / `github/spec-kit` | Generate requirements / design / spec documents (Codex-compatible). Spec Kit's `checklist` acts as "unit tests in English for the spec" |
| `garrytan/document-release` | Community | Update docs to match shipped code |
| Mermaid family (`Agents365-ai/mermaid-skill` etc.) | Community | NL → `.mmd`, validation loop, various diagram types. For embedding diagrams into ADRs/READMEs |
| `notion` / `google-slides` plugin | `openai/plugins` (official, Codex) | Notion / Google Slides integration |

### Best practices (documentation)

- **Resource placement conventions**:
  - `assets/` = templates/boilerplate used in output (docx/pptx templates, letterhead, themes)
  - `references/` = style guides and writing conventions (read and follow; tables of contents required beyond 100 lines)
  - `scripts/` = deterministic generation/conversion (loading via markitdown, `.doc`→`.docx` via soffice, PDF form filling, OOXML validation)
- **Structured writing workflow** (exemplified by `doc-coauthoring`): ① context gathering (5–10 clarifying questions) → ② refinement (3–5 section outline, prioritizing uncertain areas, partial edits via `str_replace`) → ③ **reader testing** (have a separate Claude instance with no context read it, predict reader questions, and iterate until gaps disappear).
- **Be aware of the skill's type**: procedural (co-authoring; no resources, high freedom) / template-based (docx/pptx; `assets`+`scripts`, low freedom, "existing template conventions always take priority") / knowledge-based (brand-guidelines; centered on `references`).
- **Brand and tone**: separate brand application as a post-generation pass. Route tone into format-specific references rather than a single generic instruction. `description` should be third-person with explicit triggers.

## Research (deep research, web research, codebase exploration, data analysis)

### Public skills (research)

| Skill | Source | Purpose |
|---|---|---|
| `xlsx` | `anthropics/skills` (official) | Spreadsheet data analysis (pandas / openpyxl). The official skill closest to data analysis |
| `webapp-testing` | `anthropics/skills` (official) | Investigating/verifying web apps (Playwright) |
| `deep-research` | **Built into the Claude Code harness** | Fan-out web search → fetch sources → adversarially verify claims → synthesize a cited report |
| `Weizhena/Deep-Research-skills` | Community (most starred) | Outline generation → parallel agent web research → Markdown report (HITL). Supports Claude/OpenCode/Codex |
| `glebis/claude-skills` (Deep Research / Firecrawl Research etc.) | Community | Wraps external Deep Research APIs, scraping + BibTeX, GRADE-based health research evaluation |
| `jamditis/claude-skills-journalism` | Community | 14 skills. SIFT/C2PA-based source verification, fact-checking, data journalism (pandas/polars/DuckDB) |
| `petar-nauka/fact-check-skill` | Community | 11-stage pipeline combining SIFT + CRAAP + claim decomposition |
| `trailofbits/audit-context-building` | Vendor-official | Building deep structural context of a codebase |
| Data Analytics / Financial Markets role plugin | `openai/role-specific-plugins` (official, Codex) | Metrics investigation/data validation / equity research memos |

> **Warning: there is no official general-purpose "deep-research" skill in `anthropics/skills`.** The only official research-adjacent skills are `xlsx` (data analysis) and `webapp-testing` (web investigation). Claude Code's `deep-research` is a harness-injected built-in at runtime — it exists neither on disk nor in a public repo (it is not a published artifact). Codex likewise has no official general-purpose deep-research skill.

### Best practices (research)

- **Orchestrator-worker / fan-out** (from Anthropic's "multi-agent research system"): a lead launches 3–5 subagents in parallel (10+ for complex tasks), each running 3+ tools in parallel. For breadth-first exploration, multi-agent setups **outperformed a single Opus by 90.2%**.
- **Skill vs. agent orchestration**: use a **skill** for self-contained, sequential research procedures bundled with tools/rubrics. Escalate to **orchestrator + parallel subagents** when broad parallel exploration exceeds a single context (the skill then becomes its entry point/prompt). Avoid multi-agent setups when all agents need to share the same context or have heavy dependencies (as with much coding work).
- **Verification and citation discipline**: map claims to source locations (equivalent to a `CitationAgent`). Score citation accuracy with an LLM judge. **Flag single-sourced claims; surface source conflicts explicitly rather than smoothing them over.**
- **Avoiding hallucination**: triangulate across multiple sources and state uncertainty explicitly.
- **Token/context management**: multi-agent setups consume roughly 15x the tokens of a chat ("token volume alone explains 80% of eval variance"). **Start wide, then narrow down** (summarize, then drill in), allocate effort by complexity, and have subagents compress findings before returning them to the lead. Put source-evaluation rubrics (CRAAP/SIFT) in `references/` and fetch/parse/dedup logic in `scripts/`.

## General selection and operating guidance

- **Trust order: official > vendor-official > community.** Awesome-list aggregators (`ComposioHQ/awesome-claude-skills` 66k★, `VoltAgent/awesome-agent-skills` 26k★) are **indexes**; stars do not guarantee the quality of any individual skill.
- **Cross-tool operation**: place standard-compliant skills in `.agents/skills/`. Keep the body content portable on the assumption that Claude/Codex-specific frontmatter will be ignored by the other tool.
- **Security**: community skills bundle executable scripts. Before adopting, audit scripts/dependencies/instructions that could redirect execution externally (prompt-injection vectors). `allowed-tools` is experimental and should not be trusted as a boundary.

## References

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system)
- [anthropics/skills (official public skills)](https://github.com/anthropics/skills)
- [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)
- [Codex Agent Skills (OpenAI official)](https://developers.openai.com/codex/skills)
- [openai/plugins (Codex official plugins)](https://github.com/openai/plugins) / [openai/role-specific-plugins](https://github.com/openai/role-specific-plugins)
- [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) / [github/spec-kit](https://github.com/github/spec-kit)
- Related: `ai/platform/agent-skills-best-practices.md` (authoring guidance), `ai/platform/agent-skills-spec.md` (spec), `ai/agents/codex-cli.md`, `ai/workflow/cc-sdd.md`, `ai/workflow/github-spec-kit.md`
