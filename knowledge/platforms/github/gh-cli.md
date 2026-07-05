---
reviewed: 2026-06-28
tags: [github, go]
aliases: [gh]
---

# gh (GitHub CLI)

GitHub's official CLI. Lets you perform operations normally done in the browser UI — PRs, Issues, Actions, Releases, Secrets, etc. — from the terminal. A foundational tool for AI-agent operations (Claude Code / Codex CLI also rely on it heavily for Git/GitHub operations).

Official: [cli.github.com](https://cli.github.com/) / [docs.github.com/cli](https://cli.github.com/manual/)

## Installation

Supports many package managers. See `standards/software-distribution.md` for recommended methods per OS.

```bash
# Homebrew
brew install gh

# apt
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# WinGet
winget install --id GitHub.cli

# mise (via aqua)
mise use aqua:cli/cli@latest
```

## Authentication

```bash
# Interactive (browser OAuth)
gh auth login

# Non-interactive (Personal Access Token)
echo "ghp_xxx" | gh auth login --with-token

# GitHub Enterprise Server
gh auth login --hostname ghes.example.com

# Check status
gh auth status

# Switch accounts
gh auth switch
```

Authentication is also possible via environment variables:

- `GH_TOKEN` / `GITHUB_TOKEN` — precedence order is `GH_TOKEN` > `GITHUB_TOKEN`
- `GH_HOST` — default host (for GHES)
- `GH_ENTERPRISE_TOKEN` — token for GHES

In CI, `GITHUB_TOKEN` is set automatically, so it works with almost no extra configuration (pass `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` via env).

## Key subcommands

| Command | Purpose |
|---|---|
| `gh auth` | Authentication |
| `gh repo` | Repository operations (create / clone / fork / view) |
| `gh issue` | Issues |
| `gh pr` | Pull Requests |
| `gh run` | Actions workflow runs |
| `gh workflow` | Actions workflow management |
| `gh release` | Releases |
| `gh gist` | Gists |
| `gh secret` | Actions secrets |
| `gh variable` | Actions variables |
| `gh label` | Labels |
| `gh project` | GitHub Projects |
| `gh api` | Arbitrary REST / GraphQL API calls |
| `gh search` | Cross-repo search |
| `gh copilot` | Copilot in CLI (built into the core binary) |
| `gh skill` | Discover, install, and publish Agent Skills (Public Preview) |
| `gh agent-task` | Copilot coding agent task operations |

## PR operations (most frequently used)

```bash
# Create
gh pr create --title "feat: add foo" --body "..."
gh pr create --fill                      # auto-fill from commit messages
gh pr create --web                       # edit in browser

# List
gh pr list
gh pr list --state open --author @me
gh pr list --label bug

# View details
gh pr view 123
gh pr view 123 --comments
gh pr view 123 --json state,title,files  # machine-readable

# Diff
gh pr diff 123

# Merge
gh pr merge 123 --squash --delete-branch
gh pr merge --auto --squash              # auto-merge once requirements are met

# Review / approve
gh pr review 123 --approve
gh pr review 123 --request-changes --body "..."

# Checkout
gh pr checkout 123

# Comment
gh pr comment 123 --body "..."

# Close / reopen
gh pr close 123
gh pr reopen 123
```

### Commonly used flags

| Flag | Meaning |
|---|---|
| `--json <fields>` | JSON output (essential to combine with `jq`) |
| `--template <tpl>` | Format output with a Go template |
| `--web` | Open in browser |
| `-R owner/repo` | Target a different repository |

## Issue operations

```bash
gh issue create --title "bug: ..." --body "..." --label bug
gh issue list --state open --assignee @me
gh issue view 456
gh issue close 456 --reason "not planned"
gh issue comment 456 --body "..."
gh issue develop 456 --branch fix/456    # create a branch from an Issue
```

## Actions

```bash
# List workflows
gh workflow list

# Manual run (for workflow_dispatch-enabled workflows)
gh workflow run ci.yaml
gh workflow run deploy.yaml -f environment=staging

# Run history
gh run list
gh run list --workflow ci.yaml --branch main
gh run view 123456 --log                 # show logs
gh run view 123456 --log-failed          # logs for failed steps only

# Rerun
gh run rerun 123456
gh run rerun 123456 --failed             # failed jobs only
```

## Release

```bash
# Create
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file CHANGELOG.md \
  dist/*.tar.gz                          # attach assets

# List
gh release list

# Download
gh release download v1.0.0 --pattern "*.tar.gz"

# Draft
gh release create v1.1.0 --draft
gh release edit v1.1.0 --draft=false
```

## Secrets / Variables

```bash
# Set
gh secret set NPM_TOKEN              # enter value interactively
gh secret set NPM_TOKEN --body "xxx"
echo "xxx" | gh secret set NPM_TOKEN

# Per environment
gh secret set DEPLOY_KEY --env production

# Variables (non-sensitive)
gh variable set LOG_LEVEL --body "info"

# List
gh secret list
gh variable list
```

**For `gh secret set`, prefer stdin over `--body` so the value doesn't stay in local shell history.**

## Arbitrary API calls

```bash
# REST
gh api repos/org/repo/pulls/123/comments

# GraphQL
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 10, states: OPEN) {
        nodes { number title }
      }
    }
  }
' -F owner=your-org -F repo=your-repo

# Pagination
gh api --paginate repos/org/repo/issues

# Specify method
gh api -X POST repos/org/repo/issues -f title="..." -f body="..."
```

`gh api` handles authentication, host, pagination, and error handling automatically, making it far more convenient than calling `curl` directly.

## JSON output and jq

```bash
# Direct field selection
gh pr list --json number,title,author --jq '.[] | "\(.number) \(.title)"'

# Format with jq
gh pr list --json number,title | jq -r '.[] | "#\(.number) \(.title)"'

# Filter by condition
gh pr list --json number,title,labels \
  | jq '.[] | select(.labels | map(.name) | contains(["bug"]))'
```

`gh` has a built-in `--jq` filter, so simple extraction doesn't require invoking a separate `jq` command.

## Aliases

```bash
# Personal PR shortcuts
gh alias set prs 'pr list --author @me'
gh alias set prv 'pr view --web'

# Shell expansion is also supported
gh alias set bugs 'issue list --label "bug"'

# More complex ones via shell
gh alias set --shell pr-stats 'gh pr list --json state | jq "group_by(.state) | map({state: .[0].state, count: length})"'

gh alias list
```

## Usage in CI

```yaml
# Using gh directly inside GitHub Actions
- run: gh pr comment ${{ github.event.pull_request.number }} --body "Build passed"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_TOKEN` is available automatically (gh comes preinstalled on Actions runners).

## Extensions

External extensions can be added via `gh extension`:

```bash
gh extension install dlvhdr/gh-dash    # PR/Issue dashboard TUI
gh extension list
gh extension upgrade --all
```

Note that Copilot in CLI (formerly the `github/gh-copilot` extension) is now integrated into the core binary as `gh copilot`. `gh skill`, for managing Agent Skills, and `gh agent-task`, for Copilot coding agent operations, are also built in (Public Preview) and can be used directly in AI-agent operations.

See [`gh-extensions.md`](gh-extensions.md) for details.

## Integration with Claude Code / MCP

Many agents, including Claude Code, are designed to perform GitHub operations via `gh`. Reasons:

- gh handles authentication and rate limiting
- Fewer misconfigurations than calling the API directly
- `--json` provides machine-readable output

PR creation, review, and merging in particular are most stable via gh.

## Troubleshooting

### `GH_TOKEN` and `GITHUB_TOKEN` mixed, causing unexpected behavior

`GH_TOKEN` takes precedence. Set only one, or check the active token with `gh auth status`.

### `gh api` returns 403

- Insufficient token scope (e.g. `repo` / `write:packages`)
- PR check requirements not met (for merge operations)
- `GH_HOST` not set on GHES

### CI shows `resource not accessible by integration`

Insufficient `permissions:`. At the top of the workflow:

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

### Mixed HTTPS vs SSH authentication

Choosing HTTPS in `gh auth login` makes `git push` also go over HTTPS via `GH_TOKEN`. If you don't want to disrupt an existing SSH key setup, choose `gh auth login --git-protocol ssh`.

## Comparison with other tools

| Aspect | gh | hub | curl + API |
|---|---|---|---|
| Maintenance | Official GitHub, active | Deprecated (hub was consolidated into its successor, gh) | — |
| Auth | Interactive + env + SSH integration | Token-based | Manual |
| GraphQL | Supported | None | Manual |
| Actions operations | Yes | None | Manual |
| Pagination | `--paginate` | Manual | Manual |
| JSON output | `--json` + `--jq` | None | Manual |

gh is the clear choice. hub has been deprecated since 2020 and is no longer maintained.
