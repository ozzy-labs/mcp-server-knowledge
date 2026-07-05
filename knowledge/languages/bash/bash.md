---
reviewed: 2026-05-10
tags: [bash]
---

# Bash / POSIX shell

One of the languages AI coding agents write most often. Most pitfalls cluster around "variable expansion", "exit codes", and "subshell boundaries". For tool articles see `languages/bash/shellcheck.md` / `languages/bash/shfmt.md`.

Official: [GNU Bash Manual](https://www.gnu.org/software/bash/manual/bash.html) / [POSIX.1-2024 Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)

## Bash vs. POSIX sh

| | Bash | POSIX sh |
|---|---|---|
| Current | 5.3 (2025-07) | IEEE Std 1003.1-2024 (Issue 8) |
| Arrays / associative arrays | Yes | No |
| `[[ ... ]]` / `=~` | Yes | No |
| Process substitution `<(...)` | Yes | No |
| `local` | Yes | Added in Issue 8 (verify) |
| `pipefail` | Yes | Standardized in Issue 8 |

- For **development scripts**, default to Bash (`#!/usr/bin/env bash`) without hesitation — the expressiveness and safety gains are substantial.
- For **distributed artifacts / Alpine / initramfs / Docker scratch images**, `/bin/sh` compliance is required. Stick to POSIX only.
- macOS's `/bin/bash` is pinned to **bash 3.2 (GPLv2)**. Features from 4.x and later, such as arrays, aren't available.

## Shebang

```bash
#!/usr/bin/env bash   # Recommended: uses the bash on PATH (Homebrew 5.x, mise/asdf-managed installs also work)
#!/bin/bash           # Discouraged: pinned to 3.2 on macOS, doesn't exist on Alpine
#!/bin/sh             # POSIX-only: could resolve to ash/dash/bash --posix
```

Some security-sensitive root scripts (setuid-equivalent) intentionally choose `#!/bin/bash` to avoid PATH dependence. For ordinary CI / development scripts, standardize on the `env` form.

## Strict mode

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

| Flag | Effect |
|---|---|
| `-e` (errexit) | Exit immediately on command failure |
| `-u` (nounset) | Exit on reference to an undefined variable |
| `-o pipefail` | Non-zero exit if any command in a pipe fails |
| `-E` (errtrace) | Propagate the `ERR` trap into subshells and functions |
| `IFS=$'\n\t'` | Restrict word splitting to tab and newline (guards against filenames containing spaces) |

### Cases where errexit doesn't kick in

1. The `cmd` in `if cmd; then ...` does not trigger exit on failure (by design).
2. `local var=$(cmd)` — the `local` builtin's own exit status (0) masks the command's return value → separate declaration from assignment.
3. The inside of `$(...)` does not inherit errexit. On Bash 4.4+, `shopt -s inherit_errexit` makes it inherit.
4. Calling a function in a **conditional context** — `if f`, `!f`, `f && ...` — disables `-e` inside that function.
5. A failure inside process substitution `<(cmd)` is not reflected in the caller's exit code.

Details: [Wooledge BashFAQ/105](https://mywiki.wooledge.org/BashFAQ/105).

## Quoting and variable expansion

```bash
# Bad: breaks on filenames containing spaces (SC2086)
rm $file

# Good
rm -- "$file"
```

### `"$@"` vs `"$*"`

```bash
"$@"   # Expands each argument as a separate word (use this when passing to a loop)
"$*"   # Joins all arguments into a single string using the first character of IFS
```

Same applies to arrays: `"${arr[@]}"` vs `"${arr[*]}"`.

### Parameter expansion

| Syntax | Meaning |
|---|---|
| `${var:-word}` | Returns `word` if unset/null (does not assign) |
| `${var:=word}` | **Assigns** `word` and returns it if unset/null |
| `${var:?msg}` | Prints `msg` to stderr and exits non-zero if unset/null |
| `${var:+word}` | Returns `word` if set, empty if unset |
| `${#var}` | String length |
| `${var#pat}` / `${var##pat}` | Remove shortest/longest match from the front (POSIX) |
| `${var%pat}` / `${var%%pat}` | Remove shortest/longest match from the back (POSIX) |
| `${var/pat/repl}` / `${var//pat/repl}` | Replace first occurrence / all occurrences (Bash extension) |

## Test commands

| Aspect | `[ ]` (POSIX) | `[[ ]]` (Bash) |
|---|---|---|
| Quoting variables | Required | Not required |
| Using `&&` / `\|\|` inside | Not allowed | Allowed |
| Regex `=~` | No | Yes (right-hand side is unquoted) |
| Glob pattern `==` | No | Yes |

```bash
# Bash
[[ $file == *.txt ]] && echo "text file"
[[ $addr =~ ^[0-9]+\.[0-9]+$ ]] && echo "captured: ${BASH_REMATCH[0]}"

# POSIX
[ "$x" = "a" ] && [ "$y" = "b" ]   # chain with && on the outside
```

## Arrays and associative arrays

Indexed arrays have been available since Bash 2.0+. **Associative arrays** (`declare -A`) require Bash 4.0+, and are not available on macOS's stock 3.2 — a common gotcha.

```bash
declare -a arr=(a b c)
declare -A map=([k1]=v1 [k2]=v2)

echo "${arr[@]}"       # Expand every element as separate words
echo "${#arr[@]}"      # Element count
echo "${!map[@]}"      # List of keys
echo "${arr[@]:1:2}"   # 2 elements starting at offset 1
```

On Bash 4.3 and earlier, an empty array combined with `set -u` and `"${arr[@]}"` produces an "unbound" error. Resolved in 4.4+.

## Functions and return

```bash
# POSIX-compatible: no function keyword
my_func() {
  local output                    # (1) separate declaration from assignment
  output=$(some_command) || return 1
  printf '%s\n' "$output"
}

result=$(my_func) || exit 1
```

- The `function` keyword in `function f() { ... }` is a Bash / ksh / zsh extension. **If POSIX compatibility is required, use `f() { ... }` only.**
- A function's "return value" is **only its exit code**. Return data via stdout or a variable.
- Variables are global by default. **Always declare with `local`.**
- `local var=$(cmd)` masks the command's exit code (SC2155) → separate declaration from assignment.

## Subshell and pipe boundaries

```bash
# Bad: while read runs in a subshell → count does not leak out
count=0
find . -type f | while read -r f; do
  ((count++))
done
echo "$count"   # => 0

# Good 1: process substitution (Bash)
count=0
while IFS= read -r -d '' f; do
  ((count++))
done < <(find . -type f -print0)
echo "$count"

# Good 2: mapfile (Bash 4+)
mapfile -t files < <(find . -type f)
count=${#files[@]}
```

- `(cmd)` runs in a subshell, `{ cmd; }` runs in the current shell (variable changes propagate).
- `shopt -s lastpipe` (Bash 4.2+, non-interactive only) is another option to run the right side of a pipe in the current shell.

## trap and cleanup

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
trap 'echo "error at line $LINENO" >&2' ERR

# ... work ...
```

- Place the `EXIT` trap at the top of the script (right after `mktemp`). If placed later, an early initialization failure skips cleanup.
- If you use an `ERR` trap, combine it with `set -E` (`errtrace`) so it propagates into functions and subshells.
- macOS's `mktemp` differs from GNU's `-t` behavior. For portability, spell out the template's `X`s explicitly, as in `mktemp -d -t myapp.XXXXXX`.

## Heredocs

```bash
# With variable expansion
cat <<EOF
user=$USER
EOF

# Without variable expansion (the quoted delimiter is what matters)
cat <<'EOF'
$USER is literal
EOF

# here-string (feeds a single string to stdin)
read -r a b <<< "foo bar"
```

`<<-EOF` strips **leading tabs only** (spaces are left intact). This is handy for writing indented content inside nested blocks, but if an editor or markdownlint converts tabs to spaces, the stripping stops working — pin the indentation for that file to tabs via `.editorconfig`. Because this KB has markdownlint normalize tabs, this repo recommends plain `<<EOF`.

## Common mistakes AI agents make

1. **Unquoted variables** — `rm $file` breaks catastrophically on names with spaces. Use `"$file"`. SC2086.
2. **`&&` inside `[ ]`** — syntax error. Use `[ ... ] && [ ... ]` or `[[ ... && ... ]]`.
3. **`ls | while read`** — breaks on filenames with spaces/newlines. Use `find -print0` + `read -d ''`, or `mapfile`. SC2012.
4. **Ignoring `cd` failure** — `cd /tmp; rm -rf *` can wipe `/` if `cd` fails. Use `cd /tmp || exit 1`. SC2164.
5. **`local var=$(cmd)`** — doesn't trip `set -e`. Separate declaration from assignment. SC2155.
6. **Comparing `$?` directly** — `cmd; if [ $? -eq 0 ]` → use `if cmd; then` instead. SC2181.
7. **Relying on `echo -e` / `echo -n`** — undefined under POSIX. Use `printf '%s\n'`.
8. **`eval $var`** — a breeding ground for command injection. Replace with arrays and `"${arr[@]}"`.
9. **`sudo cmd > file`** — the redirect target is opened with the parent shell's privileges. `sudo tee file > /dev/null` is correct.
10. **Shebang/content mismatch** — using `[[`, arrays, or `source` while the shebang says `#!/bin/sh`. shellcheck catches this.
11. **Leaving `cd` unreverted** — wrap in a subshell `(cd dir && cmd)`, or bracket with `pushd`/`popd`.
12. **Overusing `|| true`** — effectively neutralizes `set -e`. Add a comment when this is intentional.

## Troubleshooting

### `unbound variable` on an empty array

A known issue with `set -u` + `"${arr[@]}"` on Bash 4.3 and earlier. Resolved in 4.4+. Workaround: `"${arr[@]:-}"`.

### Associative arrays don't work on macOS

`/bin/bash` is 3.2. Switch to `#!/usr/bin/env bash` and install Homebrew's bash 5.x via `brew install bash`, making sure it's on PATH.

### `command not found` but it works locally

A PATH dependency. CI environments are minimal. Check beforehand with `command -v cmd`, or use an absolute path (`/usr/bin/jq`).

### Adding pipefail broke things

Often caused by early termination in commands like `head` / `grep -q` propagating SIGPIPE. If this is acceptable, use `cmd1 | cmd2 || true`, or restructure using `mapfile` plus array processing.

### No color output from a shell script

Add a tty check: `[[ -t 1 ]] && red=$'\e[31m' reset=$'\e[0m'`. Prevents control sequences from leaking into pipes or log output.

## Relationship to other tools

- **git submodule** (`tools/git-submodule.md`): used when pulling an external shell script library into a project and managing it as a dependency.
- **ShellCheck** (`languages/bash/shellcheck.md`): always run after writing. SC2086 / 2155 / 2164 are classic AI agent mistakes.
- **shfmt** (`languages/bash/shfmt.md`): formatter. Align `indent_size` / `binary_next_line` / `space_redirects` via `.editorconfig`.
- **lefthook** (`tools/lefthook.md`): this repo's default setup runs shellcheck + shfmt automatically on pre-commit.

## References

- [GNU Bash Manual](https://www.gnu.org/software/bash/manual/bash.html)
- [GNU Bash: Shell Parameter Expansion](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html)
- [GNU Bash: Arrays](https://www.gnu.org/software/bash/manual/html_node/Arrays.html)
- [POSIX.1-2024 Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)
- [Wooledge BashFAQ/105 (`set -e` pitfalls)](https://mywiki.wooledge.org/BashFAQ/105)
- [Wooledge ProcessSubstitution](https://mywiki.wooledge.org/ProcessSubstitution)
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- [ShellCheck wiki](https://www.shellcheck.net/wiki/)
