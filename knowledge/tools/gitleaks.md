---
reviewed: 2026-05-04
tags: [security, git-hook, go]
---

# Gitleaks

A CLI that detects secrets (API keys, tokens, private keys) accidentally committed to a Git repository. Intended for use in pre-commit or CI. A single Go binary.

Official: [github.com/gitleaks/gitleaks](https://github.com/gitleaks/gitleaks)

## Installation

```bash
# mise
mise use gitleaks@8

# Homebrew
brew install gitleaks

# Go
go install github.com/gitleaks/gitleaks/v8@latest

# Docker
docker run --rm -v "$PWD":/path zricethezav/gitleaks:latest detect --source /path
```

## Main subcommands

| Command | Purpose |
|---|---|
| `gitleaks git` | Scan a Git repository (history / staged) |
| `gitleaks dir` | Scan a non-Git directory or files |
| `gitleaks stdin` | Scan standard input |

> As of v8.19.0, `detect` / `protect` are deprecated (hidden from `--help`, but still backward compatible). For new setups, use `git` / `dir` / `stdin`.

## Basic usage

```bash
# Entire history
gitleaks git --no-banner

# Only from the current commit onward
gitleaks git --no-banner --log-opts="HEAD~10..HEAD"

# Staged files only (pre-commit)
gitleaks git --pre-commit --staged --no-banner

# Use exit code for CI judgment
gitleaks git --exit-code 1
```

### Main flags

| Flag | Meaning |
|---|---|
| `--no-banner` | Suppress logo |
| `--verbose` | Verbose output |
| `--redact` | Replace detected values with `***` to prevent log leakage |
| `--report-format <json\|csv\|sarif>` | Output format |
| `--report-path <path>` | Output to file |
| `--config <path>` | Custom config |
| `--baseline-path <path>` | Ignore known findings (report only diffs) |
| `--log-opts "<git-log-args>"` | Specify scan range using `git log` syntax |

## Built-in rules

The [default rules](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml) cover 150+ patterns:

- AWS / GCP / Azure access keys
- GitHub / GitLab PATs, App Tokens, OAuth tokens
- Major SaaS API keys such as Slack / Stripe / SendGrid / Twilio / DigitalOcean
- RSA / PGP private keys, SSH private keys
- JWTs, DB URLs with embedded passwords

## Custom config `.gitleaks.toml`

```toml
[extend]
# Inherit defaults (recommended)
useDefault = true

[[rules]]
id = "my-org-api-key"
description = "My Org internal API key"
regex = '''MYORG_[A-Z0-9]{32}'''
tags = ["key", "myorg"]

[[rules]]
id = "custom-db-url"
regex = '''postgres://[^\s]+:[^\s]+@[^\s/]+/'''
entropy = 3.5

[allowlist]
# Exclude false positives
paths = [
  '''(.*?)(jpg|gif|doc|pdf|bin|lock)$''',
  '''tests/fixtures/.*''',
]
regexes = [
  '''AKIA[0-9A-Z]{16}''',  # dummy for testing
]
commits = ["abc123def..."]  # exclude specific commits
```

## Handling detected values

**Absolutely never**:

- Paste the detected value verbatim into a GitHub Issue / PR / Slack
- Leave it in CI logs in plaintext
- Ignore it as "not important"

**Correct response**:

1. **Rotate** the key immediately (issue a new key → invalidate the old one)
2. Remove it from Git history (`git filter-repo`, BFG Repo-Cleaner)
3. Force push to update all branches
4. Notify the team (to prevent others from ending up in a lost-commit state after pulling)
5. Review why it slipped past detection and got committed

**Removing it from Git history is not sufficient by itself** (if already pushed, it may remain in mirrors or GitHub's reflog). Rotation is the top priority.

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    gitleaks:
      run: gitleaks git --pre-commit --staged --no-banner
```

`gitleaks git --pre-commit --staged` is a fast mode that only targets staged files.

## Usage in CI

### GitHub Actions

```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}  # paid for organization use
```

### Raw command

```yaml
- run: gitleaks git --no-banner --redact --report-format sarif --report-path gitleaks.sarif
- if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: gitleaks.sarif
```

## Cleaning up Git history

Rewriting history once a leak is detected:

```bash
# git filter-repo (recommended, more accurate than BFG)
pip install git-filter-repo
git filter-repo --path <leaked-file> --invert-paths

# BFG Repo-Cleaner
bfg --delete-files <leaked-file>
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# push (force push all branches)
git push --force --all
git push --force --tags
```

This is a **destructive operation**. If other collaborators have already cloned the repo, advance notice is essential.

## Suppressing false positives

In order of priority:

1. Add to `allowlist.regexes` in `.gitleaks.toml` (exclude by pattern)
2. Exclude a directory with `allowlist.paths` (e.g. `tests/fixtures/`)
3. Add an inline comment `gitleaks:allow` at the end of the relevant line (e.g. `apiKey := "AKIA0000000000000000" // gitleaks:allow`)
4. As a last resort, exclude specific commits with `allowlist.commits`

## Troubleshooting

### `gitleaks git` is slow

For large repositories, scanning the entire Git history takes time. Narrow the range with `--log-opts`:

```bash
gitleaks git --log-opts="--since='1 month ago'"
```

### CI detects a leak but it passes locally

`--pre-commit --staged` (staged only) and `gitleaks git` (full history scan) have different scopes. Leaks present in existing commit history are only caught by a full history scan.

### `gitleaks-action` throws a paid-tier error

Organization accounts require `GITLEAKS_LICENSE` (the free tier is for individuals only). This can be worked around with a self-hosted runner plus the raw command.

### Want to scan a non-Git directory

Use `gitleaks dir <path>` (no Git history involved).

## Comparison with other tools

| Aspect | Gitleaks | TruffleHog | detect-secrets | Trivy (secret) |
|---|---|---|---|---|
| Detection accuracy | High (150+ patterns) | Very high (with API verification) | Medium | Medium |
| Speed | Fast (Go) | Medium | Slow (Python) | Fast |
| History scan | Yes | Yes | Limited | Yes |
| pre-commit | Yes | Yes | Dedicated | Yes |
| License | MIT (paid for org CI) | AGPL + paid | Apache 2.0 | Apache 2.0 |

This repository uses a two-stage setup of Gitleaks + Trivy (secret). Gitleaks blocks at pre-commit, and Trivy performs the final check in CI.
