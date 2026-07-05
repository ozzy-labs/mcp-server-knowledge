---
reviewed: 2026-05-04
tags: [format, yaml, go]
---

# yamlfmt

A YAML formatter made by Google. A single binary written in Go. Formats indentation, line endings, key order, etc. into a consistent style. Pairs with yamllint (validation).

Official: [github.com/google/yamlfmt](https://github.com/google/yamlfmt)

## Installation

```bash
# mise
mise use yamlfmt@0.21

# Homebrew
brew install yamlfmt

# Go
go install github.com/google/yamlfmt/cmd/yamlfmt@latest

# Docker
docker run --rm -v "$PWD:/workdir" ghcr.io/google/yamlfmt:latest -lint
```

## Basic usage

```bash
# Write back (default)
yamlfmt file.yaml

# Recursive
yamlfmt .

# Check whether formatted (no write-back)
yamlfmt -lint file.yaml

# Show diff
yamlfmt -dry -output_format=diff file.yaml

# Specify config
yamlfmt -conf .yamlfmt
```

## Config `.yamlfmt`

Supports both YAML and JSON:

```yaml
# .yamlfmt
formatter:
  type: basic
  indent: 2
  include_document_start: false
  retain_line_breaks_single: true
  scan_folded_as_literal: true
  max_line_length: 120
  trim_trailing_whitespace: true

include:
  - "**/*.yaml"
  - "**/*.yml"

exclude:
  - "node_modules/**"
  - ".git/**"
  - "dist/**"
  - "pnpm-lock.yaml"

gitignore_excludes: true
```

## Key formatter options

| Option | Effect |
|---|---|
| `indent` | Indent width (default 2) |
| `line_ending` | `lf` / `crlf` |
| `max_line_length` | Wrap long lines (0 = unlimited) |
| `include_document_start` | Force leading `---` |
| `trim_trailing_whitespace` | Remove trailing whitespace |
| `eof_newline` | Ensure trailing newline |
| `retain_line_breaks` | Preserve consecutive blank lines |
| `retain_line_breaks_single` | Collapse consecutive blank lines into one |
| `scan_folded_as_literal` | Treat `>` as `\|` |
| `disallow_anchors` | Disallow anchors (avoid confusion in shared configs) |

## Directives

Line- or block-level suppression of formatting is not supported. To exclude a location from formatting, exclude the whole file via `exclude` in `.yamlfmt`.

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    yaml:
      glob: "**/*.{yaml,yml}"
      run: yamlfmt {staged_files} && yamllint -c .yamllint.yaml {staged_files}
      stage_fixed: true
```

Runs format, then lint, in that order. `stage_fixed: true` re-stages the diff after formatting.

## Usage in CI

```bash
# CI mode (exits non-zero if there is a diff)
yamlfmt -lint .
```

GitHub Actions (there is no official Action, so run the binary directly):

```yaml
- name: Run yamlfmt
  run: |
    docker run --rm -v "$PWD:/workdir" ghcr.io/google/yamlfmt:latest -lint .
```

Or pin the version with `mise`:

```yaml
- uses: jdx/mise-action@v2
- run: yamlfmt -lint .
```

## Reproducible operation

To keep formatting results stable:

- Commit `.yamlfmt` to the repository
- Pin the version with `mise use yamlfmt@<version>`
- Apply the initial formatting as a separate commit (e.g. `style: apply yamlfmt`) and exclude it from blame via `.git-blame-ignore-revs`

## Anchors and references

The formatter does not expand YAML `&anchor` / `*anchor` (since that would change semantics). If you use them, be sure to visually verify the result matches intent. Setting `disallow_anchors: true` to forbid them and force explicit copies is also an option.

## Handling of complex types

```yaml
# block style (preserved by default)
list:
  - a
  - b

# flow style (not forcibly converted, user's choice respected)
list: [a, b]
```

yamlfmt takes the conservative approach of only adjusting indentation and line endings, without changing the existing style (block / flow).

## Troubleshooting

### `document_start` gets inserted unexpectedly

Check the default config. Suppress it with `include_document_start: false`.

### Breaks Helm / Ansible template syntax

`{{ }}` / `{% %}` cannot be parsed as YAML, so exclude the affected directories via `exclude`.

### Formatting pnpm-lock.yaml breaks the lockfile

Never hand-format the lockfile. Always add `exclude: [pnpm-lock.yaml]`.

### Conflicts with yamllint

If yamllint raises a "trailing-spaces" warning, yamlfmt's `trim_trailing_whitespace: true` will auto-fix it. Keep the rule configuration aligned between the two tools.

## Comparison with other tools

| Aspect | yamlfmt | Prettier (YAML) | yq |
|---|---|---|---|
| Purpose | Formatter only | Multi-language formatter | Parser + query + format |
| Language | Go | Node.js | Go |
| Conservative formatting | Excellent | Good | Fair (query has side effects) |
| Config flexibility | Medium | High | — |

If you already use Prettier for other languages, its YAML plugin may be sufficient. Choose yamlfmt if you want to stay within shell tooling alone, or want speed from a Go binary.
