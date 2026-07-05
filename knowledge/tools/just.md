---
reviewed: 2026-05-04
tags: [task-runner, rust]
---

# just

A command runner that gathers project-specific commands into a `justfile`. It's **not a build system**, so it has no dependency resolution or timestamp tracking like make, which makes it simpler. No `.PHONY` needed, and arguments/defaults/attributes can be declared declaratively. AI agents often trip up by writing it like a Makefile, so it's important to understand the differences from make.

Official: [just.systems](https://just.systems/) / [just.systems/man/en](https://just.systems/man/en/)

## Installation

```bash
# Homebrew
brew install just

# mise
mise use just

# cargo
cargo install just

# Official install script
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# WinGet
winget install --id Casey.Just -e
```

## Basics

```bash
just                # Run the default recipe (first one in the justfile)
just <recipe>       # Run the specified recipe
just -l             # List recipes
just --evaluate     # Evaluate and display variables
just --fmt          # Format the justfile (stabilized in 1.50.0)
just --choose       # Choose a recipe interactively
just --dry-run -n   # Show what would run without running it
```

The `justfile` is searched for in the current directory, its parents, and **recursively up parent directories**. It works even when run from a subdirectory.

## Minimal `justfile` example

```just
# justfile

default: build test    # The first recipe is the default. Multiple dependencies can be listed
build:
    cargo build

test:
    cargo test

# Parameters with default values
release version="dev":
    cargo build --release
    git tag v{{version}}
```

```bash
just                # build → test
just release        # runs with version=dev
just release 1.2.0  # version=1.2.0
```

### Dependencies and passing arguments

```just
fmt: clean
    cargo fmt

# Arguments can also be passed to dependencies
deploy env: (build env) (test env)
    ./scripts/deploy.sh {{env}}

build env:
    cargo build --release --features {{env}}
```

Use the `(recipe args)` form to pass arguments to a dependency recipe.

### Variadic arguments

```just
# Zero or more
run *args:
    cargo run -- {{args}}

# One or more
push +files:
    git add {{files}}
    git commit -m "update"
```

## Variables and expressions

```just
project := "myapp"
version := "1.0.0"
target_dir := justfile_directory() / "target"     # function + path join
hash := `git rev-parse --short HEAD`              # backticks run a shell command

build:
    @echo "Building {{project}} v{{version}} ({{hash}})"
    cargo build --target-dir {{target_dir}}
```

Key built-in functions: `justfile_directory()` / `invocation_directory()` / `env_var("KEY")` / `env_var_or_default("KEY", "fallback")` / `os()` / `arch()` / `uppercase()` / `lowercase()` / `clean()`.

## Recipe attributes

```just
[private]
_helper:
    echo internal

[group('test')]
unit:
    cargo test --lib

[confirm("Are you sure you want to delete?")]
nuke:
    rm -rf target

[linux]
[macos]
deps:
    brew install ripgrep

[windows]
deps:
    winget install BurntSushi.ripgrep.MSVC

[no-cd]
sibling:
    pwd                    # do not cd into the justfile's directory

[working-directory: 'src']
build:
    cargo build

[script("python3")]
analyze:
    import csv
    print("run from python")

[doc("Run the release")]
release:
    ./release.sh
```

| Attribute | Purpose |
|---|---|
| `[private]` | Hides from `just -l` and disallows calling it directly via `just` |
| `[group('name')]` | Groups recipes in the listing |
| `[confirm("msg")]` | Prompts for confirmation before running |
| `[no-cd]` | Disables the default behavior of cd'ing into the justfile's directory |
| `[linux]` / `[macos]` / `[windows]` / `[unix]` / `[openbsd]` / `[freebsd]` / `[netbsd]` / `[dragonfly]` / `[android]` | OS filter |
| `[env('NAME', 'VALUE')]` | Sets a per-recipe environment variable (1.47.0+) |
| `[working-directory: '<path>']` | Per-recipe working directory |
| `[script("interpreter")]` | Runs the recipe body as a script in another language |
| `[doc("...")]` | Description text shown in `just -l` |
| `[positional-arguments]` | Receive arguments as `$1` `$2` (instead of `{{var}}`) |
| `[no-exit-message]` | Suppresses the `error: Recipe ...` message on failure |

## Settings (`set`)

```just
set shell := ["bash", "-uc"]                # pin the shell to bash
set windows-shell := ["powershell.exe"]
set dotenv-load := true                     # load .env
set dotenv-required := true                 # error if .env is missing
set positional-arguments := true            # receive arguments as $1, $2, ...
set export := true                          # export all variables as environment variables
set fallback := true                        # also search parent directories for a justfile
set working-directory := "subproject"
```

| Setting | Purpose |
|---|---|
| `shell` | Shell used for recipes and backtick execution |
| `windows-shell` | Same, for Windows |
| `dotenv-load` | Auto-load `.env` |
| `dotenv-filename` | Use a filename other than `.env` |
| `dotenv-path` | Arbitrary path |
| `dotenv-override` | Override existing environment variables with `.env` |
| `dotenv-required` | Require `.env` to exist |
| `export` | Export variables as environment variables |
| `positional-arguments` | Enable `$1` `$2` in recipes |
| `fallback` | Fall back to a parent `justfile` |
| `allow-duplicate-recipes` | Allow duplicates, last one wins |
| `ignore-comments` | Skip `#` lines |

## Writing recipes in other languages

```just
# Python recipe
analyze:
    #!/usr/bin/env python3
    import json, sys
    data = json.load(open("data.json"))
    print(len(data))

# Node.js recipe
gen:
    #!/usr/bin/env node
    console.log(process.argv);
```

When a recipe starts with a shebang, `just` executes it as a single script. Use this when you want multiple lines to run in one process (by default, each line runs as an independent bash process).

## Differences from make

| Aspect | just | make |
|---|---|---|
| Build diffing | **None** (always runs) | Determined by timestamps |
| `.PHONY` | Not needed | Required (otherwise conflicts with filenames) |
| Arguments | First-class recipe feature | Passed via `target=value` (hard to read) |
| OS switching | Declarative via attributes | Branches via `ifeq` |
| Error display | Line number + failed recipe name | Cryptic |
| Default indentation | Spaces allowed | **Tabs required** |
| Parallel execution | Not built in | Available via `-j` |

`just` is a **command runner, not a build tool**. If a `Makefile` relies on incremental builds, replacing it with `just` is actually a functional downgrade. It's best thought of as a natural evolution of `package.json`'s `scripts`.

## Common AI agent mistakes

1. **Writing `.PHONY`** — Not needed in `just`. Doing so treats it as an unrecognized recipe
2. **Assuming tabs are required** — Space indentation is fine. Mixing tabs causes `error: Inconsistent leading whitespace`
3. **Using `$VAR` inside a recipe** — By default, variables use double braces `{{var}}`. `$VAR` expands as a shell variable (`$1` `$2` only work with `set positional-arguments`)
4. **Trying to write command-line flags in a dependency** — Dependencies pass arguments via `(recipe args)`. Something like `build --release` is a recipe call, not an attribute
5. **Reusing make's `@` and expecting the same echoing behavior** — `just` also uses a leading `@` to suppress command echoing, but the behavior differs slightly. Using `set quiet` for blanket suppression is safer
6. **Writing only `set shell := ["bash", "-c"]`** — Without also adding `-u` `-e` `-o pipefail`, bash's defaults let failures go unnoticed
7. **Expecting `.env` but forgetting `set dotenv-load := true`** — This is off by default
8. **Expecting `just` alone to run things in parallel** — There's no built-in parallelism. Use `&` or `xargs -P` inside a recipe if you want parallel execution

## Related

- [`tools/mise.md`](mise.md) — mise's `tasks` provide similar functionality. If a project uses both, decide which one to standardize on
- [`tools/lefthook.md`](lefthook.md) — A dedicated Git hooks tool has separate responsibilities
- [`languages/bash/bash.md`](../languages/bash/bash.md) — Background knowledge for writing recipe bodies in bash

## References

- [Just Programmer's Manual](https://just.systems/man/en/)
- [casey/just (GitHub)](https://github.com/casey/just)
- [Settings Reference](https://just.systems/man/en/settings.html)
