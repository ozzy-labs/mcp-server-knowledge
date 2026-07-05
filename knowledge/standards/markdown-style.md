---
reviewed: 2026-07-05
tags: [style, markdown]
---

# Markdown Writing Style (for This Repository)

Writing conventions for articles in this knowledge base. Ensures consistency when AI agents add new articles or update existing ones.

## Basic Policy

- **Prioritize information density**: cut preambles and repetition, keep only facts and decisions
- **Write in English (identifiers stay in English too)**: article body and headings are in English. See "[Description Language](#description-language-english-first)" below for details. Commands, field names, and error messages stay verbatim
- **Structure carries meaning**: keep the order heading → overview → specifics → example
- **Use tables where they organize better**: comparisons, lists, and catalogs favor tables over prose
- **Don't duplicate other articles**: if duplicated, consolidate into one and cross-link

## Description Language (English-First)

Article body, headings, and bullet lists are **written in English**. Identifiers (commands, field names, API IDs, error messages) stay in their original English form. This KB is an asset primarily read by AI agents via MCP, so the description language is chosen to optimize for the reading side.

- **Rationale**: token efficiency at retrieval time, fidelity to sources (official English docs) and ease of re-verification, stable instruction-following, and consistency across multi-agent setups (Claude / Codex / Gemini / Copilot). Same policy as the English convention in "Agent Skills Authoring" in `~/.agents/AGENTS.md`
- **Independent of response language**: the agent's response language is governed by "respond in Japanese" at the top of AGENTS.md. Do not write about response language inside an article (description language ≠ response language)
- **Search**: discovery is handled by English filenames / aliases / frontmatter. For high-frequency topics you want to look up in Japanese, you may optionally add Japanese terms to the frontmatter `aliases`
- **Migration**: existing Japanese articles are progressively translated to English during re-verification via `/update`. To avoid a prolonged bilingual mix, it's preferable to convert a whole category at once when starting

## File Layout

```text
knowledge/
├── tools/          Articles per CLI / SDK / library
├── standards/      Conventions, design principles, protocols
├── languages/      By programming language
└── platforms/      Platforms and services
```

File names are kebab-case: `mcp-typescript-sdk.md` / `conventional-commits.md`.

## Frontmatter

Every article starts with YAML frontmatter:

```markdown
---
reviewed: 2026-05-10
---

# Article Title

...
```

| Field | Meaning | Required |
|---|---|---|
| `reviewed` | Last date the facts were verified (`YYYY-MM-DD`) | Yes |

- `reviewed` is written by `/create` (on creation) and `/update` (on re-verification). Creation date is treated as the last-verified date
- `generate-index.mjs` renders the `reviewed` column in INDEX.md so stale articles can be spotted visually
- Parsing only supports simple `key: value` form (no nesting or arrays)
- Room to add `tags` / `source_verified_at` / `deprecated` etc. in the future

When rewriting an article, **always update `reviewed`**. Minor edits without fact verification (e.g., typo fixes) may leave it unchanged.

## Article Skeleton

Recommended section order (not all are mandatory):

```markdown
# Title

1-2 line summary. What it is and why it matters, in one sentence.

Official: [Link](URL)

## Installation / Setup
## Basic Commands / Minimal Example
## Key Concepts (table)
## Configuration / API Reference
## Pitfalls / Anti-patterns
## Troubleshooting
## Comparison with Other Tools
## References
```

