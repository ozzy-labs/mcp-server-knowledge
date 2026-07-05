---
reviewed: 2026-06-28
tags: [package, test, build, javascript, typescript, fast]
---

# Bun

An all-in-one toolkit for JavaScript / TypeScript. It bundles a **runtime, package manager, bundler, and test runner** into a single binary, aiming to be a drop-in replacement for Node.js. Written in Zig, it uses **JavaScriptCore** (developed by Apple for Safari) instead of V8 as its engine, giving it much faster process startup than Node.js.

As of 2026-06, the latest stable release is **1.3.14** (released 2026-05). Major versions have progressed as 1.0 (2023-09) → 1.1 (2024-04, Windows support + Bun Shell) → 1.2 (2025-01, text-based `bun.lock` as default + built-in S3/Postgres) → 1.3 (2025-10, built-in Redis + monorepo catalogs), with patches released irregularly at roughly 1-3 week intervals.

Official: [bun.com](https://bun.com) (the old [bun.sh](https://bun.sh) also still works) / [github.com/oven-sh/bun](https://github.com/oven-sh/bun)

## Installation

```bash
# Official installer (macOS / Linux)
curl -fsSL https://bun.com/install | bash
curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"   # pin a version

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# npm / Homebrew / Scoop
npm install -g bun
brew install oven-sh/bun/bun
scoop install bun
```

```bash
bun upgrade            # self-upgrade (stable)
bun upgrade --canary   # switch to per-commit canary builds (--stable to revert)
```

Supported platforms: macOS 13+, Linux (kernel 5.6+ recommended, glibc 2.17+; musl-based systems need a dedicated binary), Windows 10 1809+. Architectures: x64 / ARM64. `-baseline` builds are available for older CPUs.

## Basic Commands

| Command | Purpose | npm / other equivalent |
|---|---|---|
| `bun install` / `bun i` | Install dependencies | `npm install` |
| `bun add <pkg>` | Add a dependency (`--dev` / `-g` / `--exact`) | `npm install` |
| `bun remove <pkg>` | Remove a dependency | `npm uninstall` |
| `bun update` | Update dependencies | `npm update` |
| `bun run <script>` | Run a `package.json` script | `npm run` |
| `bun <file>` / `bun run <file>` | Run a TS/JS file | `node` |
| `bunx <pkg>` / `bun x` | Fetch and run a package ad hoc | `npx` |
| `bun test` | Run tests | `jest` / `vitest` |
| `bun build` | Bundle | `esbuild` / `tsup` |
| `bun init` | Scaffold a project | `npm init` |
| `bun pm` | lockfile / cache operations | — |

"Bare" execution without `run` (`bun index.ts`) behaves identically to `bun run`. Scripts respect the `pre<name>` / `post<name>` lifecycle hooks.

## Runtime

### Native TypeScript / JSX execution

`.ts` / `.tsx` / `.jsx` files run directly with no configuration. Files are transformed on the fly by Bun's fast transpiler right before execution (no type checking is performed — run `tsc --noEmit` separately for that).

```bash
bun run index.ts     # runs as-is with no transpile config needed
```

### Hot reload

| Flag | Behavior |
|---|---|
| `bun --watch <file>` | **Hard-restarts** the process on file changes (state is lost) |
| `bun --hot <file>` | Re-evaluates modules while keeping the process alive. Global state such as `globalThis` is preserved (can swap out HTTP server handlers without dropping the server) |

`--hot` is reload for server use cases, distinct from browser HMR.

### Automatic .env loading

`.env` files are loaded automatically (no `dotenv` needed). Load order is `.env` → `.env.{production,development,test}` (depending on `NODE_ENV`) → `.env.local`. Values are accessible via `process.env` / `Bun.env` / `import.meta.env`. An arbitrary file can be specified with `--env-file`.

### Node.js compatibility

Bun follows the policy that "if a package that works on Node.js doesn't work on Bun, it's a Bun bug," and runs the Node.js test suite before every release to close compatibility gaps. It supports `node:`-prefixed builtins such as `node:fs`, and most npm packages — including Next.js / Express — work. ESM and CommonJS can be mixed within the same file (`import` and `require` can always be used together; the exception is a synchronous `require()` of a module containing top-level await).

However, compatibility is not complete. `node:crypto` / `node:http2` / `node:worker_threads` are missing some APIs, and `node:repl` / `node:trace_events` are unimplemented. Notably, Node's standard `node:sqlite` is not implemented, but SQLite itself is still usable via Bun's own `bun:sqlite`. See [nodejs](nodejs.md) for details on the Node.js runtime.

## Bun-specific APIs

In addition to standard Web APIs, Bun provides natively-implemented, fast APIs under the `Bun.*` global.

| API | Purpose |
|---|---|
| `Bun.serve` | HTTP / WebSocket server. Declarative `routes` (with `:id` dynamic params, etc.) since v1.2.3+ |
| `Bun.file` / `Bun.write` | File I/O (lazily-loaded `BunFile`) |
| `bun:sqlite` | Built-in SQLite driver |
| `Bun.sql` | Built-in PostgreSQL client (SQL via tagged templates) |
| `Bun.redis` | Built-in Redis / Valkey client |
| `Bun.s3` | Built-in S3 client |
| `Bun.$` | Shell (Bun Shell; cross-platform, bash-like syntax) |
| `Bun.password` | Password hashing (argon2 / bcrypt) |
| `Bun.Glob` / `Bun.spawn` | Glob matching / child processes |

```ts
const server = Bun.serve({
  routes: {
    "/": new Response("Hello from Bun"),
    "/users/:id": (req) => Response.json({ id: req.params.id }),
  },
});
console.log(`Listening on ${server.url}`);
```

## Package Manager

`bun install` is an npm-compatible manager that produces `node_modules`; simply swapping it in for `npm install` gives a large speedup. It supports both `overrides` (npm) and `resolutions` (yarn).

Key flags:

| Flag | Meaning |
|---|---|
| `--frozen-lockfile` | Do not update the lockfile; error if it's inconsistent with `package.json` (required in CI). `bun ci` is an alias |
| `--production` / `--omit dev` | Exclude `devDependencies` |
| `--dev` / `-g` | Add as a dev dependency / globally (`bun add`) |
| `--linker hoisted\|isolated` | Choose the node_modules layout |
| `--filter <pattern>` | Apply to a subset of a workspace |

> **Note**: For security, lifecycle scripts such as `postinstall` in dependencies are **not run by default**. Packages you want to allow must be listed in `trustedDependencies` in `package.json`.

### bun.lock (text lockfile)

Since Bun 1.2, the default lockfile format is a **JSONC text file, `bun.lock`**. Git diffs are readable and merge conflicts are reduced. The pre-1.2 binary `bun.lockb` is still supported (no automatic migration). To migrate an existing project:

```bash
bun install --save-text-lockfile --frozen-lockfile --lockfile-only
rm bun.lockb
```

### node_modules layout

```bash
bun install --linker hoisted    # npm/yarn-style flattening
bun install --linker isolated   # pnpm-style (central store + symlinks, prevents phantom deps)
```

The default is `isolated` for monorepos / workspaces and `hoisted` for a single package. See [pnpm](pnpm.md) for details on pnpm's strict layout.

### workspaces and catalogs

Configure a monorepo via `workspaces` in `package.json`, and reference local packages with `workspace:*`. Common dependency versions can be centrally defined in the root's `catalog` / `catalogs`, and referenced from each package via the `catalog:` protocol (compatible with pnpm's catalog feature).

