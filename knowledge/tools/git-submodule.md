---
reviewed: 2026-05-05
tags: [git, cli]
---

# git submodule

`git submodule` is a subcommand for including another Git repository at a specific pinned commit. The superproject records only "which commit the submodule points to"; the dependency repository's actual content is managed separately.

Official: [git-scm.com/docs/git-submodule](https://git-scm.com/docs/git-submodule)

## When to use it and when not to

Good fit:

- Vendoring source for a C/C++ library
- Shared code touched by multiple teams that don't want to go monorepo
- A dependency you want pinned to a specific commit for reproducibility

Not a good fit (consider alternatives):

- Dependencies available via a package manager (npm, pnpm, pip, go modules, cargo, etc.) → use normal package management
- Cases where you just want to "always pull in the latest" → use subtree merge or a package instead
- Binaries or documentation assets → use Git LFS or separate distribution

## How it works

- The superproject's `.gitmodules` (tracked) records `path` and `url`
- `.git/config`'s `submodule.<name>.url` holds the actual clone source URL
- The submodule's own `.git` is consolidated under `.git/modules/<name>/`; the `.git` inside the submodule directory is a gitfile (text) pointing there
- The superproject's commit records "which submodule points to which SHA" as a gitlink

```text
super/
├── .gitmodules                   tracked
├── .git/
│   ├── config                    submodule.<name>.url
│   └── modules/
│       └── lib-foo/              actual .git contents
└── lib-foo/
    └── .git                      gitfile → super/.git/modules/lib-foo
```

## Key commands

```bash
# Fetch submodules too at clone time
git clone --recurse-submodules <url>

# Fetch submodules afterward in an existing clone
git submodule update --init --recursive

# Add a submodule
git submodule add <repo-url> <path>
git submodule add -b main <repo-url> libs/foo

# Sync each submodule to its recorded SHA
git submodule update --recursive

# Pull in the latest of the tracked branch
git submodule update --remote --recursive

# Run a command per submodule
git submodule foreach 'git fetch --tags'

# Check status
git submodule status --recursive

# Apply URL change (after editing .gitmodules)
git submodule sync --recursive

# Disable just one (remove from working tree)
git submodule deinit -f libs/foo

# Full removal (see below)
```

## Subcommand reference

| Subcommand | Purpose | Main options |
|---|---|---|
| `add` | Add a submodule | `-b <branch>` / `--name <name>` / `--depth <n>` / `--force` |
| `init` | Register from `.gitmodules` into `.git/config` | (no major options) |
| `deinit` | Unregister a submodule (removes working tree) | `-f` / `--all` |
| `update` | Sync to the recorded SHA or tracked branch | `--init` / `--remote` / `--recursive` / `--checkout`/`--rebase`/`--merge` / `--depth` / `-j <n>` |
| `status` | Show status | `--cached` (recorded SHA) / `--recursive` |
| `sync` | Apply URL from `.gitmodules` to `.git/config` | `--recursive` |
| `foreach` | Run a command in each submodule | `--recursive` |
| `set-branch` | Set the tracked branch | `-b <branch>` / `-d` (reset to default) |
| `set-url` | Change the URL | `<path> <newurl>` |
| `summary` | Summarize changes vs. the superproject | `--cached` / `--files` |
| `absorbgitdirs` | Move a submodule's `.git` into `.git/modules/` | (no major options) |

## Configuration

### `.gitmodules` (committed)

```ini
[submodule "libs/foo"]
    path = libs/foo
    url = https://github.com/example/foo.git
    branch = main
    shallow = true
    fetchRecurseSubmodules = on-demand
    ignore = dirty
```

### `.git/config` (local only)

| key | effect |
|---|---|
| `submodule.<name>.url` | The actual URL (used to switch between HTTPS/SSH) |
| `submodule.<name>.branch` | Branch followed by `update --remote` |
| `submodule.<name>.update` | `checkout` (default) / `rebase` / `merge` / `!cmd` |
| `submodule.<name>.shallow` | Use a shallow clone |
| `submodule.<name>.ignore` | `none` / `untracked` / `dirty` / `all`. Affects handling in `status` / `diff` |
| `submodule.recurse` | When `true`, `pull` / `checkout` / `push` etc. auto-recurse |
| `submodule.fetchJobs` | Parallelism for `update` (default 1) |
| `submodule.active` | Glob for determining active status (`pathspec` format) |

```bash
# Make pull / checkout automatically follow into submodules
git config --global submodule.recurse true

# Speed up parallel clones
git config --global submodule.fetchJobs 8
```

## Typical workflows

### Add and commit

```bash
git submodule add https://github.com/example/foo.git libs/foo
git commit -m "Add foo submodule"
# .gitmodules and the libs/foo gitlink get committed
```

### Set up an existing clone including submodules

```bash
git clone <super-url>
cd <super>
git submodule update --init --recursive --jobs 8
```

### Update a submodule to its latest branch and reflect it in the superproject

```bash
git submodule update --remote --recursive
git add libs/foo
git commit -m "Bump foo to latest main"
```

### Developing inside a submodule

```bash
cd libs/foo
git checkout main          # escape detached HEAD
# edit, commit, push
cd -
git add libs/foo
git commit -m "Update foo pointer"
```

### Switching the URL to SSH

```bash
# after editing .gitmodules
git submodule sync --recursive
```

### Full removal

```bash
git submodule deinit -f libs/foo
git rm libs/foo                       # .gitmodules is also updated automatically
rm -rf .git/modules/libs/foo
git commit -m "Remove foo submodule"
```

## Common mistakes AI agents make

1. **Stopping at `git clone`** — submodules remain empty. Add `--recurse-submodules`, or later run `git submodule update --init --recursive`
2. **Committing inside the submodule but not committing in the superproject** — the gitlink doesn't get updated, so other clones fall back to the old SHA. Don't forget `git add <path> && git commit` after pushing the submodule
3. **Losing commits by editing while in detached HEAD** — after `update`, you're in detached HEAD by default. `checkout` a branch before editing
4. **Assuming `git pull` automatically advances submodules** — it doesn't by default. Set `submodule.recurse=true` or explicitly call `git submodule update --recursive`
5. **Deleting with `rm -rf libs/foo`** — leaves remnants in `.gitmodules` / `.git/config` / `.git/modules/`. The correct order is `deinit` → `git rm` → delete `.git/modules/<path>`
6. **Forgetting `--recursive` in CI** — nested submodules aren't fetched and the build fails. For GitHub Actions, specify `submodules: recursive` in `actions/checkout`
7. **Changing the URL only in `.gitmodules`** — in already-cloned environments the URL in `.git/config` doesn't change. Run `git submodule sync`

## Troubleshooting

### `fatal: No url found for submodule path '<path>' in .gitmodules`

`.gitmodules` isn't committed, or the entry is missing. Either redo `git submodule add` in the superproject, or fix up `.gitmodules` and run `git submodule sync && git submodule update --init`.

### Submodule stays in detached HEAD

```bash
cd libs/foo
git checkout main
```

Alternatively, set `submodule.<name>.update = rebase`/`merge` so that `update --remote` fast-forwards / rebases on the branch.

### "dirty submodule" error in CI

Set `submodule.<name>.ignore = dirty` (ignore uncommitted changes) or `untracked` in `.gitmodules`. For CI: `git config -f .gitmodules submodule.<name>.ignore dirty`.

### Submodule's `.git` has grown large / you want to relocate it

```bash
git submodule absorbgitdirs
```

Consolidates the submodule's `.git` directory into the superproject's `.git/modules/`.

## Alternatives to submodules

| Scenario | Alternative |
|---|---|
| A language-standard package manager is available | npm / pnpm / pip / go mod / cargo |
| "Always pull in the latest" | git subtree (also merges history) |
| Binary / large files | Git LFS |
| Sharing code within the same org | monorepo (pnpm workspace, turborepo, nx, etc.) |

## References

- [git-submodule - Git Documentation](https://git-scm.com/docs/git-submodule)
- [gitsubmodules - Git Documentation](https://git-scm.com/docs/gitsubmodules)
