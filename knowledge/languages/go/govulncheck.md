---
reviewed: 2026-05-04
tags: [go, security, ci]
---

# govulncheck

The **official vulnerability detection CLI** developed by the Go Security team. Instead of mechanically listing CVEs found among `go.sum` dependencies, it reports only vulnerable functions that are **actually reachable via call-graph tracing** as Affected, resulting in dramatically fewer false positives than generic CVE scanners.

Official: [go.dev/security/vuln](https://go.dev/security/vuln/) / [pkg.go.dev/golang.org/x/vuln/cmd/govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck) / [GitHub](https://github.com/golang/vuln)

The data source is [vuln.go.dev](https://vuln.go.dev/) (the Go vulnerability database). The Go team triages reports from GitHub Advisory / NVD / direct reports from Go package maintainers and distributes them in OSV format. The Go team follows a **policy of not attaching severity labels** (judged to be context-dependent).

## Installation

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
```

Module mode is required (GOPATH is not supported).

## Basic commands

```bash
# Recursively scan the current module in source mode
govulncheck ./...

# Include test files in the scan
govulncheck -test ./...

# Verbose output (including call stacks)
govulncheck -show=traces,verbose,color ./...

# JSON / SARIF / OpenVEX output
govulncheck -format=json ./...
govulncheck -format=sarif ./... > report.sarif
govulncheck -format=openvex ./...

# Scan a compiled binary
govulncheck -mode=binary ./bin/myapp

# Scan precision (symbol / package / module)
govulncheck -scan=symbol ./...

# Use an alternative DB
govulncheck -db=https://internal-vuln.example.com ./...
```

### Key flags

| Flag | Role |
|---|---|
| `-mode source\|binary\|extract` | Scan target. `extract` extracts a minimal information blob from a binary |
| `-scan symbol\|package\|module` | Analysis precision. `symbol` is the highest precision (roughly the default) |
| `-show traces,verbose,color` | Comma-separated. `traces` shows the full call stack |
| `-format text\|json\|sarif\|openvex` | Output format |
| `-test` | Include test code |
| `-tags` | Comma-separated build tags |
| `-C <dir>` | Change working directory |
| `-db <url>` | Custom DB (must conform to the OSV schema) |

### Exit code pitfall

In text output, the exit code is non-zero when one or more vulnerabilities are found. **When using `-format=json` / `-format=sarif` / `-format=openvex`, the exit code is always 0 regardless of whether vulnerabilities were detected.** If you want CI to fail on findings, you need separate logic (e.g. `jq`) to make that determination.

## Source mode vs binary mode

| Item | Source (default) | Binary |
|---|---|---|
| Input | Go source | Compiled binary |
| Call graph | Yes | No |
| Precision | High (reports only actual reachability) | Low (tends to enumerate all dependencies) |
| Use case | Development / CI | Post-hoc check of distributed artifacts |

**Prefer source mode.** Use binary mode only when you have a distributed binary without the source available.

## Output format

```text
Vulnerability #1: GO-2021-0113
  Due to improper index calculation, ...
  More info: https://pkg.go.dev/vuln/GO-2021-0113
  Module: golang.org/x/text
    Found in: golang.org/x/text@v0.3.5
    Fixed in: golang.org/x/text@v0.3.7
    Call stacks in your code:
      main.go:12:29: vuln.tutorial.main calls golang.org/x/text/language.Parse
```

The ID scheme is `GO-YYYY-NNNN`, and detail URLs follow `https://pkg.go.dev/vuln/<ID>`.

An `=== Informational ===` section separately lists vulnerabilities that are "imported but have no call stack" (does not affect the exit code).

## CI integration (GitHub Actions)

### Official Action

```yaml
- uses: golang/govulncheck-action@v1
  with:
    go-version-input: stable
    go-package: ./...
```

Key inputs: `go-version-input` / `go-version-file` / `go-package` / `output-format` / `output-file` / `repo-checkout`.

> **Note**: Setting `output-format` to `json` / `sarif` causes the action to **return success even when vulnerabilities exist** (explicitly documented in the official README). When feeding results into Code Scanning, the standard practice is to call `github/codeql-action/upload-sarif` in a separate step.

### SARIF → Code Scanning integration

```yaml
- name: Run govulncheck
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck -format=sarif -scan=symbol ./... > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

**Important**: When feeding SARIF into Code Scanning, run in `-mode=source` (source mode). Binary mode has no source line numbers, which breaks SARIF display.

### Naive pattern for failing directly

```yaml
- name: govulncheck
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck ./...        # text mode, so exits non-zero on detected vulnerabilities
```

## VS Code integration (Go extension)

The `go.diagnostic.vulncheck` setting has 2 values:

- `"Imports"`: gopls diagnoses the entire import graph against `go.mod` (lightweight but prone to false positives)
- `"Off"`: Disabled

Additionally, `gopls.ui.codelenses.run_govulncheck: true` adds a "Run govulncheck" code lens on `go.mod`, letting you run the full analysis on demand. It can also be toggled via the **`Go: Toggle Vulncheck`** command palette entry.

```jsonc
"go.diagnostic.vulncheck": "Imports",
"gopls": {
  "ui.codelenses": {
    "run_govulncheck": true
  }
}
```

## Limitations and pitfalls

- **Calls made via `reflect` are outside the scope of analysis** (potential false negatives)
- Calls via function pointers / interfaces are analyzed conservatively (potential false positives)
- **GOPATH mode is not supported** — Go modules are required
- Binary mode has lower precision and tends to enumerate all dependencies
- Even if a direct dependency has a CVE, if there's no call stack it's treated as Informational (does not cause non-zero exit in text mode)
- There is **no official feature** to "silence" individual findings
- Only **known module paths** are sent in requests to the DB; code is never sent ([privacy](https://vuln.go.dev/privacy.html))

## Recent changes

- **v1.1.1 (2024-05)**: SARIF output `-format=sarif`
- **v1.1.2 (2024-06)**: OpenVEX output `-format=openvex`
- **v1.1.3 (2024-07)**: Support for standard-library vulnerability checks on binaries built with Go < 1.18
- **v1.1.4 (2025-01)**: Up to 15% speedup on large programs, added SBOM message to JSON
- **v1.2.0 / v1.3.0 (2026-04)**: Raised the Go directive to 1.25, mostly dependency updates (no GitHub Release notes created)

## Common AI agent mistakes

1. **Expecting failure with `-format=json`** — JSON / SARIF / OpenVEX all exit 0 even when vulnerabilities exist. If you need CI to always fail, use text mode or judge via `jq`
2. **Using `-mode=binary` with SARIF output** — no source line numbers, which breaks Code Scanning display. SARIF requires `-mode=source`
3. **Confusing it with a `go.sum` CVE list** — govulncheck reports as Affected only what is actually reachable. Don't mistakenly assume everything in the Informational section "must be fixed"
4. **Looking for a silence feature** — none exists officially. If you want to avoid a false positive, leave a comment explaining the rationale (e.g. reachable only via `reflect`) and discuss it in the PR
5. **Running in GOPATH mode** — exits with an error. Run in Module mode
6. **Over-trusting the maintenance status of `golang/govulncheck-action`** — it's the official Action, but update frequency is low. Manual setup (`go install` + direct execution) is more reliable in practice

## References

- [Go vulnerability management](https://go.dev/security/vuln/)
- [govulncheck CLI reference](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck)
- [Tutorial](https://go.dev/doc/tutorial/govulncheck)
- [Editor integration](https://go.dev/doc/security/vuln/editor)
- [govulncheck-action](https://github.com/golang/govulncheck-action)
- [vuln.go.dev](https://vuln.go.dev/)
