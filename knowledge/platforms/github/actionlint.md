---
reviewed: 2026-05-04
tags: [lint, yaml, github, go]
---

# actionlint

A static analysis tool for GitHub Actions workflow files (`.github/workflows/*.yaml`). Detects syntax errors, expression type mismatches, shellcheck integration issues, and unknown runners or actions. A single Go binary.

Official: [github.com/rhysd/actionlint](https://github.com/rhysd/actionlint)

## Installation

```bash
# mise
mise use actionlint@1

# Homebrew
brew install actionlint

# Go
go install github.com/rhysd/actionlint/cmd/actionlint@latest

# One-liner
bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
```

## Basic usage

```bash
# All workflows in the repository
actionlint

# Specific file
actionlint .github/workflows/ci.yaml

# Colored, verbose
actionlint -color

# Specify config file
actionlint -config-file .github/actionlint.yaml
```

## What it detects

| Category | Example |
|---|---|
| YAML / Workflow syntax | `run-on:` in `jobs.*` (typo; correct is `runs-on`) |
| Expression types | String concatenation with `${{ github.event.number }}`, which is a number type |
| Expression references | References to nonexistent output / secret / variable |
| `runs-on` | Unknown runner label (e.g. `ubuntu-late`) |
| `uses` | Nonexistent action, missing tag |
| Shell scripts | Shell scripts inside `run:` (via shellcheck) |
| needs graph | Circular dependencies, nonexistent job |
| if conditions | Type mismatches, unused branches |
| matrix | References to nonexistent keys |

## shellcheck integration

Runs `run:` blocks through shellcheck to validate shell scripts. Integrates automatically if shellcheck is installed:

```yaml
- run: |
    if [ $BAR = "foo" ]; then  # shellcheck warns "$BAR may expand to empty"
      echo matched
    fi
```

Disable: `actionlint -shellcheck=` (empty value).

## pyflakes integration

Python inside `shell: python` or the `script` field of `with: actions/github-script` can be validated with pyflakes (automatic if installed in the environment).

## Configuration: `.github/actionlint.yaml`

```yaml
self-hosted-runner:
  labels:
    - my-self-hosted
    - gpu

config-variables:
  - ENV_NAME
  - REGION

paths:
  .github/workflows/deploy.yaml:
    ignore:
      - 'job "build" needs.*'  # temporarily suppressed
```

## Individual suppression

### File level

```yaml
# actionlint: shellcheck-disable=SC2086
```

### Top of workflow

```yaml
# actionlint-disable
```

Inline end-of-line support is limited, so scoping via `paths` in `.github/actionlint.yaml` is the practical approach.

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    actionlint:
      glob: ".github/workflows/*.{yaml,yml}"
      run: actionlint
```

Fast, since it only runs when workflow files change.

## Usage in CI

```yaml
jobs:
  lint-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: reviewdog/action-actionlint@v1
        with:
          reporter: github-pr-review
```

`reviewdog/action-actionlint` attaches findings directly as PR comments. Calling the raw command is also possible:

```yaml
- run: |
    bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
    ./actionlint -color
```

## Commonly caught mistakes

1. **Writing `on:` as a string** — `on: push` is fine, but attaching conditions to an event requires object form
2. **Typos in secrets / vars** — `${{ secrets.NMP_TOKEN }}` → `NPM_TOKEN`
3. **`needs: [a]` where `a` doesn't exist** — job id typo
4. **Referencing `secrets` in a fork PR** — secrets are empty under `pull_request`
5. **Unknown runner** — organization-custom runners like `ubuntu-latest-large` must be declared in the config file
6. **Missing action version pinning** — `uses: actions/checkout` (no tag) triggers a warning

## Troubleshooting

### Existing workflows produce a flood of errors

Temporarily exclude known patterns with `paths.<workflow>.ignore` and fix them incrementally.

### Self-hosted runner label reported as "unknown"

Add it to `self-hosted-runner.labels` in `.github/actionlint.yaml`.

### Organization custom variable treated as undefined

List it in `config-variables`.

### shellcheck doesn't run

shellcheck is not on PATH. Install it with `mise use shellcheck@0.11`.

## Comparison with other tools

| Aspect | actionlint | reviewdog/action-actionlint | GitHub UI |
|---|---|---|---|
| Detection accuracy | High | Same as actionlint | Basic syntax only |
| Execution environment | Local + CI | CI (with PR comments) | On save |
| shellcheck integration | Yes | Yes | No |
| Expression type checking | Yes | Yes | No |

In practice, actionlint is the clear choice for ensuring workflow quality. This repository also runs it via lefthook pre-commit.
