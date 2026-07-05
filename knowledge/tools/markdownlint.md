---
reviewed: 2026-05-04
tags: [lint, markdown, javascript]
---

# markdownlint

A linter that validates Markdown syntax and style. `markdownlint-cli2` is the currently recommended CLI. The rule set follows [CommonMark](https://commonmark.org/) + GitHub Flavored Markdown.

Official: [github.com/DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint) / [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)

## Installation

```bash
# mise + npm
mise use npm:markdownlint-cli2@0.22

# npm (project-local)
pnpm add -D markdownlint-cli2

# Homebrew
brew install markdownlint-cli2
```

**`markdownlint-cli` (plain) and `markdownlint-cli2` are different packages**. The latter is the official recommendation and has richer features. This article covers cli2.

## Basic usage

```bash
# single file
markdownlint-cli2 README.md

# recursive + glob
markdownlint-cli2 "**/*.md"

# auto-fix
markdownlint-cli2 --fix "**/*.md"

# specify config
markdownlint-cli2 --config .markdownlint.jsonc "**/*.md"
```

## Config `.markdownlint.jsonc` / `.markdownlint-cli2.jsonc`

```jsonc
{
  // inherited preset
  "default": true,

  // individual rules
  "MD013": false,            // line-length (hard to constrain with Japanese text)
  "MD033": false,            // allow inline HTML
  "MD041": true,             // file must start with H1
  "MD024": {
    "siblings_only": true    // only forbid duplicates at the same level
  },

  "MD026": { "punctuation": ".,;:!" }, // trailing punctuation in headings
  "MD007": { "indent": 2 }             // unordered list indent
}
```

- `default: true` enables all rules → the common practice is to disable individual rules from there
- Config files are auto-detected: `.markdownlint.json`, `.markdownlint.jsonc`, `.markdownlint.yaml`, `.markdownlint.cjs`, etc.

### cli2-specific config `.markdownlint-cli2.jsonc`

```jsonc
{
  "config": { "default": true, "MD013": false },
  "globs": ["**/*.md", "!node_modules/**", "!dist/**"],
  "ignores": ["CHANGELOG.md"],
  "fix": true
}
```

cli2 lets you write globs / ignores / fix into the config file, simplifying CLI arguments.

## Key rules

| ID | Meaning |
|---|---|
| MD001 | No skipping heading levels (H2 followed directly by H4 is not allowed) |
| MD003 | Consistent heading style (`#` style vs. underline style) |
| MD004 | Consistent unordered list marker (`-` / `*` / `+`) |
| MD007 | Unordered list indentation |
| MD009 | Trailing spaces |
| MD010 | Tab usage |
| MD011 | Reversed link syntax `(text)[url]` |
| MD013 | Line length |
| MD018-MD023 | Spacing around headings |
| MD024 | Duplicate headings |
| MD025 | Duplicate H1 (only one allowed) |
| MD029 | Ordered list numbering |
| MD031 | Blank lines around code blocks |
| MD033 | Inline HTML |
| MD034 | Bare URLs (should be `<https://...>`) |
| MD040 | Code blocks must have a language tag |
| MD041 | File must start with H1 |
| MD047 | File must end with a newline |

All rules: [official rules list](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)

## Suppressing individual rules

### Line-level

```markdown
<!-- markdownlint-disable-next-line MD033 -->
<details>

<!-- markdownlint-disable MD033 MD041 -->
<div>complicated HTML</div>
<!-- markdownlint-enable MD033 MD041 -->
```

### File-level

```markdown
<!-- markdownlint-disable MD013 -->
```

## Scope of auto-fix

`--fix` automatically fixes most issues:

- removing trailing spaces
- adding trailing newline at end of file
- blank lines around headings
- unifying list markers
- blank lines around code blocks

Not auto-fixed: things that require semantic judgment, such as heading-level skips (MD001) or duplicate headings (MD024).

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    markdownlint:
      glob: "**/*.md"
      run: markdownlint-cli2 --fix {staged_files}
      stage_fixed: true
```

Same configuration as this repository's `lefthook-base.yaml`.

## Usage in CI

```yaml
- run: pnpm dlx markdownlint-cli2 "**/*.md"
```

SARIF output is not supported, so combine it with a tool that streams failure logs into Pull Request annotations:

```yaml
- uses: DavidAnson/markdownlint-cli2-action@v23
  with:
    config: ".markdownlint.jsonc"
    globs: "**/*.md"
```

## Notes specific to Japanese text

- **MD013 (line length)**: Japanese text has no word boundaries, so a line-length limit isn't practical. **Disabling is recommended**
- **MD026 (trailing punctuation)**: `。` and `、` are not included in the default `punctuation` option, so trailing punctuation in Japanese headings is allowed
- **Full-width/half-width spaces**: markdownlint does not detect these. Handle via visual inspection or another tool (textlint)

## Compromise for MD013 (line length)

Instead of fully disabling it, you can relax it for English-centric documents:

```jsonc
{
  "MD013": {
    "line_length": 120,
    "tables": false,      // no limit for tables
    "code_blocks": false  // no limit for code blocks
  }
}
```

## Editor integration

- **VS Code**: [markdownlint extension](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint). Auto-fix on save works
- **Neovim**: via null-ls / conform.nvim

## markdownlint vs. textlint vs. Vale

| Aspect | markdownlint | textlint | Vale |
|---|---|---|---|
| Language | Node.js | Node.js | Go |
| Focus | Syntax / formatting | Prose (Japanese / English) | Prose (English-centric) |
| Plugins | Rules are built-in | Rich (geared toward technical writing) | Google / Microsoft style guides, etc. |
| Speed | Fast | Medium | Fast |
| Use case | Enforcing Markdown syntax | Detecting misuse in Japanese prose | Enforcing English style |

**Example combination**: markdownlint (syntax) + textlint (Japanese prose rules) + prh (terminology-consistency dictionary). Run markdownlint as the first line of defense; textlint is optional.

## Troubleshooting

### `MD013` flags every line for Japanese text

Disable it, or raise `line_length` to something like 300.

### Auto-fix isn't applying

You may be using the old `markdownlint-cli`. Switch to `markdownlint-cli2 --fix`.

### Error for duplicate headings

Set `MD024`'s `siblings_only: true` to check only within the same level. Useful when you want to allow a "Troubleshooting" sub-heading to repeat across different sections.

### Code block language-tag warning (MD040)

Using ```` ``` ```` alone without specifying a language. Always add `bash` / `ts` / `text` etc. This KB's writing conventions also require it (see `standards/markdown-style.md`).
