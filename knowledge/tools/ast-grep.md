---
reviewed: 2026-05-04
tags: [lint, data-cli, rust]
aliases: [sg]
---

# ast-grep

A Rust CLI for AST-based code search, lint, and rewriting across 20+ languages. It uses tree-sitter-based pattern matching to safely perform "**structure-preserving**" replacements that `grep` / `sed` fail at with plain text. Setup is lighter than codemod tools like `jscodeshift`. The binary name is `ast-grep`, shortened to `sg`. On Linux, `sg` collides with `setsid`-family commands, so use `ast-grep`.

Official: [ast-grep.github.io](https://ast-grep.github.io/)

## Installation

```bash
brew install ast-grep
cargo install ast-grep --locked
npm install -g @ast-grep/cli
pip install ast-grep-cli
```

## Basic commands

```bash
ast-grep run -p '<pattern>' [-l <lang>] [path]    # structural search
ast-grep run -p '<pattern>' -r '<rewrite>' -U     # bulk rewrite (-U to apply)
ast-grep scan                                      # lint using rule files
ast-grep test                                      # test rules
ast-grep lsp                                       # LSP for editor integration
```

The `run` subcommand can be omitted as `ast-grep -p ...`. Without `-U` it's a dry-run (diff preview only).

## Pattern syntax

Use metavariables `$X` / `$$$ARGS` to capture AST nodes:

| Syntax | Matches |
|---|---|
| `$NAME` | A single AST node (must be uppercase) |
| `$$$ARGS` | Zero or more consecutive nodes (variadic) |
| `$_` | A single unnamed node |
| `$$NAME` | Named multi. Captures a run of immediately adjacent nodes (experimental) |

Patterns **must be single-quoted** to prevent shell expansion of `$`.

### Example: removing `console.log`

```bash
# Remove every console.log() in JS/TS
ast-grep -p 'console.log($$$ARGS)' -r '' -l ts -U src/
```

### Example: converting to optional chaining

```bash
ast-grep -p '$PROP && $PROP()' \
         -r '$PROP?.()' \
         -l ts -U .
```

Since `$PROP` has the same name in the pattern and the rewrite, it refers to the same node (capture group reuse).

### Example: adding an argument to a function call

```bash
ast-grep -p 'fetch($URL)' \
         -r 'fetch($URL, { credentials: "include" })' \
         -l ts -U src/
```

## Supported languages

C / C# / C++ / CSS / Dart / Elixir / Go / Haskell / HTML / Java / JavaScript / JSON / Kotlin / Lua / PHP / Python / Ruby / Rust / Scala / Solidity / Swift / Thrift / TypeScript / TSX / YAML and others. You can also register **custom tree-sitter parsers** via `sgconfig.yml`.

## Project configuration (`sgconfig.yml`)

```yaml
ruleDirs:
  - rules
testConfigs:
  - testDir: tests
utilDirs:
  - utils
customLanguages:
  vue:
    libraryPath: ./parsers/tree-sitter-vue.so
    extensions: [vue]
```

`ast-grep new` generates scaffolding (including `rules/` and `tests/`).

## Rule files (YAML)

```yaml
# rules/no-deprecated-fetch.yml
id: no-deprecated-fetch
language: TypeScript
severity: warning
message: legacy fetch wrapper is deprecated, use `httpx`
rule:
  pattern: legacyFetch($URL)
fix: httpx.get($URL)
```

| Key | Purpose |
|---|---|
| `id` | Rule identifier |
| `language` | Target language |
| `severity` | `error` / `warning` / `info` / `hint` |
| `message` | Message shown on violation |
| `rule` | Pattern definition |
| `fix` | Auto-fix template |

### Main `rule` operators

| Operator | Meaning |
|---|---|
| `pattern` | Pattern match |
| `kind` | tree-sitter node type (e.g. `function_declaration`) |
| `regex` | Regular expression |
| `inside` / `has` / `precedes` / `follows` | Positional relations |
| `all` / `any` / `not` / `matches` | Logical combinators |
| `where` | Additional constraints on metavariables |

### Nested example

```yaml
rule:
  all:
    - pattern: $FN($$$ARGS)
    - inside:
        kind: try_statement
    - not:
        has:
          pattern: await $FN($$$ARGS)
```

Detects "a function call inside a `try` block that isn't awaited."

## Testing

```yaml
# tests/no-deprecated-fetch-test.yml
id: no-deprecated-fetch
valid:
  - "httpx.get(url)"
invalid:
  - "legacyFetch(url)"
```

```bash
ast-grep test    # expects no false positives in `valid`, true positives in `invalid`
```

## CI integration

```yaml
- uses: actions/checkout@v6
- uses: ast-grep/setup-ast-grep@v1
- run: ast-grep scan
```

CI fails when the exit code is nonzero. Use `--error` to fail only on `severity: error`.

## Editor integration (LSP)

```bash
ast-grep lsp
```

Connects via the VS Code extension [ast-grep](https://marketplace.visualstudio.com/items?itemName=ast-grep.ast-grep-vscode) or Neovim's `nvim-lspconfig`. Shows inline rule violations and quick-fixes.

## Comparison with `grep` / `sed` / `jscodeshift`

| Aspect | ast-grep | grep / sed | jscodeshift |
|---|---|---|---|
| Match unit | AST node | Line/string | AST (recast) |
| Language count | 20+ (tree-sitter) | Language-agnostic | JS/TS only |
| Setup | None (single CLI) | None | Node.js + write a transform function |
| Rewriting | Declarative via `-r` template | Text substitution | Write `j(file).find(...).replaceWith(...)` in JS |
| Learning curve | Learn the pattern syntax | Familiar | API docs required |
| Scope | Works at whole-project scale | Small scale | Whole project |

Choose ast-grep when you need "**structure-preserving replacement**" or "**cross-language**" support. For complex branching logic within JS/TS, jscodeshift offers more expressiveness.

## Common mistakes AI agents make

1. **Forgetting single quotes** — `$X` gets expanded by the shell and becomes empty. Wrap in `'pattern'`
2. **Omitting `-l` causes no match** — common with file extensions the language can't auto-detect. Being explicit is safest
3. **Forgetting `-U` so nothing gets applied** — be mindful of the dry-run vs. apply switch
4. **Not distinguishing `$X` from `$x`** — metavariables are reliably **uppercase + digits**. Lowercase may be treated as a plain identifier
5. **Indentation of multi-line patterns** — when writing multi-line code in a YAML rule, use `|` for a literal block. Using `>` (folded) strips newlines
6. **Wanting multiple `fix` candidates** — only a single `fix:` field is supported. For multiple fixes, use a `transform` plugin or separate rules
7. **Confusing `scan` and `run`** — `run` is a one-off search; `scan` lints everything under `ruleDirs`. CI should use `scan`
8. **`sg` colliding with another command on Linux** — `sg` conflicts with the `setsid` family. Even a shell alias can't override this. Use `ast-grep`

## Related

- [`languages/js/typescript-esm.md`](../languages/js/typescript-esm.md) — a common target for TS
- [`languages/js/biome.md`](../languages/js/biome.md) — JS/TS linting. Prefer biome when text patterns suffice
- [`languages/bash/shellcheck.md`](../languages/bash/shellcheck.md) — Shell AST analysis (ast-grep also supports shell)

## References

- [ast-grep Documentation](https://ast-grep.github.io/)
- [ast-grep on GitHub](https://github.com/ast-grep/ast-grep)
- [ast-grep playground](https://ast-grep.github.io/playground.html)
