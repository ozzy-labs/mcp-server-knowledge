---
reviewed: 2026-05-05
tags: [github, methodology]
---

# GitHub Pull Requests

A GitHub Pull Request (PR) is the unit for proposing, reviewing, and merging diffs between branches. It consolidates code review, automated checks, discussion, and merge strategy into a single UI.

Official: [GitHub Pull Requests docs](https://docs.github.com/en/pull-requests)

Related articles:

- Overall workflow: [`standards/github-flow.md`](../../standards/github-flow.md)
- Commit conventions: [`standards/conventional-commits.md`](../../standards/conventional-commits.md)
- Issue-side practices: [`platforms/github/github-issues.md`](github-issues.md)
- CLI operations: [`platforms/github/gh-cli.md`](gh-cli.md)

## Basic PR lifecycle

```text
feature branch ──push──▶ open PR ──review──▶ approve ──checks pass──▶ merge ──delete branch
                              │
                              └─ Draft (work in progress, no review requested)
```

1. Create a branch (`<type>/<short-description>`)
2. Commit (Conventional Commits)
3. Push
4. Open PR (title format `<type>[scope]: <description>`)
5. CI passes + review approved
6. **Squash merge** + delete branch

## PR title and body

The PR title becomes the commit message after a squash merge, so write it in Conventional Commits format:

```text
feat(api): add pagination to /users
fix: handle empty response from upstream
docs: clarify MCP registration scope
```

Information the body should always include:

| Section | Content |
|---|---|
| Summary | What changed and why (the WHY matters more than the WHAT of the diff) |
| Linked issue | A closing keyword such as `Fixes #123` |
| Test plan | Verification steps (manual/automated), detailed enough for reviewers to reproduce |
| Screenshots | Before/after for UI changes |
| Notes | Follow-up issues, related PRs, known limitations |

## Draft PR

When you want to push work in progress, open it as a **Draft**:

- No review request is sent
- CODEOWNERS are not auto-assigned
- Merging is disabled (merge button is inactive)
- CI still runs

```bash
gh pr create --draft --title "feat: WIP add pagination"
gh pr ready    # Draft → Ready for review
```

Switch to **Ready for review** once it's ready for review.

## Linking to issues

Writing a closing keyword in the PR body auto-closes the issue when merged into the default branch:

```text
Closes #123
Fixes your-org/other-repo#45
```

See [`github-issues.md`](github-issues.md#closing-keywords-closing-issues-from-a-pr) for details.

## Appropriate PR size

| Size guideline | Assessment |
|---|---|
| Up to ~200 lines | Easy to review, recommended |
| 200–500 lines | Upper limit; review time grows faster than linearly |
| 500+ lines | Consider splitting (check whether refactoring is mixed with feature work) |

For large PRs:

- Split unrelated refactors from feature additions into separate PRs
- Use stacked PRs (a PR based on another PR's branch) for staged review
- Split into sub-issues along implementation units

## Review actions

Three states a reviewer can set:

| State | Purpose |
|---|---|
| Comment | Feedback only; neither approves nor rejects |
| Approve | Approves the merge |
| Request changes | Requires changes; the same reviewer must re-review |

Other features:

- **Suggested changes**: writing a ` ```suggestion ` block in a comment creates a patch the author can apply with one click
- **Re-request review**: ask a reviewer to review again after fixes
- **Resolve conversation**: marks a thread as resolved. The `Require conversation resolution` protection can make this a merge requirement

## Automated checks and CI

The PR's `Checks` tab lists workflow results such as GitHub Actions runs. Registering them as **Required status checks** in branch protection blocks merging unless they're green.

- A status counts as passing if it is `success`, `skipped`, or `neutral`
- Checks are matched by exact job name (including matrix); if a matrix name changes, the required check configuration must be updated

## Merge strategies

| Method | Behavior | Recommended use |
|---|---|---|
| **Squash and merge** | Compresses all feature commits into one commit | Default recommendation; keeps history linear |
| Rebase and merge | Replays each commit onto the base (new SHAs) | Only when linear history is needed and each commit carries meaning |
| Merge commit | Creates a merge commit, preserving history | Exceptions like preserving a hotfix's history |

For detailed trade-offs see [`standards/github-flow.md`](../../standards/github-flow.md#merge-戦略).

You can restrict which merge methods are allowed in repository settings (Settings → General → Pull Requests). Allowing only Squash is the simplest option.

### Squash merge commit message

By default, GitHub uses the PR title as the commit message. Keeping PR titles Conventional-Commits-compliant means `main`'s commit log naturally follows the convention.

You can also specify it explicitly with `gh pr merge --squash --subject "..." --body "..."`.

## Auto-merge

Use Auto-merge to merge automatically once CI completes:

```bash
gh pr merge --auto --squash --delete-branch
```

Requirements:

- Auto-merge must be enabled in repository settings (Settings → General → Pull Requests → Allow auto-merge)
- Merge conditions (reviews / required checks) must not already be immediately satisfiable (if they are, it merges right away)
- Must be enabled by a user with write access

Behavior:

- Merges the instant conditions are met
- Automatically cancels if a push makes conditions unmet
- Auto-merge is disabled if an external contributor pushes to a PR from a fork (security)

## CODEOWNERS

Define path-based automatic reviewers in `.github/CODEOWNERS` (repository root or `docs/`):

```text
# .github/CODEOWNERS

# Fallback for everything
*           @your-org/maintainers

# Per-area
/src/api/   @your-org/backend
/src/web/   @your-org/frontend
*.md        @your-org/docs

# Protect CODEOWNERS itself from changes
/.github/CODEOWNERS  @your-org/maintainers
```

- Owners matching a path are automatically added as reviewers
- Enabling **Require review from Code Owners** in branch protection makes CODEOWNERS approval mandatory
- File size limit: 3 MB

## Branch Protection / Rulesets

Minimum settings to apply to `main`:

| Setting | Effect |
|---|---|
| Require a pull request before merging | Prohibits direct pushes |
| Require approvals: 1 or more | Requires review |
| Dismiss stale approvals when new commits are pushed | Requires re-approval after changes |
| Require review from Code Owners | Requires CODEOWNERS approval |
| Require status checks to pass | Requires green CI |
| Require branches to be up to date before merging | Requires the base to be up to date |
| Require conversation resolution | Prohibits merging with unresolved threads |
| Restrict force pushes | Prohibits history rewriting |
| Restrict deletions | Prohibits deleting protected branches |
| Require linear history | Prohibits merge commits (squash/rebase only) |
| Require signed commits | Requires GPG/SSH signatures |

GitHub's **Rulesets** are a superset of branch protection, supporting org-wide application and bypass configuration. Recommended for new repositories.

## Review request etiquette

- **Keep it small**: aim for under 200 lines
- **State the purpose in the body**: why the change is needed (not evident from the code alone)
- **Document verification steps**: so reviewers can reproduce them
- **Read the diff yourself first**: catch mechanical mistakes (unused imports, debug prints) in self-review
- **Use Draft for WIP**: only request review when it's ready

## Common mistakes AI agents make

1. **PR title not in Conventional Commits format** — vague titles like `Update files` break the commit log after squash merge
2. **No Test plan in the body** — reviewers lose their entry point for verification. At minimum, note which command to run to verify
3. **Mixing unrelated refactors into a feature PR** — makes the diff harder to read and inflates review time; split into a separate PR
4. **Writing `Closes #123` in a PR targeting a non-default branch** — the issue won't be auto-closed
5. **Running `gh pr merge --auto` without repository settings support** — errors out; confirm Allow auto-merge beforehand
6. **Not updating protection settings after a required status check's name changes** — the old check stays pending forever, making the PR unmergeable

## References

- [GitHub Pull Requests docs](https://docs.github.com/en/pull-requests)
- [About pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)
- [Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
