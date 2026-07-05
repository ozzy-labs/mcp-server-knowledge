---
reviewed: 2026-06-28
tags: [security, go]
---

# Trivy

A comprehensive security scanner from Aqua Security. Detects vulnerabilities (CVEs), secrets, misconfigurations, and license issues in container images, filesystems, IaC, and Kubernetes manifests. A single Go binary.

Official: [trivy.dev](https://trivy.dev/)

## Installation

```bash
# mise
mise use trivy@0.71

# Homebrew
brew install trivy

# Script
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Docker
docker run --rm -v "$PWD":/workdir aquasec/trivy:latest fs /workdir
```

## Scanners

Trivy runs by switching between multiple detectors:

| Scanner | Detects |
|---|---|
| `vuln` | CVEs (OS packages, language lockfiles: npm, pnpm, Gemfile, go.sum, pylock.toml, etc.) |
| `secret` | Pattern-based detection of API keys, tokens, private keys |
| `misconfig` | Misconfigurations in Dockerfile / Kubernetes / Terraform / CloudFormation |
| `license` | Licenses of used libraries |

## Main subcommands

| Subcommand | Target | Example |
|---|---|---|
| `trivy fs` | Filesystem | `trivy fs .` |
| `trivy image` | Container image | `trivy image alpine:3.19` |
| `trivy repo` | Git repository (URL) | `trivy repo https://github.com/org/repo` |
| `trivy config` | IaC configuration files | `trivy config .` |
| `trivy k8s` | K8s cluster | `trivy k8s cluster` |
| `trivy sbom` | SBOM (CycloneDX, SPDX) | `trivy sbom bom.json` |

## Basic usage

```bash
# Entire filesystem
trivy fs --scanners vuln,secret --exit-code 1 --no-progress .

# Specific directory
trivy fs --scanners vuln packages/web

# Image (with authentication)
trivy image --username $REG_USER --password $REG_PASS ghcr.io/org/app:latest
```

### Key flags

| Flag | Purpose |
|---|---|
| `--scanners <list>` | Scanners to enable (`vuln,secret,misconfig,license`) |
| `--severity <levels>` | Severity levels to output (`CRITICAL,HIGH`) |
| `--exit-code 1` | Non-zero exit on detection (fail in CI) |
| `--ignore-unfixed` | Ignore CVEs without a fixed release |
| `--skip-dirs <pattern>` | Exclude directories |
| `--format json` / `--format sarif` | Machine-readable output |
| `--output <file>` | Write to a file |
| `--cache-dir <path>` | Cache directory |

## Configuration file `trivy.yaml`

```yaml
scan:
  scanners:
    - vuln
    - secret
  skip-dirs:
    - node_modules
    - .pnpm-store
    - .venv

severity:
  - CRITICAL
  - HIGH

vulnerability:
  ignore-unfixed: true
```

Place it at the project root and it is applied automatically when running `trivy fs .`.

## `.trivyignore`

Ignore individual CVE IDs:

```text
# format: <CVE-ID> <optional expiration: YYYY-MM-DD>
CVE-2023-12345
CVE-2024-11111 2026-06-30 comment about why
```

Using an expiration for ignores is recommended (prevents indefinite neglect).

## Secret detection

Built-in patterns detect dozens of API key, token, and private key types:

- AWS / GCP / Azure access keys
- GitHub / GitLab PATs
- API keys for Slack / Stripe / SendGrid, etc.
- RSA / PGP private keys

### Custom patterns

```yaml
# trivy-secret.yaml
rules:
  - id: my-api-key
    severity: CRITICAL
    description: "My org API key"
    regex: 'MYAPI_[A-Z0-9]{32}'
```

```bash
trivy fs --secret-config trivy-secret.yaml .
```

## Usage in CI

### GitHub Actions

```yaml
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: fs
    scanners: vuln,secret
    severity: CRITICAL,HIGH
    exit-code: 1
    ignore-unfixed: true
```

### lefthook pre-commit

```yaml
pre-commit:
  commands:
    trivy:
      run: trivy fs --scanners vuln,secret --exit-code 1 --no-progress .
```

## Database updates

Trivy fetches the vulnerability DB as an OCI artifact:

```bash
trivy fs --db-repository ghcr.io/aquasecurity/trivy-db .
```

By default it uses a local cache with a 6-hour TTL. In CI, persisting `--cache-dir` shortens scan time.

## Output formats

```bash
# Console (default)
trivy fs .

# JSON
trivy fs --format json --output report.json .

# SARIF (for GitHub Security tab integration)
trivy fs --format sarif --output trivy.sarif .

# CycloneDX SBOM
trivy fs --format cyclonedx --output bom.json .
```

In GitHub Actions, uploading SARIF to `github/codeql-action/upload-sarif@v3` displays results in the Security tab.

## Troubleshooting

### DB update is slow

Only the first run downloads tens of MB. CI caching is essential.

### False positives

If a known CVE doesn't actually affect you, add it to `.trivyignore` with an expiration.

### Filtering with `--severity` only shows CRITICAL

`--severity` is an OR condition. Use a comma-separated list like `CRITICAL,HIGH` (no spaces).

### Secret detection flags test fixtures

Exclude with `--skip-files` or `--skip-dirs`. `.trivyignore` is CVE-only and cannot be used for secrets.

### Permission error when scanning container images

When using it via `docker run`, access to the Docker daemon socket is required.

## Comparison with other tools

| Aspect | Trivy | Snyk | Grype | Dependabot |
|---|---|---|---|---|
| OSS | Fully OSS | Commercial + free tier | OSS | Free (GitHub) |
| Scan targets | fs / image / IaC / K8s | fs / image / IaC | Image-focused | Dependency files |
| Secret detection | Yes | Separate feature | No | No |
| License | Yes | Yes | No | No |
| SBOM | Generate and read | Yes | Read | No |

Trivy is a single binary with broad coverage, making it the first choice for OSS operations.
