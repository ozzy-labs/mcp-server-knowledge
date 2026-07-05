---
reviewed: 2026-05-05
tags: [github, package, security]
---

# Dependabot

GitHub-native dependency-tracking tool. Just drop a `dependabot.yaml` to automate vulnerability alerts and version-update PRs. Its strengths are zero-config setup and tight GitHub integration. It's less expressive than Renovate, but is chosen for its setup simplicity.

Official: [About Dependabot](https://docs.github.com/en/code-security/dependabot)

Related articles:

- [`tools/renovate.md`](../../tools/renovate.md) (a more feature-rich alternative)
- [`platforms/github/github-actions.md`](github-actions.md) (Dependabot can also update GitHub Actions dependencies)

## Three types of Dependabot

| Name | What it does | Setup |
|---|---|---|
| **Dependabot alerts** | Detects and notifies about packages with known vulnerabilities | Enable in repository settings (free) |
| **Dependabot security updates** | Automatically creates vulnerability-fix PRs based on alerts | Same as above |
| **Dependabot version updates** | Creates regular version-tracking PRs | Requires `.github/dependabot.yaml` |

The first two need no config file (toggle ON under `Settings > Code security`). The third (version updates) is what `dependabot.yaml` scopes.

## Minimal configuration

```yaml
# .github/dependabot.yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

**Always add** the `github-actions` ecosystem. If you don't track `uses:` pins in workflows, the security posture mentioned above breaks down.

## Supported ecosystems (excerpt)

| `package-ecosystem` | Target |
|---|---|
| `npm` | npm / pnpm / yarn |
| `pip` | Python (requirements.txt, pyproject.toml) |
| `uv` | uv lock |
| `cargo` | Rust |
| `gomod` | Go |
| `gradle` / `maven` | JVM |
| `composer` | PHP |
| `bundler` | Ruby |
| `docker` | Dockerfile |
| `github-actions` | `.github/workflows/*.yaml`, composite actions |
| `terraform` | Terraform |
| `devcontainers` | dev container |
| `mix` | Elixir |
| `nuget` | .NET |
| `swift` | Swift |

## Key options

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
      timezone: Asia/Tokyo
    open-pull-requests-limit: 10        # concurrent PR count (default 5)
    target-branch: develop              # merge target (default: default branch)
    versioning-strategy: increase       # how constraints are updated
    labels: [dependencies]
    reviewers: [your-org/maintainers]
    assignees: [your-username]
    commit-message:
      prefix: chore                     # Conventional Commits prefix
      include: scope                    # include dependency name as scope
    cooldown:
      default-days: 7                   # wait 7 days after release before updating
    ignore:
      - dependency-name: react
        versions: ["19.x"]              # ignore the 19.x line
      - dependency-name: "@types/*"
        update-types: [version-update:semver-major]    # ignore major updates for type defs
    allow:
      - dependency-type: production     # production only
    groups:                             # bundle related deps into one PR
      types:
        patterns: ["@types/*"]
        update-types: [minor, patch]
      eslint:
        patterns: ["eslint", "eslint-*", "@typescript-eslint/*"]
```

## Grouping (bundling multiple deps into one PR)

The main countermeasure when PR noise is excessive. Use `groups:` to bundle logical groups into a single PR:

```yaml
groups:
  minor-and-patch:
    update-types: [minor, patch]      # major stays as individual PRs; minor/patch get bundled
  testing:
    patterns: ["vitest", "@vitest/*", "playwright*"]
```

## `cooldown` (delaying updates right after release)

Hidden regressions are more likely right after a new release. Use `cooldown` to add an N-day buffer:

```yaml
cooldown:
  default-days: 7
  semver-major-days: 14
  semver-minor-days: 7
  semver-patch-days: 3
```

## Conventional Commits integration

```yaml
commit-message:
  prefix: chore
  prefix-development: chore           # devDependencies can use a different prefix
  include: scope                      # -> "chore(deps): bump react from 19.0.0 to 19.0.1"
```

When combining with `commitlint`, configure the prefix to match a valid type ([`tools/commitlint.md`](../../tools/commitlint.md)).

## Comparison with Renovate

| Aspect | Dependabot | Renovate |
|---|---|---|
| Configuration | `dependabot.yaml` (GitHub native) | `renovate.json` (self-hosted or GitHub App) |
| Configuration expressiveness | Medium | **High** (regex manager, packageRules, presets) |
| Grouping | Yes (`groups:`) | Yes (more flexible) |
| Auto-merge | None (combine with GitHub Auto-merge) | Yes (`automerge: true`) |
| Lock file maintenance | Limited | Yes |
| Cost | Free | Free (OSS) / paid SaaS |
| Best fit | Small-to-medium, GitHub-only | Multi-ecosystem, complex strategies |

Don't run both (PRs get duplicated). Generally:

- **Simple operations / GitHub-native preference** -> Dependabot
- **Monorepo / advanced strategies / auto-merge** -> Renovate

## Combining with Auto-merge

Dependabot itself has no auto-merge feature. Achieve it with GitHub's Auto-merge + a workflow:

```yaml
# .github/workflows/dependabot-automerge.yaml
name: Dependabot auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  automerge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - id: meta
        uses: dependabot/fetch-metadata@v2
      - if: steps.meta.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Auto-merging only patch updates via `update-type` is the safe compromise.

## Common mistakes AI agents make

1. **Forgetting to add the `github-actions` ecosystem** — workflow SHA pins stay stale
2. **Setting `open-pull-requests-limit` too high, causing a PR explosion** — reviews can't keep up. Keep the default of 5, or consolidate with `groups:`
3. **Intending to ignore all majors via `ignore:` but the syntax doesn't work** — write it as a semver range like `versions: [">=19"]`
4. **Dependabot commits get rejected by commitlint** — align `commit-message.prefix` with a valid Conventional Commits type
5. **Running Renovate and Dependabot simultaneously** — two PRs get opened for the same dependency. Always disable one of them

## References

- [About Dependabot](https://docs.github.com/en/code-security/dependabot)
- [Configuration options for the dependabot.yml file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Automating Dependabot with GitHub Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
