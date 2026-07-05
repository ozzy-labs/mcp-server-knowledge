---
reviewed: 2026-05-04
tags: [typescript, javascript]
---

# TypeScript + Node.js ESM

Key points and pitfalls for running TypeScript on Node.js as ECMAScript Modules (ESM). Focuses on the mistakes AI agents commonly make in projects migrating from CommonJS.

Official: [typescriptlang.org](https://www.typescriptlang.org/) / [Node.js ESM docs](https://nodejs.org/api/esm.html)

## Determining: ESM or CommonJS?

```bash
# Check whether the project is ESM or CJS
cat package.json | grep '"type"'
```

- `"type": "module"` → ESM (`.js` is ESM; only `.cjs` is CJS)
- `"type": "commonjs"` or unspecified → CJS (`.js` is CJS; only `.mjs` is ESM)

**This setup assumes ESM.**

## Minimal `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### Important fields

| Field | Recommended value | Reason |
|---|---|---|
| `module` | `"NodeNext"` | Switches between ESM/CJS following `package.json`'s `type` |
| `moduleResolution` | `"NodeNext"` | Same; conforms to Node.js resolution rules |
| `target` | `"ES2024"` or later | Available on Node 20+ |
| `strict` | `true` | Enables the full set of strict type checks |
| `esModuleInterop` | `true` | Fixes up default imports from CJS modules |
| `skipLibCheck` | `true` | Ignores errors in third-party types (faster build) |
| `declaration` / `declarationMap` | `true` | For library use; enables completion and goto-def for consumers |
| `verbatimModuleSyntax` | `true` (optional) | Forces `import type`, making runtime side-effect imports explicit |
| `rewriteRelativeImportExtensions` | `true` (optional, TS 5.7+) | Rewrites `./foo.ts` in TS source to `./foo.js` on output. Useful when you need both native Node execution and `tsc` builds |
| `erasableSyntaxOnly` | `true` (optional, TS 5.8+) | Errors on non-erasable syntax such as `enum` / `namespace`, keeping compatibility with Node's type-stripping execution |

### `module: "Node16"` / `"Node18"` / `"NodeNext"`

All are Node-family `module` values that support ESM/CJS interop.

| Value | Target | `require(ESM)` | JSON imports | Use case |
|---|---|---|---|---|
| `Node16` | Fixed to Node 16 era | Not supported | Not supported | When legacy compatibility is needed |
| `Node18` | Fixed to Node 18 era | Not supported | Supported (`with` required) | When you want to pin behavior to the Node 18 series |
| `NodeNext` | Follows the latest resolution rules | Supported | Supported (`with` required) | **Recommended as of 2026** |

With `require(ESM)` now stable on Node v22.12+/v24+, `NodeNext` is the default recommendation even for libraries. It ensures you don't miss the latest features, such as the `types` condition inside `exports`.

## Minimal `package.json`

```json
{
  "name": "my-pkg",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "engines": { "node": ">=20" }
}
```

## The biggest pitfall: adding the `.js` extension

In ESM, **you import using the runtime file name with a `.js` extension** (even in TS source!):

```ts
// Wrong (CJS/bundler-era style; fails to resolve under ESM)
import { foo } from "./utils";

// Correct (ESM. Refers to the TS file `utils.ts`, but written with .js)
import { foo } from "./utils.js";
```

**Reason**: TypeScript only looks at the source during type checking, but the Node.js runtime resolves by `.js`. Writing `.js` in the TS source, anticipating execution after compilation, is correct.

Aliases (`@/utils`) can be resolved via `paths` in `tsconfig.json`, but the Node runtime doesn't know about them. Unless you go through `tsc-alias` / `tsx` / a bundler, **relative paths + the `.js` extension** is the safest approach.

## `import type` / `export type`

Use `import type` for type-only imports:

```ts
import type { User } from "./types.js";
import { type User, getUser } from "./types.js";  // Mixing is also OK
```

Benefits:

- Removes type dependencies from runtime code (dead-code elimination)
- Avoids circular references
- With `verbatimModuleSyntax` on, strictly disallows unused runtime imports

## Consuming CJS libraries

`esModuleInterop: true` resolves most cases:

```ts
// Default export of a CJS package
import express from "express";  // OK with esModuleInterop

// CJS that doesn't expose named exports
import pkg from "legacy-cjs";
const { foo } = pkg;  // Destructure from the default
```

`require(ESM)` is **Stable** on Node v22.12/v24+. CJS code can `require()` an ordinary ESM package. However, ESM containing top-level `await` cannot be loaded synchronously and raises `ERR_REQUIRE_ASYNC_MODULE`; in that case, use `await import()`.

## Alternatives to `__dirname` / `__filename`

These globals don't exist under ESM:

```ts
// Stable: Node v24.0.0+ / v22.16.0+ (experimental since v21.2.0 / v20.11.0, stabilized in v24/v22.16)
const dir = import.meta.dirname;
const file = import.meta.filename;

// For earlier versions / schemes other than file:
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

`import.meta.dirname` / `filename` are only available for modules loaded via `file:` URLs. They are `undefined` for modules loaded via `data:` / `http:`.

## JSON imports

```ts
// Stable: Node v23.1.0+ / v22.12.0+ / v20.18.3+ / v18.20.5+
import pkg from "./package.json" with { type: "json" };
```

- The `with { type: "json" }` syntax (import attributes) is required. The old `assert { type: "json" }` is deprecated.
- Default export only; named imports are not allowed.
- TypeScript requires `resolveJsonModule: true`. `module: "NodeNext"` is needed to parse the attribute syntax.

## Development-time runtimes

`tsc --watch` is solid but requires a separate `node dist/index.js` to run. During development, any of the following are convenient:

| Tool | Characteristics |
|---|---|
| **Node built-in** | Type stripping is **Stable** as of v25.2+. Run directly with `node src/index.ts` (see below) |
| `tsx` | Zero-config direct execution of TS/ESM. `tsx src/index.ts` / `tsx watch`. Also supports non-erasable syntax like enums / decorators |
| `ts-node` | Established option. ESM support is somewhat quirky |
| `bun` | A separate runtime. TS-native |
| `deno` | A separate runtime. Has an npm-compatible mode |

`tsc` is the simplest choice for production builds. It's also common to type-check only with `tsc --noEmit` and bundle separately with `esbuild` / `rollup` / `tsup`.

### Native Node.js TypeScript execution (Stable as of v25.2+)

```bash
node src/index.ts                                 # Blanks out type annotations and runs (no type checking)
node --no-strip-types src/index.ts                # Disables type stripping
node --experimental-transform-types src/index.ts  # Transforms enum / namespace, etc.
```

- **Does not type-check** (use `tsc --noEmit` alongside it)
- **`tsconfig.json` is not read** (`paths` aliases don't work; use `#imports` instead)
- `.ts` files under `node_modules` cannot be executed
- `.tsx` is not supported
- Supported extensions: `.ts` / `.mts` / `.cts`
- `enum` / `namespace` / parameter properties require `--experimental-transform-types`

For compatibility, setting `erasableSyntaxOnly: true` / `rewriteRelativeImportExtensions: true` in `tsconfig.json` lets you run TS source directly and build with `tsc` side by side.

## Publishing both CJS and ESM (dual package)

When supporting both as a library:

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

Tools like `tsup` can emit a CJS build alongside. The type file (`.d.ts`) is often shared between both.

## Breakdown of the strict option

`"strict": true` enables the following all at once:

| Flag | Effect |
|---|---|
| `strictNullChecks` | Requires explicit `null` / `undefined` handling |
| `noImplicitAny` | Disallows `any` where type inference fails |
| `strictFunctionTypes` | Contravariant checking of function parameters |
| `strictBindCallApply` | Types `bind` / `call` / `apply` |
| `strictPropertyInitialization` | Enforces initialization of class properties |
| `noImplicitThis` | Disallows implicit `this: any` |
| `alwaysStrict` | Adds `"use strict"` plus lexical strict mode |
| `useUnknownInCatchVariables` | Types `catch (e)` as `unknown` |

Enabling all of them is the standard practice, rather than relaxing individual flags.

## Node.js support policy

`engines.node` should specify the **minimum supported version**:

```json
{ "engines": { "node": ">=20" } }
```

Node 18 reached EOL in 2025-04. As of 2026, the minimum baseline should be one of 20 / 22 / 24.

## Common mistakes AI agents make

1. **Relative imports without `.js`** — fails to resolve under ESM
2. **Using `import.meta` while `module: "CommonJS"` is still set** — runtime error
3. **Using import syntax without `"type": "module"` in package.json** — fails to start with `SyntaxError`
4. **Using `require()` inside ESM** — `ReferenceError`. Go through `createRequire` or switch to `import`
5. **Using `tsc`'s path aliases (`paths`) in production** — Node can't resolve them. Route through a bundler / `tsc-alias`
6. **Using `__dirname` under ESM** — undefined. Use `import.meta.dirname` instead

## Troubleshooting

### `ERR_MODULE_NOT_FOUND: Cannot find module '.../foo'`

Missing extension. Change `./foo` to `./foo.js`.

### `SyntaxError: Cannot use import statement outside a module`

`package.json` is missing `"type": "module"`. Add it.

### `Cannot find module 'foo' or its corresponding type declarations`

`@types/foo` is not installed, or the module doesn't ship type definitions. Either write `declare module "foo";` in a `.d.ts` file, or fall back to `any` (and add proper types later).

### `TypeError [ERR_REQUIRE_ESM]`

CJS code is `require()`-ing an ESM package. Use `import()` instead, or migrate the whole project to ESM.

### TypeScript type checks pass but the runtime crashes

A gap between the type system and the runtime. Typical causes are a missing `.js` extension, `paths` aliases, or insufficient typing of `process.env`. Catch these early with `vitest` or smoke tests.

## References

- [Node.js: Modules: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html)
- [TypeScript: Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [`verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax)
- [`rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig#rewriteRelativeImportExtensions)
- [`erasableSyntaxOnly`](https://www.typescriptlang.org/tsconfig#erasableSyntaxOnly)
