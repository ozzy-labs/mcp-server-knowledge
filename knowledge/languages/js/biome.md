---
reviewed: 2026-06-28
tags: [lint, format, javascript, typescript, json, rust, fast]
---

# Biome

A fast JavaScript / TypeScript / JSON / CSS / GraphQL formatter + linter written in Rust. Aims to replace ESLint + Prettier with a single tool.

Official site: [biomejs.dev](https://biomejs.dev/)

## Installation

```bash
# Project-local (recommended)
pnpm add -D -E @biomejs/biome

# Global or version-managed
mise use biome@2

# Homebrew
brew install biome
```

Using `-E` (exact version) is officially recommended, since minor updates can change rules.

## Basic commands

| Command | Purpose |
|---|---|
| `biome check` | lint + format check (default, read-only) |
| `biome check --write` | Write auto-fixes |
| `biome check --write --unsafe` | Fixes that may include breaking changes |
| `biome format` | Format only |
| `biome lint` | Lint only |
| `biome ci` | CI-only mode (exits non-zero on failure) |
| `biome migrate eslint` | Convert an ESLint config to Biome |
| `biome migrate prettier` | Convert a Prettier config to Biome |

## Config file `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.1/schema.json",
  "files": {
    "includes": ["src/**", "tests/**", "*.json", "!**/node_modules", "!**/dist"],
    "ignoreUnknown": true
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "json": {
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": true
    }
  }
}
```

### Key fields

| Section | Description |
|---|---|
| `files.includes` | Target patterns (glob). Prefix with `!` to exclude |
| `files.ignoreUnknown` | Ignore unknown extensions |
| `formatter` | Format settings shared across all languages |
| `javascript` / `typescript` / `json` / `css` | Per-language overrides |
| `linter.rules` | Rule enablement. `recommended: true` applies the recommended set |
| `assist.actions.source.organizeImports` | Import sorting (moved from `organizeImports` under `assist` in v2; `biome migrate` converts automatically) |

### Rule severity

```json
{ "noConsole": "error" | "warn" | "info" | "off" }
```

All `recommended` rules are `error`. Override individual keys to weaken them.

### Suppressing per-file / per-block

```ts
// biome-ignore lint/suspicious/noExplicitAny: legacy API
function foo(x: any) {}

// biome-ignore-all lint/style/useConst: this file intentionally uses let
```

## Formatter characteristics

- Prettier-like but fast (Rust, parallel processing)
- `lineWidth` default is 80 → this repository uses 100
- Supports JSX / TSX
- `quoteStyle`: `"single"` / `"double"`
- `trailingCommas`: `"all"` / `"es5"` / `"none"`
- `semicolons`: `"always"` / `"asNeeded"`

## Lint rule categories

Major categories:

| Category | Content |
|---|---|
| `correctness` | Potential bugs (unused variables, syntax misuse) |
| `suspicious` | Suspicious but not necessarily wrong |
| `style` | Coding style |
| `complexity` | Complexity (unnecessary async, duplicate conditions, etc.) |
| `performance` | Performance (wasted allocations, etc.) |
| `security` | Security (dangerouslySetInnerHTML, etc.) |
| `a11y` | Accessibility (for JSX) |
| `nursery` | Experimental rules (not yet stable) |

## VS Code integration

Install the [Biome extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) + `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## lefthook / pre-commit integration

```yaml
pre-commit:
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json,jsonc}"
      run: biome check --write {staged_files}
      stage_fixed: true
```

`stage_fixed: true` re-stages files after auto-fixing.

## Using in CI

```yaml
- run: pnpm biome ci
```

`biome ci` does not auto-fix; it fails with a non-zero exit code if there are violations. It also supports GitHub Actions `reporter` format output.

## Comparison with ESLint / Prettier

| Aspect | Biome | ESLint + Prettier |
|---|---|---|
| Speed | ~10x faster (Rust) | Normal |
| Configuration | Single file | Two tools' worth |
| Plugins | None (built-in rules only) | Abundant |
| TypeScript | Native | Requires `@typescript-eslint` |
| JSX | Supported | Supported |
| Migration | Automatic via `biome migrate` | — |

**Biome's weakness**: Cannot use ESLint third-party plugins (e.g., `eslint-plugin-react-hooks`, the finer rules of `eslint-plugin-import`). You must check whether Biome's built-in rules cover equivalent functionality.

## Troubleshooting

### `biome check` produces no output

The pattern in `files.includes` may not be matching. Verify by specifying a path explicitly, e.g. `biome check --diagnostic-level=info src/`.

### Huge formatting diff on existing code

For the first application, run it in bulk on a separate branch → make it a standalone commit such as `docs: apply biome format`. Add the commit hash to `.git-blame-ignore-revs` to exclude it from `git blame`.

### Avoid using alongside Prettier

Conflicting formatting rules cause repeated round-trips on save. Fully migrate using `biome migrate prettier`.
