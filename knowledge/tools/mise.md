---
reviewed: 2026-05-04
tags: [version-manager, task-runner, rust]
---

# mise

A CLI that unifies dev-tool version management, a task runner, and environment variable management. Designed as a successor to asdf, and starts fast as a Go binary. Manages Node / Python / Go / Rust / standalone binaries all from a single config.

Official: [mise.jdx.dev](https://mise.jdx.dev/)

## Installation

```bash
# Homebrew
brew install mise

# curl
curl https://mise.run | sh

# cargo
cargo install mise
```

Enable shell integration (activate mode):

```bash
# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc

# zsh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# fish
echo 'mise activate fish | source' >> ~/.config/fish/config.fish
```

On every `cd`, it reads `mise.toml` and dynamically switches PATH.

## Config file `mise.toml`

```toml
[tools]
# Runtime & package managers
node = "24"
pnpm = "10"

# Linters & formatters
biome = "2"
shellcheck = "0.11"
shfmt = "3"
taplo = "0.10"
"npm:markdownlint-cli2" = "0.21"
"pipx:yamllint" = "1"
yamlfmt = "0.21"
actionlint = "1"
gitleaks = "8"
trivy = "0.69"
"pipx:mdformat" = "0.7"

# Git hooks
lefthook = "2"

[env]
NODE_ENV = "development"
DATABASE_URL = "postgresql://localhost/myapp"

[tasks.build]
description = "Build the project"
run = "pnpm run build"
```

`mise install` resolves and installs all tools. `mise use <tool>@<version>` can also add tools.

## Version specification syntax

| Spec | Meaning |
|---|---|
| `"24"` | Latest of major version 24 |
| `"24.5"` | Latest patch of minor version 24.5 |
| `"24.5.1"` | Pinned |
| `"lts"` | Latest LTS |
| `"latest"` | Latest stable |
| `"ref:<commit>"` | Git ref (when plugin supports it) |

Multiple versions coexisting:

```toml
[tools]
node = ["24", "22"]  # installs both, first one takes priority
```

## Choosing a backend

mise uses several installer backends depending on the tool:

| Backend | Syntax | Use case |
|---|---|---|
| core | `node = "24"` | Tools with built-in support |
| aqua | Most binaries | Binary distribution via GitHub Releases |
| ubi | `ubi:<owner>/<repo>` | ubi-compatible binaries |
| npm | `"npm:<pkg>" = "..."` | npm packages served via mise shim |
| pipx | `"pipx:<pkg>" = "..."` | Python tools |
| cargo | `"cargo:<crate>" = "..."` | Rust crates |
| asdf | `"asdf:<plugin>" = "..."` | asdf plugin fallback |

## Task runner

```toml
[tasks.test]
description = "Run tests"
run = "pnpm run test"
depends = ["build"]

[tasks.build]
description = "Build"
run = "pnpm run build"
sources = ["src/**/*.ts"]
outputs = ["dist/**/*.js"]
```

- Run with `mise run test`
- `depends` resolves prerequisite tasks
- Writing `sources` / `outputs` enables diff-based skipping (incremental build)
- Can also be written as script files under `.mise/tasks/<name>` (shell-script format, can take arguments)

## Environment variables

```toml
[env]
API_URL = "http://localhost:3000"

[env._.file]
_ = ".env"
```

- Write keys directly under `[env]`
- `[env._.file]` loads a `.env` file
- `[env.redact]` specifies which values to mask in logs

Lets you manage per-project environment variables centrally in mise without a `.env` file.

## `mise.local.toml`

For local overrides (recommended to `.gitignore`):

```toml
[env]
DATABASE_URL = "postgresql://localhost/myapp_dev"
DEBUG = "1"
```

## Key commands

| Command | Purpose |
|---|---|
| `mise install` | Install all tools listed in `.mise.toml` |
| `mise use <tool>@<ver>` | Add or change a version |
| `mise ls` | List installed tools |
| `mise current` | Show versions active in the current directory |
| `mise outdated` | Check for newer versions |
| `mise upgrade` | Upgrade within constraints |
| `mise which <tool>` | Show the resolved path |
| `mise run <task>` | Run a task |
| `mise exec -- <cmd>` | Run with mise's env (without activate) |
| `mise trust` | Trust the `.mise.toml` of a new directory |

## Trust model

Because `mise.toml` affects the shell, it is **not loaded in untrusted directories**:

```bash
cd new-repo
# → warn: Config file not trusted
mise trust
```

This is a security mechanism that prevents environment variables set via `[env]` or `[tasks]` from being auto-executed.

## Usage in CI

```yaml
- uses: jdx/mise-action@v4
  with:
    version: 2026.4.28
    experimental: true
- run: pnpm install --frozen-lockfile
- run: pnpm run test
```

mise-action reads `mise.toml` and installs all tools. Caching is also automatic.

## Migrating from asdf

- `.tool-versions` can be read by mise as-is
- Most plugins resolve automatically (asdf plugin compatible)
- Add mise-specific features (tasks / env) to `.mise.toml`

## Troubleshooting

### `mise: command not found`

Shell integration is missing. Add `eval "$(mise activate <shell>)"` to your rc file.

### Tools don't switch on `cd`

The directory may not be trusted. Allow it with `mise trust .`.

### Slow in CI

The first build has a long install time. Use `mise-action`'s cache, or bake mise and the tools into an OCI image.

### Difference from `shims` mode

mise has 2 modes:

- **activate mode** (recommended): rewrites PATH. Fast
- **shims mode**: places thin wrapper scripts under `~/.local/share/mise/shims/`. Useful when an IDE invokes `node` directly

Guideline: use activate for interactive shells, shims for IDEs.

## Comparison with other tools

| Aspect | mise | asdf | Volta | nvm + pyenv + ... |
|---|---|---|---|---|
| Supported languages | Many | Many | Node-specific | Per-tool |
| Speed | Fast (Go) | Moderate (Bash) | Fast (Rust) | Per-tool |
| tasks | Yes | No | No | No |
| env management | Yes | No | No | No |
| Plugins | asdf-compatible | Extensive | None | — |
