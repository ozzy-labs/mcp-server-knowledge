---
reviewed: 2026-05-04
tags: [format, bash, go]
---

# shfmt

A shell script formatter written in Go. Parses and formats bash / mksh / POSIX sh / zsh consistently (zsh support since v3.13.0). Along with shellcheck, it's the de facto tool for shell script operations.

Official: [github.com/mvdan/sh](https://github.com/mvdan/sh)

## Installation

```bash
# mise
mise use shfmt@3

# Homebrew
brew install shfmt

# Go
go install mvdan.cc/sh/v3/cmd/shfmt@latest

# Docker
docker run --rm -v "$PWD:/mnt" mvdan/shfmt:latest -w /mnt
```

## Basic usage

```bash
# Show diff (no changes made)
shfmt -d script.sh

# Formatted result to stdout
shfmt script.sh

# Write back to file
shfmt -w script.sh

# Recursive directory
shfmt -w .

# Specify shell dialect
shfmt -ln bash script.sh   # bash
shfmt -ln posix script.sh  # POSIX sh
shfmt -ln mksh script.sh   # mksh
shfmt -ln zsh script.sh    # zsh (v3.13.0+)
```

## Key flags

| Flag | Meaning | Default |
|---|---|---|
| `-w` | Write back to file | — |
| `-d` | Show diff | — |
| `-l` | List only filenames that need changes | — |
| `-i <N>` | Indent width (spaces; 0 for tabs) | 0 (tabs) |
| `-bn` | Put `&&` / `\|\|` etc. at the start of the line | false |
| `-ci` | Indent `case` `)` | false |
| `-sr` | Space before redirects | false |
| `-kp` | Keep extra blank lines | false |
| `-fn` | Put function opening `{` on next line | false |
| `-ln <variant>` | Shell dialect | Auto from shebang |
| `-s` | Simplify (e.g. `[ ... ]` → `[[ ... ]]`) | false |

## `.editorconfig` configuration

shfmt automatically reads `.editorconfig` (the `[*.sh]` section):

```ini
[*.sh]
indent_style = space
indent_size = 2
binary_next_line = true
switch_case_indent = true
space_redirects = true
```

Since v3.13.1 it also recognizes the `[[zsh]]` section, auto-inferring dialect from filenames like `.zshrc` / `.bash_profile`. Standardizing via EditorConfig keeps it consistent with other tools (editors, prettier, etc.).

## Formatting example

```bash
# Before
if [[ $x = "foo" ]]
then
    echo "foo"
fi

# After (default)
if [[ $x = "foo" ]]; then
 echo "foo"
fi

# With -s (simplify)
if [[ $x == "foo" ]]; then
 echo "foo"
fi
```

## Shebang and automatic dialect detection

shfmt looks at the shebang to determine the dialect:

```bash
#!/bin/bash       → bash
#!/bin/sh         → POSIX sh
#!/usr/bin/env bash → bash
#!/bin/zsh        → zsh (v3.13.0+)
```

If there's no shebang, specify explicitly with `-ln`. Filenames like `.zshrc` / `.bash_profile` have their dialect auto-determined since v3.13.1.

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    shell:
      glob: "**/*.sh"
      run: shfmt -w {staged_files} && shellcheck {staged_files}
      stage_fixed: true
```

Format with `shfmt -w` → semantic check with `shellcheck` → re-stage with `stage_fixed`. This order is recommended.

## Usage in CI

```bash
# Check format compliance (no write-back)
shfmt -d -l .

# Fail check with non-zero exit
if [ -n "$(shfmt -l .)" ]; then
  echo "Format issues:"
  shfmt -d .
  exit 1
fi
```

## Editor integration

- **VS Code**: [shell-format extension](https://marketplace.visualstudio.com/items?itemName=foxundermoon.shell-format). Specify `editor.defaultFormatter`
- **Neovim**: null-ls / conform.nvim
- **IntelliJ / GoLand**: plugin available

Format-on-save is the right call for developer experience.

## Common misconceptions

- **shfmt does not do semantic checks** — it's purely a formatter. Bug detection is shellcheck's job
- **Tabs are the default** — without explicit `-i 2`, the actual indent is tabs. Standardizing via EditorConfig is recommended
- **`-s` looks destructive but is safe** — conversions like `[ ]` → `[[ ]]` are semantically equivalent (bash only)
- **Output changes depending on presence of shebang** — for shebang-less bash scripts, add `-ln bash` or add a shebang

## Comparison with other tools

| Aspect | shfmt | beautysh | bashate |
|---|---|---|---|
| Language | Go | Python | Python |
| Speed | Fast | Slow | Slow |
| Supported dialects | bash/sh/mksh | bash | bash |
| Formatting accuracy | High | Medium | None (lint only) |
| Maintenance | Active | Moderate | Moderate |

shellcheck (lint) + shfmt (format) as a two-stage combo is the modern standard for shell script operations.