```json
{
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": { "react": "^19.0.0" }
  }
}
```

```json
{ "dependencies": { "react": "catalog:" } }
```

### bunx

`bunx <pkg>` (= `bun x`) is the npx equivalent. It prefers a local dependency if present, otherwise fetches from npm and runs it, caching the result in the global cache (`~/.bun/install/cache/`) for reuse. `bunx --bun <pkg>` ignores the target's Node shebang and runs it with the Bun runtime instead.

## Built-in Tools

### bun test

A fast, Jest-compatible test runner. Import `test` / `expect` / `mock` / `jest` etc. from `bun:test`. TS/JSX runs directly, and `*.test.ts` / `*.spec.ts` / `*_test.ts` files are auto-detected.

```bash
bun test                       # run all tests
bun test --watch               # watch for changes
bun test --coverage            # coverage (--coverage-reporter text|lcov)
bun test -t "user"             # filter by name
bun test -u                    # update snapshots
```

Mocking uses `mock(fn)` / `jest.fn()`, snapshots use `toMatchSnapshot()`, and hooks include `beforeAll` / `afterEach`, etc. GitHub Actions is auto-detected for annotations. See [vitest](vitest.md) for a Vite-based alternative.

### bun build and single-file executables

A native bundler. Choose `--target browser|bun|node` and `--format esm|cjs|iife`. `--compile` produces a **single executable with the runtime bundled in**.

