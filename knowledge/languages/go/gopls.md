---
reviewed: 2026-05-04
tags: [go, lsp, ide]
---

# gopls

**Official Language Server** developed and maintained by the Go team. Provides IDE features to any LSP-compatible editor (VS Code / Neovim / Helix / Zed / Emacs / Vim). GoLand uses JetBrains' own Go plugin (proprietary implementation), so gopls is unnecessary there.

Official: [pkg.go.dev/golang.org/x/tools/gopls](https://pkg.go.dev/golang.org/x/tools/gopls) / [GitHub](https://github.com/golang/tools/tree/master/gopls)

## Installation

```bash
go install golang.org/x/tools/gopls@latest
```

The VS Code Go extension prompts to install it automatically on first launch. The latest release series is **v0.21.x** (check on pkg.go.dev).

### Go version requirements

- **Build requirement**: gopls v0.17+ must be built with Go 1.23 or later
- **Support requirement**: gopls v0.18+ officially supports only the **latest 2 major Go versions** (older Go may still work but is outside CI coverage)

## Key features

### Passive (always on)

- **Hover**: symbol type / value / declaration excerpt / doc comment / struct size and field offsets
- **Signature help**: shows function argument signature, types, and docs
- **Document highlight**: highlights the symbol at cursor position and related tokens for `return` / `for` / `switch`
- **Inlay hint** (experimental): annotations for struct field names, function argument names, type arguments
- **Semantic tokens**: semantic highlighting that distinguishes functions from types
- **Document link**: links URLs in doc comments and `import` statements (to pkg.go.dev)

### Diagnostics

- Compile errors (`go list` metadata + compiler frontend equivalent)
- Go analysis framework (equivalent to `go vet`)
- **staticcheck integration** (enabled via `ui.diagnostic.staticcheck: true`, treated as experimental)

### Navigation

- Go-to-definition / type definition / find references / implementations
- Document symbol / workspace symbol
- Call hierarchy / type hierarchy

### Code transformation

- Formatting (`gofmt`-based, switchable to `gofumpt`)
- **Rename** (with shadowing and interface conformance checks, supports embedded fields)
- **Organize imports**: removes unused, adds missing, and sorts
- **Extract**: function / method / variable / constant / "extract to new file"
- **Inline**: inline call / inline variable
- **Refactor.rewrite**: remove unused parameters, swap arguments, string-quote conversion, invert `if`, split/join lines, struct/switch fill
- **Modernize**: automatic upgrades to newer Go syntax / standard APIs (e.g., replacing with `strings.Cut`, `new(expr)` syntax)

### Codelens

- Run tests
- `go generate`
- `regenerate cgo`
- `run_govulncheck` (added by default in v0.21+)

## Key settings (VS Code `"gopls": {}`)

| Key | Default | Purpose |
|---|---|---|
| `ui.semanticTokens` | `false` | Enable semantic tokens |
| `ui.codelenses` | `{...}` | Toggle individual code lenses on/off |
| `ui.completion.usePlaceholders` | `false` | Expand placeholders for function args / struct fields |
| `ui.diagnostic.staticcheck` | `false` | staticcheck integration |
| `ui.diagnostic.analyses` | `{}` | Toggle individual analyzers on/off |
| `ui.inlayHint.hints` | `{}` | Select which inlay hint items to show |
| `formatting.gofumpt` | `false` | Use gofumpt as the formatter |
| `formatting.local` | `""` | Prefix equivalent to goimports `-local` |
| `build.directoryFilters` | `["-**/node_modules"]` | Workspace include/exclude (`-` excludes all, `+pkg` includes individually) |
| `build.buildFlags` | `[]` | Flags passed to `go list` etc. (e.g., `-tags`) |
| `build.env` | `{}` | Additional env vars for external command invocations |
| `expandWorkspaceToModule` | `true` | Workspace package detection |

### VS Code settings example

```jsonc
"gopls": {
  "ui.diagnostic.staticcheck": true,
  "ui.completion.usePlaceholders": true,
  "ui.codelenses": {
    "run_govulncheck": true,
    "test": true
  },
  "ui.inlayHint.hints": {
    "assignVariableTypes": true,
    "compositeLiteralFields": true,
    "constantValues": true,
    "functionTypeParameters": true,
    "parameterNames": true,
    "rangeVariableTypes": true
  },
  "formatting.gofumpt": true,
  "formatting.local": "github.com/your-org",
  "build.directoryFilters": ["-**/node_modules", "-**/vendor"]
}
```

## Editor integrations

| Editor | Integration method |
|---|---|
| VS Code | Go extension (auto-installs) |
| Neovim | `gopls` preset in `nvim-lspconfig` |
| Vim | `vim-lsp` / `coc.nvim` |
| Helix | Supported out of the box (no `languages.toml` needed) |
| Zed | Supported out of the box |
| Emacs | `lsp-mode` / `eglot` |
| Sublime Text | `LSP-gopls` package |

## Workspaces

- **Assumes operation within a module containing `go.mod`**. GOPATH mode and standalone files are only partially supported
- **Recognizes `go.work`** and works across multi-module workspaces
- **Vendored modules** can be read as-is
- v0.20+ enables **persistent index** by default, improving startup and completion in large workspaces

## Troubleshooting

### gopls won't start

Check that `$GOPATH/bin` is on PATH and that `go install golang.org/x/tools/gopls@latest` succeeded. Verify the actual path with `go env GOPATH`.

### Completion is slow / high memory usage

- Exclude `vendor` / large generated code via `build.directoryFilters`
- Shrink the workspace scope (use `go.work` to include only necessary modules)
- gopls automatically dumps debug info once memory usage exceeds 1 GB

### Imports aren't organized automatically

- Set `formatting.gofumpt: true` to apply gofumpt's rules
- Use `formatting.local` to group your organization's prefix last

### Debugging LSP communication

```bash
gopls -logfile=/tmp/gopls.log -rpc.trace serve
```

`-rpc.trace` outputs detailed LSP messages.

## Recent changes (v0.20-0.21)

- **v0.20**: experimental embedded MCP (Model Context Protocol) server, Split Package refactor, expanded `unusedfunc` analyzer, embedded field rename, persistent index enabled by default
- **v0.21**: Hover reports info for partial expressions within a selection, modernize analyzer supports `strings.Cut` (1.25) / `new(expr)` (1.26) / new standard library iterator APIs, `run_govulncheck` added to default codelenses, package rename support

## Common mistakes AI agents make

1. **Starting gopls with an old Go version** — v0.18+ only supports the latest 2 major versions. Check with `go env GOVERSION` and update the toolchain if needed
2. **Trying to install gopls in GoLand** — JetBrains uses its own plugin; gopls is unnecessary there
3. **Leaving `formatting.local` empty** — standard library and your organization's modules end up in the same import group. Set it to `github.com/your-org`
4. **Not enabling staticcheck integration and double-checking with golangci-lint instead** — enabling gopls's `ui.diagnostic.staticcheck: true` surfaces warnings in the IDE for a faster fix cycle
5. **Opening a huge monorepo without configuring `build.directoryFilters`** — wastes memory and CPU. Decide exclusion patterns up front

## References

- [gopls README](https://github.com/golang/tools/blob/master/gopls/README.md)
- [Settings reference](https://github.com/golang/tools/blob/master/gopls/doc/settings.md)
- [Features overview](https://github.com/golang/tools/blob/master/gopls/doc/features/index.md)
- [Troubleshooting](https://github.com/golang/tools/blob/master/gopls/doc/troubleshooting.md)
- [Release notes](https://go.dev/gopls/release/)