The "Common AI Agent Mistakes" section is especially valuable (it's the reason this KB exists).

## Headings

- `#` for exactly one title
- `##` for major sections
- `###` only when necessary. `####` is almost never used
- Don't number headings (auto-numbering is more stable when editing)

## Emphasis

- `**bold**`: key terms, warnings
- `*italic*`: first occurrence of a term
- Avoid overuse (if everything is bold, nothing stands out)

## Code Blocks

Always specify a language tag:

````markdown
```ts
const x = 1;
```
````

| Use case | Language tag |
|---|---|
| Shell commands | `bash` |
| Config file (JSON) | `json` |
| Config file (YAML) | `yaml` |
| Config file (TOML) | `toml` |
| TypeScript | `ts` |
| JavaScript | `js` |
| Python | `python` |
| Pseudocode / diagrams | `text` |

### Comments in Code

Comments that clarify meaning in examples should be **concise English**. Japanese comments are fine for human-facing code, but snippets here are expected to be read internationally.

## Tables

- Keep to 3 columns or fewer. 4+ columns are hard to read — consider splitting
- Don't put a low-information column at the far right
- Handle line breaks within a cell by shortening the sentence rather than using `<br>`
- Wrap code in `` `backticks` ``

### OK

```markdown
| Field | Description |
|---|---|
| `name` | Server identifier name |
| `version` | Server semver |
```

### NG (too many elements)

```markdown
| Field | Type | Required | Default | Description | Notes |
```

## Links

- Use inline `[text](URL)` form
- Keep links to anything other than official documentation to a minimum
- Other articles in the same repository use relative paths: `` `standards/semver.md` `` or `[semver](semver.md)`

## Quotes and Warnings

```markdown
> **Note**: warning text here.
```

- Standardize on `> **Note**:` / `> **Tip**:` / `> **Important**:`
- Don't overuse (writing it in the body text is often more readable)

## Lists

- Use `1.` / `2.` / `3.` when order matters (auto-numbering or sequential `1.` both work)
- Use `-` when order doesn't matter
- Don't use `*` (this KB standardizes on `-`)
- Nest no more than 2 levels

## Spacing Between Japanese and Alphanumeric Text

Following the common rule in CLAUDE.md, **insert a half-width space**:

```markdown
OK: pnpm install で依存関係を取得する
NG: pnpminstallで依存関係を取得する
NG: pnpm installで依存関係を取得する
```

markdownlint can't detect this, but apply it consistently for readability.

## Describing Versions

- **State the point in time explicitly**: "As of 2026-04, `gpt-5.4`"
- **Soften information you don't want to pin down**: "current latest", "latest stable"
- Wrap model names and API IDs in **code formatting**: `` `claude-opus-4-8` ``

Dated statements act as staleness markers. If old dates pile up, update them at review time.

## Common AI Agent Mistakes

Write this section actively for major articles. Format:

```markdown
## Common AI Agent Mistakes

1. **Short correct-answer label** — the specific misuse and why, in 1-2 sentences
2. **...**
```

3-6 bullet items read best. One sentence per item keeps density high.

## Prohibited

- **Emojis**: generally not used in headings or body text (prioritize searchability and formality). Don't add them for decoration
- **"I think..." hedging**: this is a normative document, so state things definitively
- **Ending with just "see the official docs for details"**: write at least a minimal summary before linking the source
- **Leaving TODO comments**: don't merge an article that's incomplete
- **Meaningless separator lines `---`**: section headings are sufficient

## Lint and Verification

```bash
# Single file
markdownlint-cli2 --fix knowledge/tools/foo.md

# Whole project
markdownlint-cli2 "knowledge/**/*.md"
```

lefthook's pre-commit auto-fixes (`stage_fixed: true`).

### markdownlint Configuration for This Project

Inherits a base configuration. Key rules:

- `MD013` line length: disabled (hard to set a meaningful limit for Japanese text)
- `MD033` inline HTML: allowed (for `<br>` etc. in tables)
- `MD041` first line must be H1: enabled
- `MD024` duplicate headings: disabled (because sub-headings under "Troubleshooting" tend to collide)

## Relationship to Other Tools

- [`markdownlint`](../tools/markdownlint.md) — syntax rule checker (linter)
- [`yamlfmt`](../tools/yamlfmt.md) — frontmatter formatting
- [`MarkItDown`](../tools/markitdown.md) — tool for converting various documents (Word, PDF, etc.) to Markdown

## Checklist (After Writing an Article)

- [ ] Does the summary right after the title convey "what it is / why it matters" in 1-2 lines?
- [ ] Is a link to the official documentation near the top?
- [ ] Are tables and bullet lists used appropriately?
- [ ] Do code blocks have language tags?
- [ ] Is there a "Common AI Agent Mistakes" section (or troubleshooting)?
- [ ] Is content that duplicates other articles referenced via a link instead?
- [ ] Is information prone to becoming stale marked with a date?
- [ ] Has it been run through markdownlint?
- [ ] Verified it's visible via `knowledge list <category>`?
