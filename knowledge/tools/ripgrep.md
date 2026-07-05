---
reviewed: 2026-05-04
tags: [data-cli, rust, fast]
aliases: [rg]
---

# ripgrep

A `grep`-compatible fast search tool (binary name `rg`). Written in Rust, it respects `.gitignore` by default, and its parallel file traversal + SIMD acceleration make it significantly faster than `grep -r` / `ag` / `ack`. It's the first choice for AI agents exploring a codebase. If you're still relying on `grep` knowledge, you're prone to mistakes around the `--type` naming scheme, the regex engine, and ignore-file behavior — worth knowing up front.

Official: [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) / [User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)

## Installation

```bash
brew install ripgrep
mise use ripgrep
cargo install ripgrep
sudo apt install ripgrep              # Debian / Ubuntu
sudo dnf install ripgrep              # Fedora
winget install BurntSushi.ripgrep.MSVC
```

## Key options

| Flag | Purpose |
|---|---|
| `-i` | Case-insensitive |
| `-S` | Smart case (case-sensitive if the pattern contains an uppercase letter) |
| `-w` | Match on word boundaries |
| `-v` | Invert match |
| `-n` | Show line numbers (on by default) |
| `-l` | Only matching file names |
| `-c` | Only match counts |
| `-A N` / `-B N` / `-C N` | N lines of context after / before / around |
| `-t <type>` / `-T <type>` | Restrict to / exclude a language type |
| `-g '<glob>'` | Restrict by glob (`!` to exclude) |
| `--no-ignore` | Ignore `.gitignore` etc. |
| `--hidden` | Also search hidden files |
| `-z` | Also search inside compressed files (gz / bz2 / xz, etc.) |
| `-F` | Literal string (disables regex) |
| `-P` | Run with the PCRE2 engine |
| `-U` / `--multiline` | Allow multi-line matches |
| `--files` | List target files without a pattern |
| `--json` | Structured JSON output |
| `--vimgrep` | Vim quickfix format |
| `-a` / `--text` | Skip binary detection |
| `--debug` | Show configuration loading details |

## Ignore-file precedence

```text
.rgignore     ← highest priority (ripgrep-specific)
.ignore       ← language-agnostic
.gitignore    ← weakest
```

It also honors `.git/info/exclude` and `core.excludesFile`. A higher-priority file's exclusion rules can be **whitelisted** back with a `!pattern` in a lower-priority file. To **disable all ignoring**, use `--no-ignore`; to include hidden files too, use `--no-ignore --hidden -uuu`.

```bash
rg -uuu pattern   # -u three times = disable "ignore + hidden + binary" all at once
```

Levels of `-u`:

| Count | Effect |
|---|---|
| `-u` | Ignore `.gitignore` / `.ignore` |
| `-uu` | + hidden files |
| `-uuu` | + binary files |

## File types

```bash
rg -t py 'def main'        # Python only
rg -T js 'TODO'            # Exclude JavaScript
rg --type-list             # List all types
```

Unlike `grep`'s `--include='*.py'`, ripgrep uses **predefined type names** (`py`, `js`, `ts`, `rs`, `go`, `md`, `yaml`, `toml`, etc.). Add custom ones with `--type-add`:

```bash
rg --type-add 'web:*.{html,css,js}' -t web 'class='
```

## Configuration file

Specify it via the environment variable, e.g. `RIPGREP_CONFIG_PATH=~/.config/ripgrep/rc`. **One flag per line**:

```text
# ~/.config/ripgrep/rc
--smart-case
--max-columns=200
--type-add=web:*.{html,css,js}
--colors=line:fg:yellow
```

There's no escaping mechanism, so patterns containing quotes are awkward to write. CLI arguments **override** the config. Use `--no-config` to disable it entirely.

## Pattern engines

| Mode | Engine | Characteristics |
|---|---|---|
| Default | Rust regex | Fast, linear-time guarantee. Lookaround / backreferences are **not supported** |
| `-F` | Literal | Searches the string as-is (fastest) |
| `-P` | PCRE2 | Supports lookaround / backreferences / named captures |

```bash
# Not possible with Rust regex
rg 'foo(?=bar)' src/         # ← error

# Possible with PCRE2
rg -P 'foo(?=bar)' src/
```

`(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)`, `\1`, `(?P<name>...)`, etc. all require `-P`.

## Output formats

```bash
# JSON output (post-process with jq, etc.)
rg --json 'TODO' | jq -r '
  select(.type == "match")
  | "\(.data.path.text):\(.data.line_number) \(.data.lines.text)"
'

# Vim quickfix
rg --vimgrep 'TODO'

# File list only
rg --files -t py        # files with a .py extension
```

## stdin / pipes

```bash
cat large.log | rg -A 2 'ERROR'
git diff | rg '^\+.*TODO'         # only TODOs in added lines
```

When stdin is not a tty, it automatically switches to line-buffered mode.

## Parallelism

ripgrep automatically parallelizes based on CPU core count. Use `-j N` to explicitly limit it (e.g., to cap memory usage on a huge repo).

## Comparison with `grep` / `ag` / `git grep`

| Aspect | ripgrep | grep | ag (silver searcher) | git grep |
|---|---|---|---|---|
| Respects `.gitignore` | By default | No | By default | By default (git index only) |
| Parallelism | Automatic | None | Parallel | Parallel (partial) |
| Unicode | By default | Locale-dependent | Limited | Limited |
| Lookaround | Supported via `-P` | Supported via `-P` (GNU) | Not supported | Not supported |
| Automatic binary detection | Yes | Yes | Yes | Yes |
| Compressed files | `-z` | Separate via `zgrep` | Limited | Not supported |
| Speed | Fastest | Slower | Fast | Fast |

`git grep` is useful when only the working tree needs to be searched (zero indexing time); otherwise ripgrep is generally a strict upgrade.

## Common mistakes AI agents make

1. **Parse errors from using lookaround** — Rust regex has no lookaround. Add `-P`, or use `--engine pcre2`
2. **Target files disappear due to `.gitignore`** — e.g., wanting to read under `node_modules/` or `dist/` but nothing is found. Remove the restriction with `--no-ignore` or `-uu`
3. **Misunderstanding `-t` type names** — passing `'*.py'` `grep`-`--include`-style to `-t` causes an error. Check type names with `--type-list`
4. **Not quoting `-g`** — the shell expands it first. A single quote is mandatory, e.g. `-g '!*.test.ts'`
5. **Confusing `-l`'s purpose with `--files-without-match`** — `-l` lists files that had a match; `--files-without-match` lists files that had none
6. **Forgetting `-U` for multi-line search** — the default is line-based. For patterns spanning newlines, combine `-U` or `(?s)`, etc.
7. **Overusing `-a` on huge binaries** — wastes memory and time. Handle binaries with a different tool (e.g., `strings`)
8. **Configuration file has no effect** — `RIPGREP_CONFIG_PATH` is not set. Check loading status with `rg --debug`

## Related

- [`tools/jq.md`](jq.md) — post-processing `--json` output
- [`tools/ast-grep.md`](ast-grep.md) — an option when you need structure-based search
- [`languages/bash/bash.md`](../languages/bash/bash.md) — basics of invoking from a shell

## References

- [BurntSushi/ripgrep (GitHub)](https://github.com/BurntSushi/ripgrep)
- [User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)
- [FAQ](https://github.com/BurntSushi/ripgrep/blob/master/FAQ.md)
