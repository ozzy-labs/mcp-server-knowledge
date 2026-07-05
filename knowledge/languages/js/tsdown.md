---
reviewed: 2026-06-28
tags: [build, package, typescript]
---

# tsdown

A TypeScript library build tool based on Rolldown (a Rust-based bundler) + Oxc. Developed by the Rolldown team as the de facto successor to `tsup`. ESM-first, with built-in automatic `.d.ts` generation and code splitting.

Official: [tsdown.dev](https://tsdown.dev/)

## Positioning

- Specialized for generating `dist/` output for libraries/CLI packages
- Not typically used for the final bundle of applications (web / Node servers) — use Vite / Rolldown / esbuild directly for that
- As of 2026-06, v0.22.3 (latest, released 2026-06-16). v0.22.0 (2026-05-07) introduced breaking changes such as Node support requirements. Since **minor updates below 1.0 can include breaking changes**, pin the version strictly.

## Installation

```bash
pnpm add -D tsdown
```

Requires Node 22.18.0 or later (v0.22.0 dropped Node 20 / 23 support; `engines.node` is `^22.18.0 || >=24.11.0`). Bun / Deno have experimental support. Note that the output `target` can be lowered separately, so consumers of the build output can still run on Node below 22.

## Minimal configuration

```ts
// tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
});
```

`package.json`:

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  }
}
```

If the `types` / `typings` field in `package.json`, or `compilerOptions.declaration: true` in `tsconfig.json`, is set, `--dts` is enabled automatically (tsconfig integration was added in v0.22.0).

## Key CLI flags

| Flag | Purpose |
|---|---|
| `--watch` / `-w` | Rebuild on file change |
| `--dts` | Output `.d.ts` (automatic if the `types` field is present) |
| `--format esm,cjs` | Output format(s). `esm` / `cjs` / `iife` / `umd`. Default `esm` |
| `--minify` | Minify output |
| `--clean` | Delete the output directory before building (default `true`) |
| `--target` | JS target. Auto-detected from `engines.node` |
| `--sourcemap` | Output sourcemaps |
| `--tsconfig <path>` | Explicitly specify which tsconfig to use |

## Configuration options (representative)

```ts
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    cli: './src/cli.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: false,
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  plugins: [],  // unplugin-compatible plugins
});
```

`plugins` accepts unplugin / Rolldown plugins. Passing an esbuild plugin as-is causes an error.

## Migrating from tsup

An official migration guide exists, and most settings are compatible. An automatic migration script is also available:

```bash
npx tsdown-migrate
npx tsdown-migrate 'packages/*'  # monorepo
```

Key differences:

| Item | tsup | tsdown |
|---|---|---|
| Engine | esbuild | Rolldown (Rust) + Oxc |
| Default `format` | `cjs` | `esm` |
| Default `clean` | `false` | `true` |
| `dts` default | `false` | Automatic via `types` field |
| `cjsInterop` | ✓ | Renamed to `cjsDefault` |
| `esbuildPlugins` | ✓ | `plugins` (assumes unplugin) |
| Code splitting | Optional | Always on (cannot be disabled) |
| Development status | Maintenance stopped (tsdown recommended) | Active |

`splitting: false` / `metafile` / `swc` / `experimentalDts` have no corresponding option in tsdown.

## Pitfalls

### Minor updates are breaking because it's v0.x

```json
{ "devDependencies": { "tsdown": "0.22.3" } }
```

**Strict pinning** like this is recommended. `^` / `~` carry high risk.

### esbuild plugin assets can't be used

They must be rewritten as unplugin. Projects with a lot of tsup assets should estimate the migration cost.

### Output path is not fixed to `dist/`

It can be changed via `outDir`, but it's easy to forget to keep it consistent with the `exports` field.

## Common mistakes AI agents make

1. **Forgetting `format: 'cjs'`, breaking CJS consumers** — if you want to support both, explicitly specify `format: ['esm', 'cjs']`.
2. **Not knowing the `clean: true` default, mistakenly thinking stale files remain** — writing `clean: false` out of tsup habit lets old output pile up.
3. **Not importing unplugin for Rolldown** — use `unplugin-foo/rolldown` instead of `unplugin-foo/esbuild`.
4. **Pinning with `^0.22.0` and breaking CI** — since 0.x allows breaking changes between minor versions, don't use `^` (indeed, v0.22.0 dropped Node 20 / 23 support).

## Comparison with other tools

| Tool | Target | Notes |
|---|---|---|
| tsdown | Library output | ESM-first, newer, active |
| tsup | Library output | esbuild-based, effectively unmaintained |
| tshy | Library output | Specialized for dual ESM/CJS, leans zero-config |
| unbuild | Library output | Rollup + esbuild, config-file centric |
| Vite | Applications | Focused on dev server + HMR |
| esbuild directly | Either | Fast, but dts must be handled separately |

## References

- [tsdown official documentation](https://tsdown.dev/)
- [Getting Started](https://tsdown.dev/guide/getting-started)
- [Migrating from tsup](https://tsdown.dev/guide/migrate-from-tsup)
- [GitHub: rolldown/tsdown](https://github.com/rolldown/tsdown)