```bash
bun build ./index.ts --outdir ./dist --target node
bun build ./cli.ts --compile --outfile mycli                 # single binary
bun build ./cli.ts --compile --target=bun-linux-arm64 --outfile mycli  # cross-compile
```

Use `--minify --sourcemap` for production, and `--bytecode` for faster startup. [tsdown](tsdown.md) is also an option for library builds.

### bun run --bun

`bun run --bun <script>` **forces local CLIs invoked by the script** (e.g. vite / next, which carry a `#!/usr/bin/env node` shebang) to run under the **Bun runtime** instead of Node. Monorepo execution supports `--filter` / `--parallel` / `--sequential`.

### bun init

```bash
bun init -y               # scaffold with no prompts
bun init --react=tailwind # React + Tailwind template
```

Generates `package.json` / `tsconfig.json` / an entry point / `.gitignore`, and installs `@types/bun`. It's non-destructive, so it's safe to rerun.

## TypeScript Configuration

Install types for Bun's built-in APIs via `@types/bun`:

```bash
bun add -d @types/bun
```

Recommended `compilerOptions` in `tsconfig.json` include `"types": ["bun"]`, `"module": "Preserve"`, `"moduleResolution": "bundler"`, `"allowImportingTsExtensions": true`, `"noEmit": true`, etc. (auto-generated by `bun init`). See [typescript-esm](typescript-esm.md) for ESM pitfalls.

## Docker

The official image is [`oven/bun`](https://hub.docker.com/r/oven/bun). Pin to a major version.

```dockerfile
FROM oven/bun:1
WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
USER bun
ENTRYPOINT ["bun", "run", "index.ts"]
```

Exclude `node_modules` via `.dockerignore`. See [docker](../../platforms/docker/docker.md) for Docker in general.

## Common AI Agent Mistakes

1. **Guessing `npm` / `pnpm` commands** — use `bun install` in a Bun repository. The lockfile format (`bun.lock`) differs, and mixing them will break things.
2. **Assuming `bun.lockb`** — since 1.2 the default is the text-based `bun.lock`. Don't treat older articles' binary-lockfile assumption as current.
3. **Assuming `postinstall` runs** — it's disabled by default. Add the package to `trustedDependencies` if needed.
4. **Assuming full Node compatibility** — most things work, but `node:sqlite` and others are unimplemented. Use `bun:sqlite` for SQLite.
5. **Assuming `bun build` type-checks** — it only transpiles. Run `tsc --noEmit` separately for type checking.
6. **Letting CI update the lockfile** — pin it with `bun install --frozen-lockfile` (or `bun ci`).

## References

- Official docs: <https://bun.com/docs>
- Installation: <https://bun.com/docs/installation>
- Node.js compatibility: <https://bun.com/docs/runtime/nodejs-apis>
- Package manager: <https://bun.com/docs/cli/install>
- Bundler / single-file executables: <https://bun.com/docs/bundler/executables>
- Release notes: <https://github.com/oven-sh/bun/releases>
