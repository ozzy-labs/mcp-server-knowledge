---
reviewed: 2026-05-04
tags: [methodology, github, git-hook]
---

# GitHub Flow

A simple Git workflow proposed by GitHub. Keep `main` always deployable, and do new work on short-lived feature branches. Lighter weight than Git Flow, and well suited to continuous delivery.

## Core Principles

1. **`main` is always deployable**
2. **New work happens on a branch** (direct push to `main` is prohibited)
3. **Branches are short-lived** (merge within days to a week)
4. **Review and discuss via PR** (this is where CI and peer review happen)
5. **Deploy immediately after merge** (automated if possible)

## Workflow

```text
main
 │
 ├─ feat/add-search         ← create branch
 │   │ commit commit commit
 │   └─→ PR open → review → approve → squash merge → delete feat/add-search
 │
 ├─ fix/login-regression
 │   │ commit
 │   └─→ PR open → review → squash merge → delete fix/login-regression
 │
 └─ main (deploy)
```

## Branch Naming

- Format: `<type>/<short-description>`
- Align type with Conventional Commits: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
- Description should be in English, kebab-case, and concise

```text
feat/add-blog-pagination
fix/nav-overflow-on-mobile
docs/update-mcp-setup
chore/bump-zod-3-25
```

## Merge Strategy

### Prefer squash merge

- Compresses the multiple commits in a PR into one when merging into `main`
- Keeps history linear, making `git log main` easy to read
- A revert only needs a single commit
- If the PR title follows the Conventional Commits format, `main`'s commit log also stays convention-compliant

### Avoid rebase merge

- Force-push tends to happen mid-review, hurting the review UX
- Risk of rewriting history on a shared branch

### Avoid merge commits

- Leaves many merge commits in history, making `git log` harder to read
- Makes bisect more difficult

## PR Lifecycle

1. **Create branch**: `git switch -c feat/xxx`
2. **Commit**: Conventional Commits format
3. **Push**: `git push -u origin <branch>`
4. **Open PR**: title in `<type>[scope]: <description>` format
5. **CI passes + review**: at least 1 approval (project-dependent)
6. **Squash merge**: via GitHub UI or `gh pr merge --squash --delete-branch`
7. **Delete branch**: on GitHub and locally (`git branch -d <branch>`)

## PR Title Convention

Since the PR title itself becomes the commit message after squash merge, write it in Conventional Commits format:

```text
feat(api): add pagination to /users
fix: handle empty response from upstream
docs: clarify MCP registration scope
```

## Prohibited

- **Direct push to `main`**: always go through a branch + PR
- **`--force` push**: absolutely prohibited on shared branches. Avoid as much as possible even on feature branches; use `--force-with-lease` if necessary
- **Deleting an unmerged feature branch**: risk of losing work
- **Skipping hooks with `--no-verify`**: don't bypass quality checks
- **Leaving branches unattended after merge**: a source of cognitive load and confusion

## Protection Rules (Recommended)

Apply GitHub branch protection to `main`:

- Require PR before merging
- Require approvals: 1+
- Require status checks to pass
- Require branches to be up to date
- Restrict force pushes
- Restrict deletions

## Differences from Git Flow

| Aspect | GitHub Flow | Git Flow |
|---|---|---|
| Central branches | `main` only | `main` + `develop` |
| Release branches | None | Cuts `release/*` |
| Hotfix | Regular fix branch | Cuts `hotfix/*` |
| Suitability | Continuous delivery | Strict versioned releases |
| Complexity | Low | High |

## Impact on Agent Operations

When letting AI agents work autonomously, GitHub Flow is a good fit:

- One task per branch, with a clear scope
- The PR becomes the unit of work, aligning to a reviewable granularity
- With squash merge, you don't need to worry about messy intermediate commits — you can commit frequently (traces of the agent's trial and error don't end up in `main`)
