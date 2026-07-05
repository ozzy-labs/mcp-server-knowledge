---
reviewed: 2026-05-04
tags: [go, lint, ci]
---

# golangci-lint

A **linter orchestrator** for Go. Runs 100+ linters in parallel with a single command, reusing the Go build cache and its own analysis-result cache, so it stays fast even on large repos. The de facto standard Go linter.

Official: [golangci-lint.run](https://golangci-lint.run/) / [GitHub](https://github.com/golangci/golangci-lint)

The current version line is v2 (v1 has been maintenance-only since 2025). **Choose v2 for new setups.**

## Installation

```bash
# Official install script (pinning a version is recommended)
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh \
  | sh -s -- -b $(go env GOPATH)/bin v2.12.1

# go install (the v2 module path includes /v2)
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest

# Package managers
brew install golangci-lint                 # macOS
scoop install main/golangci-lint           # Windows
mise use -g golangci-lint@v2.12.1
```

The official docs explicitly state **`go install` is not guaranteed to work**; CI should use the install script or a binary release.

## Migrating to v2

v2 was released in 2025-03. There's an automatic migration command for v1 configs:

```bash
golangci-lint migrate              # convert .golangci.yml to v2 format
golangci-lint migrate --format yaml --skip-validation
```

Produces a backup named `<config>.bck.<ext>`. **Comments are not migrated**, so restore them manually.

Key breaking changes:

- Config file now requires `version: "2"`
- `linters-settings:` → `linters.settings:` / `formatters.settings:`
- `linters.disable-all` → `linters.default: none`, `linters.enable-all` → `linters.default: all`
- `issues.exclude-dirs/files` → `linters.exclusions.paths`
- `issues.exclude-rules` → `linters.exclusions.rules`
- Formatters (`gci` / `gofmt` / `gofumpt` / `goimports`) are **split into their own `formatters:` section**
- Removed linters: `deadcode`, `golint`, `interfacer`, `maligned`, `scopelint`, `structcheck`, `varcheck`, and others
- `gosimple` / `stylecheck` merged into `staticcheck`
- Aliases removed: `gas` → `gosec`, `gomnd` → `mnd`, `vet` → `govet`
- CLI: `--out-format` restructured to `--output.<fmt>.path=...`

## Basic commands

```bash
golangci-lint run                       # current package
golangci-lint run ./...                 # whole repo
golangci-lint run --fix                 # auto-fix
golangci-lint run --timeout 5m

# Diff-based runs (handy for PR review)
golangci-lint run --new-from-rev=HEAD~1
golangci-lint run --new-from-merge-base=main
golangci-lint run --whole-files         # show the entire changed file

# Output (v2 uses sub-key form)
golangci-lint run --output.json.path=stdout
golangci-lint run --output.sarif.path=report.sarif
golangci-lint run --output.checkstyle.path=cs.xml
golangci-lint run --output.junit-xml.path=junit.xml

# Subcommands
golangci-lint linters         # list available linters
golangci-lint formatters      # list formatters (new in v2)
golangci-lint config verify   # validate config against the JSON Schema
golangci-lint config path     # path of the config in use
golangci-lint cache status / cache clean
golangci-lint fmt             # run only formatters (new in v2)
golangci-lint completion {bash|zsh|fish|powershell}
```

Config file lookup order: `.golangci.yml` → `.golangci.yaml` → `.golangci.toml` → `.golangci.json` (from CWD up to root, then home).

## Config file (v2 schema)

```yaml
version: "2"

run:
  timeout: 5m
  build-tags:
    - integration
  modules-download-mode: readonly

linters:
  default: standard       # standard | all | none | fast
  enable:
    - gosec
    - revive
    - bodyclose
    - errorlint
  disable:
    - gocyclo
  settings:
    revive:
      rules:
        - name: var-naming
    gosec:
      excludes:
        - G104
  exclusions:
    generated: strict     # strict | lax | disable
    warn-unused: true
    presets:
      - comments
      - common-false-positives
      - legacy
      - std-error-handling
    rules:
      - path: _test\.go
        linters: [errcheck, gosec]
    paths:
      - third_party
      - vendor

formatters:
  enable:
    - gofumpt
    - goimports
    - gci
  settings:
    gci:
      sections:
        - standard
        - default
        - prefix(github.com/your-org)
    gofumpt:
      extra-rules: true
    goimports:
      local-prefixes: github.com/your-org

issues:
  max-issues-per-linter: 50
  max-same-issues: 3

output:
  formats:
    text:
      path: stdout
      colors: true
```

## Key linters

### Enabled by default (`default: standard`)

The five: `errcheck` / `govet` / `ineffassign` / `staticcheck` / `unused`.

### Commonly added

| linter | purpose |
|---|---|
| `revive` | style checks, the `golint` successor |
| `gocritic` | comprehensive code-review-style checks |
| `gosec` | security (e.g. G101 hardcoded credentials) |
| `bodyclose` / `sqlclosecheck` | resource-leak prevention |
| `errorlint` | detects missing `%w` wrapping / `==` comparisons |
| `wrapcheck` | checks whether external errors are wrapped |
| `exhaustive` | switch / map exhaustiveness |
| `depguard` | import restrictions (banning specific packages) |
| `testifylint` | misuse of testify assertions |
| `paralleltest` / `tparallel` | missing `t.Parallel()` |
| `mnd` | magic-number detection |

### Formatters (moved to the `formatters:` section in v2)

- `gofmt` (standard)
- `goimports` (gofmt + import organization)
- `gofumpt` (stricter than gofmt, a superset of `gofmt`)
- `gci` (import grouping, supports local prefixes)
- `golines` (line-length limiting)

## CI integration (GitHub Actions)

Official action: `golangci/golangci-lint-action`. **If using v2, use action v7 or later** (v8 supports absolute `--working-directory` paths, v9 uses Node.js 24).

```yaml
name: golangci-lint
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  golangci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: stable
      - uses: golangci/golangci-lint-action@v8
        with:
          version: v2.12
          args: --timeout 5m --new-from-merge-base=origin/main
          only-new-issues: true
```

Key inputs: `version`, `args`, `working-directory`, `only-new-issues`, `skip-cache`, `install-mode` (`binary` / `goinstall` / `none`), `problem-matchers`, `github-token`. Automatically caches `~/.cache/golangci-lint`.

### SARIF → Code Scanning integration

```yaml
- uses: golangci/golangci-lint-action@v8
  with:
    args: --output.sarif.path=results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## Performance tuning

- `--concurrency N` / `-j N`: number of CPUs to use
- `--allow-parallel-runners`: allow multiple concurrent invocations
- `--allow-serial-runners`: serialize via lock (for CI where multiple steps run concurrently)
- `--max-issues-per-linter` / `--max-same-issues`: control output volume
- Large repos: exclude `vendor` and generated code via `linters.exclusions.paths`

## Common mistakes AI agents make

1. **Using a v1-format `.golangci.yml` in a v2 environment** — startup fails without `version: "2"`. Convert it with `golangci-lint migrate`
2. **Listing formatters under `linters.enable`** — in v2 they belong under `formatters.enable`. `gofumpt` / `goimports` / `gci` / `gofmt` / `golines` are formatters
3. **Enabling `gosimple` / `stylecheck` individually** — already merged into `staticcheck` in v2. Specifying them causes an unknown-linter error
4. **Running with `--out-format json`** — removed in v2. Use `--output.json.path=stdout`
5. **Deploying via `go install` in production** — not guaranteed to work per the official docs. Use the install script or a binary release in CI
6. **Using `golangci-lint-action@v3` with a v2 config** — action v6 and below only support v1. A v2 config requires action v7+

## References

- [Install (Local)](https://golangci-lint.run/docs/welcome/install/local/)
- [Install (CI)](https://golangci-lint.run/docs/welcome/install/ci/)
- [Configuration File](https://golangci-lint.run/docs/configuration/file/)
- [Linters](https://golangci-lint.run/docs/linters/)
- [Formatters](https://golangci-lint.run/docs/formatters/)
- [Migration Guide v1 → v2](https://golangci-lint.run/docs/product/migration-guide/)
- [golangci-lint-action](https://github.com/golangci/golangci-lint-action)
