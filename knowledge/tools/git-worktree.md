---
reviewed: 2026-05-10
tags: [git, cli]
---

# git worktree

`git worktree` is a Git subcommand that lets you check out multiple working directories from a single repository at the same time. Introduced in Git 2.5. It enables parallel work without switching branches, and avoids the need for extra `stash` operations or additional clones.

Official: [git-scm.com/docs/git-worktree](https://git-scm.com/docs/git-worktree)

## When to use it

- Open a PR branch under review in a separate directory without interrupting your main work
- Apply a hotfix to a release branch while feature development is in progress
- Give each session of parallel AI agent runs (Claude Code, Codex CLI, etc.) its own independent working tree
- Reduce the cost of switching branches in projects with large build artifacts that would otherwise require a rebuild on every branch switch

## How it works

- The main working tree has a `.git/` directory as usual
- A *linked worktree* created with `git worktree add` has a **file** named `.git` (a gitfile) that points to `.git/worktrees/<name>/` in the main repository
- HEAD, the index, and the branch derived from HEAD are independent per worktree
- The object database (`.git/objects/`), refs, hooks, and config are shared with the main repository

```text
repo/                main worktree
├── .git/            actual data
│   └── worktrees/
│       ├── feat-x/
│       └── review/
└── src/

../feat-x/           linked worktree
├── .git             gitfile → repo/.git/worktrees/feat-x
└── src/
```

## Key commands

```bash
# Check out an existing branch in a separate directory
git worktree add ../review feat/login

# Create a new branch and a worktree for it
git worktree add -b feat/parser ../parser main

# Detached HEAD (when you want to view the same branch elsewhere)
git worktree add --detach ../inspect HEAD

# List
git worktree list                # human-readable
git worktree list --porcelain    # for scripts

# Remove (deletes both the working tree and .git/worktrees/<name>/)
git worktree remove ../review

# Force-remove even a dirty worktree
git worktree remove --force ../review

# Clean up after manually deleting only the directory
git worktree prune

# Move, lock, repair
git worktree move ../old ../new
git worktree lock --reason "WIP rebase" ../feat-x
git worktree unlock ../feat-x
git worktree repair                  # restore consistency between the gitfile and the admin entry
```

## Subcommand options

| Subcommand | Main options |
|---|---|
| `add` | `-b <new-branch>` / `-B <new-branch>` (force recreate) / `--detach` / `--orphan` / `--checkout` / `--no-checkout` / `--lock` / `--guess-remote` / `-f` |
| `list` | `--porcelain` / `-z` / `-v` |
| `remove` | `-f` (remove a dirty worktree) |
| `lock` | `--reason <text>` |
| `move` | `-f` (use `-f -f` to move a locked worktree) |
| `prune` | `--dry-run` / `--expire <time>` / `-v` |
| `repair` | `<path>...` (restore consistency after a move or copy) |

## Configuration

| key | effect |
|---|---|
| `worktree.guessRemote` | With `add <path> <name>`, if a remote-tracking branch with the same name as `<name>` exists, automatically branch off from it |
| `worktree.useRelativePaths` | Store the gitfile and admin entry as relative paths. Less likely to break when the whole repository is moved or copied (requires a recent Git version) |

```bash
git config --global worktree.guessRemote true
```

## Constraints

- **The same branch cannot be checked out in multiple worktrees at the same time.** You can bypass this with `-f`, but it's not recommended since commits on both sides will conflict. Open one side with `--detach` instead
- Submodules are not cloned independently per worktree (they are shared)
- `.git/hooks/` is shared across all worktrees
- On a bare repository, a worktree behaves as the equivalent of the "main working tree"

## Typical workflows

### PR review

```bash
git worktree add ../review-pr-123 origin/feat/login
cd ../review-pr-123
pnpm install && pnpm run dev
# after reviewing
cd -
git worktree remove ../review-pr-123
```

### Hotfix in a separate worktree

```bash
git worktree add -b hotfix/crash ../hotfix origin/release/2.5
cd ../hotfix
# fix, push, PR
```

### Parallel execution of AI agents

Used as a sandbox to avoid conflicts when running multiple agents (Claude Code Routines, GitHub Spec Kit workers, etc.) concurrently on separate branches.

```bash
git worktree add ../agent-a -b agent/task-a main
git worktree add ../agent-b -b agent/task-b main
# Share CLAUDE.md / AGENTS.md across each worktree; since the
# index and HEAD are independent, commit conflicts don't occur
```

## Common mistakes AI agents make

1. **Deleting a worktree with `rm -rf`** — the admin entry under `.git/worktrees/<name>/` remains even after the working directory is gone. Always use `git worktree remove`, or run `git worktree prune` after deleting it manually
2. **Trying to check out the same branch in two places and failing** — Git prohibits this. Create a different branch, or open one side with `--detach`
3. **Trusting `pwd` inside a worktree and running `git -C .`** — most commands work fine in a linked worktree, but scripts that assume `.git` is a directory (rather than a file) will break
4. **Getting the argument order wrong for `git worktree add`** — the form is `add [<options>] <path> [<commit-ish>]`. Passing a branch name in the `<path>` position will create a directory with that name
5. **Forgetting to run `repair` after moving a worktree** — moving with `mv` breaks the gitfile's absolute path. Use `git worktree move`, or run `git worktree repair` after moving
6. **Overlooking shared hook behavior** — when using multiple worktrees in parallel in a repository where hooks such as pre-commit run, be aware that tools like `gitleaks` reference the same `.git/hooks/`

## Troubleshooting

### `fatal: '<path>' already exists`

`add` cannot create a worktree if `<path>` is non-empty. Use a different path, or delete it if it's not needed.

### `fatal: '<branch>' is already checked out at '<path>'`

The branch is already checked out in another worktree. Either `remove` that worktree, or create a new branch.

### Ghost entries remain in `worktree list`

Occurs when only the directory was deleted:

```bash
git worktree prune --dry-run     # check what will be removed
git worktree prune
```

### Worktree doesn't work after being copied to a different host/path

```bash
git worktree repair
```

Or enable `git config --global worktree.useRelativePaths true` from the start.

## References

- [git-worktree - Git Documentation](https://git-scm.com/docs/git-worktree)
- [Git 2.5 Release Notes](https://github.com/git/git/blob/main/Documentation/RelNotes/2.5.0.txt)
