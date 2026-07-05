---
reviewed: 2026-05-04
tags: [lint, format, toml, rust]
---

# taplo

A TOML formatter + validator + language server written in Rust. Its usefulness has grown as TOML adoption spreads via `pyproject.toml`, `Cargo.toml`, `.mise.toml`, and similar files.

Official: [taplo.tamasfe.dev](https://taplo.tamasfe.dev/)

## Installation

```bash
# mise
mise use taplo@0.10

# Homebrew
brew install taplo

# Cargo
cargo install taplo-cli --locked

# npm (bundles the LSP)
pnpm add -D @taplo/cli
```

## Basic usage

```bash
# Format (write back)
taplo format file.toml

# Shorthand
taplo fmt file.toml

# Check only (for CI, no write-back)
taplo format --check file.toml

# Recursive
taplo format .

# Syntax validation
taplo check file.toml

# Validate against a JSON Schema
taplo lint file.toml
```

## Configuration: `taplo.toml` / `.taplo.toml`

```toml
include = ["**/*.toml"]
exclude = [
  "node_modules/**",
  ".git/**",
]

[formatting]
align_entries = false              # do not align (keeps diffs small)
align_comments = true
array_trailing_comma = true
array_auto_expand = true
array_auto_collapse = true
compact_arrays = true
compact_inline_tables = false
inline_table_expand = true
trailing_newline = true
allowed_blank_lines = 1
column_width = 100
indent_tables = false
indent_entries = false
reorder_keys = false               # do not change order
reorder_arrays = false

[[rule]]
include = ["**/Cargo.toml"]
[rule.formatting]
reorder_keys = true                # normalize key order for Cargo.toml
```

## JSON Schema validation

taplo can validate TOML files against JSON Schema. The built-in catalog of `@taplo/cli` includes:

- `Cargo.toml`
- `pyproject.toml`
- `.mise.toml` / `mise.toml`
- `rustfmt.toml`
- `cargo-release.toml`

A custom schema can be specified via the `schema` field in `taplo.toml`:

```toml
[[rule]]
include = ["myapp.toml"]
schema = { url = "https://example.com/schema.json" }
```

## pre-commit integration (lefthook)

```yaml
pre-commit:
  commands:
    taplo:
      glob: "**/*.toml"
      run: taplo format {staged_files}
      stage_fixed: true
```

For projects with few TOML files the benefit is limited, but if there's a `.mise.toml` / `pyproject.toml`, continuous formatting pays off.

## Usage in CI

```yaml
- run: taplo format --check .
```

On failure, the diff exists within the repository. Since it's check-only, nothing is written back.

## Editor integration

### VS Code

The [Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml) extension is taplo-based. It provides format-on-save + JSON Schema completion + validation.

```json
{
  "[toml]": {
    "editor.defaultFormatter": "tamasfe.even-better-toml",
    "editor.formatOnSave": true
  }
}
```

### Neovim / Emacs

Launch `taplo lsp stdio` from an LSP client (nvim-lspconfig / lsp-mode).

## Per-file settings (`# taplo:` directive)

```toml
# taplo: formatting.align_entries = true
[package]
name = "x"
version = "0.1.0"
description = "aligned"
```

A comment prefixed with `# taplo:` at the top of the file overrides local rules.

## Cargo.toml-specific notes

`reorder_keys = true` can automatically apply Cargo ecosystem conventions (`[package]` → `[dependencies]` → `[dev-dependencies]` order, alphabetical within each). However, since this is a **destructive reformat**, apply it in bulk via a separate PR for existing codebases and register it in `.git-blame-ignore-revs`.

## Troubleshooting

### Failures on `.mise.toml`

Because mise uses extended syntax (backend prefixes like `npm:` / `pipx:`, etc.), taplo's JSON Schema validation may emit warnings. Formatting still passes, so it's safest to use only `taplo format` and exclude `taplo lint`.

### Array line breaks change every time

`array_auto_expand` / `array_auto_collapse` kick in once `column_width` is exceeded. Increase the value, or fix it with `array_auto_expand: false`.

### Don't like the alignment

Set `align_entries` and `align_comments` to `false`. If diff readability is the priority, not aligning is the practical choice.

## Comparison with other tools

| Aspect | taplo | dprint (toml plugin) | prettier-plugin-toml |
|---|---|---|---|
| Language | Rust | Rust | Node.js |
| Speed | Fast | Fast | Medium |
| JSON Schema validation | Yes | No | No |
| LSP | Yes | No | No |
| Editor extension | Official | Official | Via Prettier |

If TOML-specific features (LSP, JSON Schema) are needed, taplo is the clear choice. If you want to unify multiple languages under dprint, dprint + toml plugin is also an option.
</content>
</invoke>
