---
reviewed: 2026-07-12
tags: [git-hook, go]
---

# lefthook

A fast Git hook manager written in Go. Supports parallel execution, file filters, stage updates, and shared configuration across multiple repositories. Increasingly adopted as a replacement for husky / pre-commit.

Official: [github.com/evilmartians/lefthook](https://github.com/evilmartians/lefthook)

## Installation

```bash
# mise / asdf
mise use lefthook@2

# Homebrew
brew install lefthook

# npm
pnpm add -D lefthook

# Go
go install github.com/evilmartians/lefthook@latest
```

## Enabling

```bash
lefthook install
```

This places lefthook's dispatcher script in `.git/hooks/`. Adding it to `scripts.prepare` in `package.json` (pnpm / npm) lets it auto-set-up via `pnpm install` after a clone:

```json
{ "scripts": { "prepare": "lefthook install" } }
```

## Configuration file `lefthook.yaml`

```yaml
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json,jsonc}"
      run: biome check --write {staged_files}
      stage_fixed: true
    markdownlint:
      glob: "**/*.md"
      run: markdownlint-cli2 --fix {staged_files}
      stage_fixed: true
    gitleaks:
      run: gitleaks git --pre-commit --staged --no-banner

pre-push:
  commands:
    typecheck:
      run: npx tsc --noEmit
```

## Key fields

### Top level

| Field | Description |
|---|---|
| `<hook-name>:` | A Git-defined hook name such as `pre-commit` / `commit-msg` / `pre-push` / `post-checkout` |
| `extends:` | Merges other yaml files (for sharing config across monorepos or common setups) |
| `min_version:` | Minimum required lefthook version |
| `glob_matcher:` | `doublestar` (recommended; `**` matches recursively) |

### Inside a hook

| Field | Description |
|---|---|
| `parallel: true` | Run commands in parallel |
| `piped: true` | Run sequentially, aborting on the first failure |
| `skip:` | Conditional skip (e.g. `- merge` / `- rebase` / `ref: refs/heads/main`) |
| `only:` | Conditional run (inverse of `skip`) |
| `commands:` | The individual commands to run |

### Inside a command

| Field | Description |
|---|---|
| `run:` | The shell command to execute |
| `glob:` | Glob pattern for target files |
| `exclude:` | Exclusion pattern |
| `tags:` | Labels for filtering when invoking the hook |
| `stage_fixed: true` | Re-stage modified files after the command runs |
| `fail_text:` | Message shown on failure |
| `root:` | Working directory to run in (for monorepos) |

## Variables

| Variable | Expands to |
|---|---|
| `{staged_files}` | Files currently staged (pre-commit) |
| `{push_files}` | Files being pushed (pre-push) |
| `{all_files}` | All tracked files |
| `{files}` | Files matched by `glob` |
| `{1}` / `{2}` ... | Arguments passed to the hook (`{1}` is the COMMIT_EDITMSG path for commit-msg) |

## Sharing base config via `extends`

When operating multiple repositories in an organization, extract the common parts into a separate repository and place it via a symlink or `git subtree`:

```yaml
# lefthook-base.yaml
glob_matcher: doublestar

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    gitleaks:
      run: gitleaks git --pre-commit --staged --no-banner
```

```yaml
# each repository's lefthook.yaml
extends:
  - lefthook-base.yaml

pre-commit:
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json}"
      run: biome check --write {staged_files}
      stage_fixed: true
```

## How to skip

### User side

```bash
# Skip a single hook
LEFTHOOK=0 git commit
LEFTHOOK_EXCLUDE=biome,gitleaks git commit

# Run only a specific command
lefthook run pre-commit --commands biome
```

Many projects prohibit `--no-verify` in principle per their CLAUDE.md or team conventions. Skipping individually via `LEFTHOOK_EXCLUDE` makes the intent clearer.

### Config side

```yaml
pre-commit:
  commands:
    slow-check:
      run: ./scripts/heavy.sh
      skip:
        - merge
        - rebase
      only:
        ref: "refs/heads/main"
```

## Execution order and errors

- `parallel: true`: runs all commands in parallel; other commands still run to completion even if one fails
- `piped: true`: sequential; aborts immediately on the first failure
- Default (neither set): sequential, but all commands run

If any exit code is non-zero, the whole hook fails and the Git operation is aborted.

## Windows support

Works under Git Bash / WSL. On native Windows, `run:` commands that assume a POSIX shell will fail. For cross-platform setups, routing through a Node script is the safer option.

## Common issues

### `lefthook install` does nothing

If `.git/hooks/` is already populated with existing hooks, use `lefthook install --force` to overwrite. Back up existing hooks beforehand.

### Files not staged also get modified

Even with `stage_fixed: true` set, if the command touches files beyond `{staged_files}`, unintended changes can occur. Combining `glob` with `{staged_files}` is the safe approach.

### Migrating from existing husky

1. Rewrite the scripts in `.husky/` into `lefthook.yaml`
2. Remove `husky` from `package.json`; change `"prepare": "husky"` to `"lefthook install"`
3. Delete `.husky/`

### commitlint doesn't run

Typical causes are a misnamed `commit-msg` hook (not `commit_msg`) or forgetting the `{1}` argument.

## AI agent hooks (`ai:`, beta)

As of v2.1.10, a beta top-level `ai:` key lets you declare hooks for **AI coding agents** in `lefthook.yaml`. `lefthook install` then generates the provider-specific hook file so the agent calls `lefthook run <hook>`:

| Provider | Generated file |
|---|---|
| `claude` | `.claude/settings.json` |
| `codex` | `.codex/hooks.json` |
| `cursor` | `.cursor/hooks.json` |
| `copilot` | `.github/hooks/lefthook.json` |

```yaml
ai:
  claude:
    Stop: validate
    PreToolUse: security-check
validate:
  jobs:
    - run: go test ./...
```

`lefthook install` / `uninstall` only replaces or removes lefthook-managed entries (hand-written agent entries are preserved), and the generated command uses the lefthook config value or an absolute path, so it does not depend on `PATH`.

## Comparison with other tools

| Aspect | lefthook | husky | pre-commit (Python) |
|---|---|---|---|
| Language | Go (single binary) | Shell + Node | Python |
| Installation | Binary | npm | pip |
| Parallel execution | Native | None | Supported |
| File filtering | Built-in glob | Handled individually | Pattern support |
| Config sharing | `extends` | None | `repos` reference |
| Speed | Fast | Average | Slower due to Python startup |
