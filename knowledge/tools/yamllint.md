---
reviewed: 2026-05-04
tags: [lint, yaml, python]
---

# yamllint

A linter that validates YAML syntax and **style**. Written in Python. Detects YAML-specific pitfalls such as indentation, line length, comment formatting, and truthy value handling.

Official: [github.com/adrienverge/yamllint](https://github.com/adrienverge/yamllint)

## Installation

```bash
# mise + pipx
mise use pipx:yamllint@1

# pipx (recommended, isolated from other Python dependencies)
pipx install yamllint

# pip
pip install yamllint

# Homebrew
brew install yamllint
```

## Basic Usage

```bash
# Single file
yamllint config.yaml

# Recursive
yamllint .

# Specify config
yamllint -c .yamllint.yaml .

# Specify format
yamllint -f parsable .         # gcc-compatible (for editor integration)
yamllint -f github .           # GitHub Actions annotations
yamllint -f colored .          # colored
yamllint -f standard .         # default
```

## Built-in Presets

| Preset | Characteristics |
|---|---|
| `default` | Standard rule set |
| `relaxed` | Loose, close to warnings-only |

```yaml
# .yamllint.yaml
extends: default

rules:
  line-length:
    max: 120
```

## Key Rules

| Rule | Meaning |
|---|---|
| `indentation` | Indentation width (spaces-consistent, sequences) |
| `line-length` | Maximum line length (default 80) |
| `trailing-spaces` | No trailing whitespace |
| `new-line-at-end-of-file` | Trailing newline required |
| `truthy` | Handling of `yes`/`no`/`on`/`off`; warns when not interpreted as bool |
| `key-duplicates` | Duplicate keys |
| `document-start` | Presence of `---` |
| `empty-lines` | Limit on consecutive blank lines |
| `brackets` / `braces` | Spacing around brackets |
| `comments` | Spacing between `#` and comment text |
| `comments-indentation` | Comment indentation |
| `quoted-strings` | String quoting policy |

## Configuration `.yamllint.yaml`

```yaml
extends: default

rules:
  line-length:
    max: 120
    level: warning
  truthy:
    check-keys: false        # allow GitHub Actions' `on:` etc.
  comments:
    min-spaces-from-content: 1
  document-start: disable

ignore: |
  node_modules/
  dist/
  .git/
```

Exclusion patterns can also be written in `.yamllintignore` (.gitignore-style).

## Rule Severity

Each rule takes one of the following:

- `enable` / `disable` (inherit the preset's value)
- `error` — non-zero exit on violation
- `warning` — reported but does not cause non-zero exit

```yaml
rules:
  line-length:
    max: 120
    level: warning
```

## Inline Suppression

Use `yamllint` directives for a line or block:

```yaml
# yamllint disable-line rule:line-length
very-long-line-that-exceeds-120-chars-yadda-yadda-yadda-yadda-yadda

# yamllint disable rule:truthy
deprecated: yes
production: no
# yamllint enable rule:truthy
```

## pre-commit Integration (lefthook)

```yaml
pre-commit:
  commands:
    yaml:
      glob: "**/*.{yaml,yml}"
      run: yamlfmt {staged_files} && yamllint -c .yamllint.yaml {staged_files}
      stage_fixed: true
```

Format with yamlfmt first, then validate with yamllint — this order is recommended.

## Usage in CI

```yaml
- run: yamllint -f github .    # displayed as annotations in GitHub Actions
```

SARIF output is not supported, so use raw text or the `parsable` format.

## Common Issues

### The `truthy` rule warns on GitHub Actions

GitHub Actions' `on:` is interpreted as `true` in YAML (a reserved word):

```yaml
on:
  push:
    branches: [main]
```

Allow it by setting `truthy.check-keys: false`.

### Indentation inconsistency

There are different conventions for sequence (`- item`) indentation:

```yaml
# indent-sequences: true (recommended, default)
list:
  - a
  - b

# indent-sequences: false
list:
- a
- b
```

Standardize with `indentation.indent-sequences` in `.yamllint.yaml`.

### Line length of 80 is too strict

In practice, 100-120 is more realistic. Raise `line-length.max` or lower it to `level: warning`.

### False positives in Helm / Ansible templates

`{{ ... }}` / `{% %}` break as non-YAML syntax. Since yamllint does not understand Go templates or Jinja, excluding the relevant directories via `.yamllintignore` is the practical approach.

## yamlfmt vs. yamllint

- **yamllint**: **lint** (validation). Does not auto-fix
- **yamlfmt**: **format**. Auto-formats

Ideally run both. Since many lint findings (trailing-spaces, new-line-at-end-of-file, etc.) require formatting to pass, run yamlfmt first.

## Editor Integration

- **VS Code**: [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (separate from JSON Schema validation, but can be used together)
- **Neovim**: via null-ls / efm-langserver

Lint-on-save lets you fix issues as you write.

## Comparison with Other Tools

| Aspect | yamllint | Spectral | check-yaml (pre-commit) |
|---|---|---|---|
| Scope | YAML syntax + style | JSON Schema + OpenAPI, etc. | Parseability only |
| Language | Python | Node.js | Python |
| Customization | Rule config | Powerful (DSL) | Limited |
| Use case | General-purpose YAML | Schema validation | Minimal sanity check |

For general YAML file quality, use yamllint. For specific schemas (OpenAPI, Kubernetes, etc.), combine with Spectral or JSON Schema validation.
