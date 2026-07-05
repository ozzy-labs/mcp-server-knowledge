---
reviewed: 2026-06-28
tags: [package, commercial, cloud-hosted]
---

# Renovate

A bot that automatically keeps dependencies up to date. It opens PRs proposing updates and can auto-merge once CI passes. Offers more configuration flexibility and broader ecosystem support than Dependabot. Developed and operated by Mend.

Official: [docs.renovatebot.com](https://docs.renovatebot.com/)

## Setup

### GitHub

1. Install the [Renovate GitHub App](https://github.com/apps/renovate)
2. Enable it on the target repository
3. On first run, a "Configure Renovate" onboarding PR is created. Merging it starts operation
4. Place a `renovate.json` in the repository to adjust settings

### Self-hosted

```bash
# Run periodically via GitHub Actions
pnpm dlx renovate

# Docker
docker run --rm -e RENOVATE_TOKEN=xxx renovate/renovate
```

CLI / CI execution modes are also available, but the GitHub App mode is the easiest.

## Configuration file `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"]
}
```

The minimal configuration is a single line. `config:recommended` provides practical defaults.

### Sharing across an organization

```json
{ "extends": ["github>your-org/.github"] }
```

Placing `default.json` in the `.github` repository lets you share common settings across all repositories in the organization.

## Key fields

| Field | Description |
|---|---|
| `extends` | Preset inheritance (`config:recommended`, `:semanticCommits`, etc.) |
| `schedule` | Execution time window (`["every weekend"]`, `["before 6am"]`) |
| `timezone` | `"Asia/Tokyo"` |
| `labels` | GitHub labels to attach to PRs |
| `reviewers` / `assignees` | PR owners |
| `prConcurrentLimit` | Max number of concurrently open PRs |
| `prHourlyLimit` | Max PRs created per hour |
| `rangeStrategy` | `pin` / `bump` / `replace` / `update-lockfile` |
| `packageRules` | Fine-grained per-package settings |
| `automerge` | Auto-merge when conditions match |
| `dependencyDashboard` | Issue-based dashboard |

## `packageRules` example

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "groupName": "dev dependencies",
      "schedule": ["before 6am on monday"]
    },
    {
      "matchPackageNames": ["/^@types\\//"],
      "groupName": "type definitions",
      "automerge": true
    },
    {
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

Typical patterns:

- **Auto-merge patch / minor** (especially dev dependencies and type definitions)
- **Manual approval for major** (potential breaking changes)
- **Stay conservative even for minor on 0.x versions** (room for breaking changes)
- **Grouping**: bundle related packages into a single PR

## Supported ecosystems

Major ones (excerpt):

| Ecosystem | Supported files |
|---|---|
| npm / pnpm / yarn | `package.json`, lock files |
| Go modules | `go.mod` |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile` |
| Rust | `Cargo.toml` |
| Docker | `Dockerfile`, `docker-compose.yml` |
| GitHub Actions | `.github/workflows/*.yaml` |
| pre-commit | `.pre-commit-config.yaml` |
| mise / asdf | `.mise.toml`, `.tool-versions` |
| Terraform | `*.tf` |
| Kubernetes | `*.yaml` (image references) |

Supports 100+ managers. See the official [managers](https://docs.renovatebot.com/modules/manager/) docs for details.

## Designing auto-merge conditions

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr",
      "platformAutomerge": true
    }
  ]
}
```

- `automerge: true`: enables auto-merge
- `platformAutomerge: true`: use GitHub's native auto-merge feature (merges after CI completes)
- `automergeType`: `pr` / `branch` / `merge-commit`

**Required condition**: branch protection must have "Required status checks" configured. Auto-merge won't happen unless CI passes.

## Common presets

| Preset | Content |
|---|---|
| `config:recommended` | A practical set of defaults |
| `config:base` | Old recommendation (minimal, deprecated) |
| `:semanticCommits` | Format commit messages as Conventional Commits |
| `:timezone(Asia/Tokyo)` | Timezone setting |
| `group:monorepos` | Group packages from the same monorepo |
| `group:recommended` | Recommended grouping set |
| `schedule:weekly` | Run once a week |

## Dependency Dashboard

Enabling `dependencyDashboard: true` creates a single Issue in the repository listing pending, failed, and awaiting updates.

```markdown
## Pending Approval
- [ ] [react 18 -> 19](../pull/123)  # awaiting approval since it's major

## Ignored or Blocked
- [ ] [typescript] Failed to update due to lockfile conflict

## Detected dependencies
<!-- List of all detected dependencies -->
```

Checking the checkboxes lets you send instructions to Renovate (re-run, change priority, etc.).

## Prioritizing security updates

`vulnerabilityAlerts.enabled: true` links with GitHub Security Advisories. When a matching CVE appears, Renovate creates a PR ahead of other updates.

```json
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "automerge": true
  }
}
```

## Troubleshooting

### Too many PRs coming in

- Limit concurrency with `prConcurrentLimit: 5`
- Limit to 2 per hour with `prHourlyLimit: 2`
- Concentrate runs at night/weekends with `schedule`
- Bundle with `groupName` in `packageRules`

### Lockfile update isn't included

Set `rangeStrategy: "update-lockfile"`. For pnpm, `postUpdateOptions: ["pnpmDedupe"]` also resolves duplicates.

### The same package gets updated multiple times in a monorepo

Add the `group:monorepos` preset, or manually group with `packageRules.matchPackageNames` + `groupName`. If a `matchPackageNames` value is wrapped in `/`, it's interpreted as a regular expression (e.g., `"/^@types\\//"` matches dependencies starting with `@types/`).

### Auto-merge isn't working

1. Check the branch protection status check requirements
2. Check whether `platformAutomerge` is enabled
3. Check whether the PR author (`renovate[bot]`) has write permission
4. PRs with conflicts cannot be auto-merged

### Stopping unwanted updates

```json
{
  "packageRules": [
    { "matchPackageNames": ["eslint"], "enabled": false }
  ]
}
```

## Comparison with other tools

| Aspect | Renovate | Dependabot | RenovateCE (self-host) |
|---|---|---|---|
| Supported ecosystems | 100+ | ~30 | 100+ |
| Configuration flexibility | High | Medium | High |
| Auto-merge | Yes | Yes (GitHub) | Yes |
| Grouping | Free-form | Limited | Free-form |
| Operating cost | GitHub App (free) | Free (native GitHub) | Self-hosted |
| PR dashboard | Yes | No | Yes |

Renovate is the de facto standard for both OSS and SaaS projects. Dependabot is native to GitHub but falls short in configuration flexibility.
