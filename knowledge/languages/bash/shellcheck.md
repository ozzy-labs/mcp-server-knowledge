---
reviewed: 2026-05-04
tags: [lint, bash]
---

# ShellCheck

A static analysis tool for Bash / POSIX sh scripts. It detects common bugs, portability issues, missing quotes, and other problems that editors and manual review often miss. Written in Haskell.

Official: [shellcheck.net](https://www.shellcheck.net/) / [github.com/koalaman/shellcheck](https://github.com/koalaman/shellcheck)

## Installation

```bash
# mise
mise use shellcheck@0.11

# Homebrew
brew install shellcheck

# apt
sudo apt install shellcheck

# Docker
docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable myscript.sh
```

## Basic usage

```bash
# single file
shellcheck script.sh

# multiple files (glob)
shellcheck scripts/*.sh

# recursive
shellcheck **/*.sh

# specify output format
shellcheck -f gcc script.sh       # gcc-compatible (for editor integration)
shellcheck -f json script.sh      # JSON
shellcheck -f sarif script.sh     # SARIF (GitHub Security tab)

# minimum severity
shellcheck -S error script.sh     # error only
shellcheck -S warning script.sh   # warning and above
```

## Shebang and shell detection

shellcheck determines the target shell from the script's **shebang** or the `-s` flag:

```bash
#!/bin/bash       # bash
#!/bin/sh         # POSIX sh (strict compatibility)
#!/usr/bin/env bash
```

**Behavior differs significantly between sh and bash**: `[[ ]]`, complex syntax inside `$()`, arrays, etc. do not work under POSIX sh. Setting the correct shebang is the top priority.

## Common findings

| Code | Meaning | Example |
|---|---|---|
| `SC2086` | Unquoted variable expansion | `echo $var` → `echo "$var"` |
| `SC2046` | Unquoted command substitution | `cp $(ls)` → `cp "$(ls)"` (a `while read` loop is fundamentally recommended) |
| `SC2155` | Exit code masked by `declare` + assignment | `local x=$(cmd)` → split into two lines |
| `SC2181` | Direct comparison of `$?` | `cmd; if [ $? -ne 0 ]` → `if ! cmd` |
| `SC2164` | Missing failure check on `cd` | `cd dir` → `cd dir \|\| exit` |
| `SC2016` | `$var` inside single quotes is not expanded | If intentional: `# shellcheck disable=SC2016` |
| `SC2034` | Unused variable | An assignment that is never referenced |
| `SC2059` | Variable in a `printf` format string | `printf "$var"` → `printf "%s" "$var"` |
| `SC2012` | Don't parse the output of `ls` | `for f in $(ls)` → `for f in *` |

Full list: [shellcheck wiki](https://www.shellcheck.net/wiki/)

## Suppression

### Per line

```bash
# shellcheck disable=SC2086
echo $var   # intentionally unquoted
```

### Per block / function

```bash
# shellcheck disable=SC2086
function f() {
  echo $1
  echo $2
}
```

### Per file

At the top of the script (the line after the shebang):

```bash
#!/bin/bash
# shellcheck shell=bash
# shellcheck disable=SC2086,SC2034

...
```

### Project-wide (`.shellcheckrc`)

```text
disable=SC2086
enable=require-double-brackets
external-sources=true
source-path=SCRIPTDIR
```

Place it at the repository root.

## Specifying sources

When reading another file via `source`, tell shellcheck where to find it:

```bash
# shellcheck source=./lib/common.sh
source "$(dirname "$0")/lib/common.sh"
```

Alternatively, set `source-path=SCRIPTDIR` in `.shellcheckrc` for automatic resolution.

## Combining with shfmt

- **shellcheck**: detects "semantic" issues
- **shfmt**: handles "syntactic" formatting

Passing both keeps things healthy. A common pattern is to use both together via lefthook, etc.:

```yaml
pre-commit:
  commands:
    shell:
      glob: "**/*.sh"
      run: shfmt -w {staged_files} && shellcheck {staged_files}
      stage_fixed: true
```

## Usage in CI

```yaml
- name: Run ShellCheck
  uses: ludeeus/action-shellcheck@master
  with:
    severity: warning
    scandir: ./scripts
```

Or with a raw command:

```yaml
- run: find . -name "*.sh" -not -path "./node_modules/*" | xargs shellcheck
```

Upload SARIF output to the GitHub Security tab:

```yaml
- run: shellcheck -f sarif $(find . -name "*.sh") > shellcheck.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: shellcheck.sarif
```

## Pitfalls

### Not noticing issues even with `set -eu` at the top

shellcheck flags issues regardless of whether `set -eu` is present (whether `set` is used and whether bugs exist are separate concerns). Writing `set -euo pipefail` right after `#!/bin/bash` is a separate best practice.

### `[[ ]]` vs `[ ]`

- `[[ ]]`: extended syntax for bash / ksh / zsh. No quoting needed for variable expansion, supports `&&` / `||`
- `[ ]`: the POSIX-sh-compatible `test` command. Quoting is mandatory

For bash scripts, using `[[ ]]` is recommended (shellcheck also recommends `[[ ]]`).

### Wanting to use eval means you've already lost

Consider alternatives to `eval` for dynamic command generation. shellcheck does not warn about `eval` itself, but many shellcheck rules (e.g. SC2086) frequently show up around `eval`.

## Editor integration

- VS Code: [ShellCheck extension](https://marketplace.visualstudio.com/items?itemName=timonwong.shellcheck)
- Neovim: null-ls / efm-langserver / ALE
- Emacs: flycheck-shellcheck

Getting real-time warnings on save greatly improves the developer experience.

## Comparison with other tools

| Aspect | shellcheck | bashate | shfmt |
|---|---|---|---|
| Targets | sh / bash / dash / ksh | bash only | sh / bash |
| Scope | semantics, portability, bugs | style-focused | formatting |
| Accuracy | Very high | Medium | — |
| Ecosystem | De facto standard | Small | De facto standard |

For projects that prioritize POSIX compatibility, the combination of shellcheck + shfmt is sufficient.
