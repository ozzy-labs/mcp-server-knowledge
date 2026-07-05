---
reviewed: 2026-05-05
tags: [github, methodology]
---

# GitHub Issues

GitHub Issues is a tracker for a repository's work items (bugs, tasks, requests, investigations). Comments, labels, milestones, and links to PRs consolidate discussion and implementation into a single thread.

Official: [GitHub Issues docs](https://docs.github.com/en/issues)

Related articles:

- Overall workflow: [`standards/github-flow.md`](../../standards/github-flow.md)
- CLI operations: [`platforms/github/gh-cli.md`](gh-cli.md)
- PR-side practices: [`platforms/github/github-pull-requests.md`](github-pull-requests.md)

## Before filing an Issue

1. **Search for duplicates**: check both open and closed with `is:issue <keyword>`
2. **Reproduction conditions**: for bugs, prepare a minimal repro
3. **Scope**: 1 Issue = 1 topic. If multiple problems are mixed together, split into sub-issues or separate Issues

## Anatomy of a good Issue

| Section | Role |
|---|---|
| Title | A searchable summary. Prefixing with `<scope>: <subject>` makes lists easier to scan |
| Overview | What's happening / what you want to achieve |
| Repro steps / expected result | Required for bugs. Separate expected from actual |
| Environment | Version, OS, browser, dependencies |
| Notes | Screenshots, logs, links to related Issues/PRs |

Titles read best as "verb + object" (`Add pagination to /users` / `Fix login redirect on Safari`).

## Label practices

Labels are the key to search, automation, and priority decisions. Keep classification minimal and avoid over-naming.

| Category | Examples |
|---|---|
| Type | `bug`, `feature`, `docs`, `chore` |
| Priority | `priority/high`, `priority/medium`, `priority/low` |
| Status | `needs-triage`, `in-progress`, `blocked`, `wontfix` |
| Area | `area/api`, `area/frontend`, `area/ci` |

Namespacing with `/` makes grouping in lists easier. Align colors within the same namespace.

## Milestones, assignees, and types

- **Milestone**: for grouping by release or sprint. Adding a due date visualizes progress as a bar
- **Assignee**: assign one primary owner (multiple assignees dilute responsibility)
- **Type** (an Organization feature): cross-repo classification as `Bug` / `Feature` / `Task`, aggregatable across repositories

## Sub-issues

GitHub's **Sub-issues** let you build a parent Issue → child Issue tree structure (an evolution of the old `- [ ]` task list). Give the parent the overall scope and the children implementation units, and progress is aggregated automatically.

```text
#100  RFC: Auth refactor                ← Parent
 ├─ #101 Implement token rotation
 ├─ #102 Migrate session storage
 └─ #103 Update docs
```

## Issue Template / Issue Forms

Placed under `.github/ISSUE_TEMPLATE/`. Two formats: Markdown templates (`*.md`) and Forms (`*.yaml`). Forms support structured input, enforcing required fields and dropdown selections.

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yaml
name: Bug report
description: Report a defect
labels: [bug, needs-triage]
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What happened?
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      render: bash
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version
      placeholder: e.g. 1.4.2
    validations:
      required: true
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options: [low, medium, high, critical]
```

`config.yaml` lets you disable blank issues or point users to external links (Discussions, support channels):

```yaml
# .github/ISSUE_TEMPLATE/config.yaml
blank_issues_enabled: false
contact_links:
  - name: Question
    url: https://github.com/your-org/your-repo/discussions
    about: For questions, use Discussions
```

## Closing keywords (closing Issues from a PR)

Writing the following keywords in a PR body or commit message auto-closes the target Issue once the PR is merged into the default branch:

```text
close / closes / closed
fix / fixes / fixed
resolve / resolves / resolved
```

```text
Fixes #123
Closes your-org/other-repo#45
Fixes #100, fixes #101
```

Notes:

- **Only works for PRs merged into the default branch** (merging into `develop` etc. won't close it)
- To close multiple Issues, attach a keyword to each one (`Fixes #1, #2` only closes `#1`)
- For cross-repo, use the `OWNER/REPO#N` format

## Close reasons

When closing an Issue you can choose **Completed** / **Not planned** / **Duplicate**.

- **Completed**: resolved
- **Not planned**: a decision was made not to address it (out of spec / out of scope)
- **Duplicate**: tracked in another Issue (note the duplicate's URL in the body)

Since you can filter search with `reason:not-planned`, always pick the appropriate reason.

## Triage practice

Work through `is:issue is:open label:needs-triage` daily or weekly:

1. Apply labels (type, priority, area)
2. Assign (assignee) or hold (`needs-info`)
3. Add to a milestone
4. Close duplicates with `Duplicate`

## Common mistakes AI agents make

1. **Not writing repro steps in the Issue body** — a bug-fix Issue stalls the moment it can't be reproduced. Always attach a minimal repro
2. **Trying to close multiple Issues with one keyword like `Fixes #1, #2`** — this doesn't work. Write `Fixes #1` and `Fixes #2` separately for each Issue
3. **Writing a closing keyword in a PR targeting a non-default branch** — it won't auto-close
4. **Taking a huge Issue straight into implementation** — break it into sub-issues to keep a 1:1 correspondence with PRs
5. **Closing with "won't fix" written only in the body instead of selecting `Not planned`** — search filters won't catch it

## References

- [GitHub Issues docs](https://docs.github.com/en/issues)
- [Issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
