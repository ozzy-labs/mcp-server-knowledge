---
reviewed: 2026-05-04
tags: [javascript]
---

# Node.js

JavaScript's server-side runtime. This article covers **the runtime itself, built-in modules, and execution flags**. For tsconfig / dependency resolution details for running TypeScript as ESM, see `languages/typescript-esm.md`.

Official: [nodejs.org/api](https://nodejs.org/api/) / [release schedule](https://github.com/nodejs/Release)

## Versions and LTS policy

| Line | Codename | Phase as of 2026-05 | EOL |
|---|---|---|---|
| 25.x | - | Current (bridge to next even) | 2026-06 |
| 24.x | Krypton | **Active LTS** | 2028-04 |
| 22.x | Jod | Maintenance LTS | 2027-04 |
| 20.x | Iron | **EOL** (reached 2026-04-30) | 2026-04-30 |
| 18.x | Hydrogen | EOL | 2025-04 |

- **Only even majors get LTS**; odd majors are Current for 6 months only.
- LTS is Active for 12 months + Maintenance for 18 months = 30 months total.
- For production, use Active LTS (v24) or Maintenance LTS (v22). v20 reached EOL on 2026-04-30 — migrate immediately if still on it.
- `engines.node` should state the **minimum supported version**: `"node": ">=22"`.

## Installation / version management

| Method | Use case |
|---|---|
| Official binaries / Docker Hub `node:24-alpine` | Pinned installs for production/CI |
| `mise` | Multi-language. Project pinning via `.mise.toml` |
| `fnm` | Rust-based, cross-platform |
| `nvm` | De facto standard on macOS/Linux (no Windows support) |
| Volta | Pin via the `volta` key in `package.json` |

`corepack` ships with Node and is used to pin `pnpm` / `yarn` versions (the `packageManager` field in `package.json`).

## The `node:` protocol

Built-in modules **must** be imported with the `node:` prefix.

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
```

Reasons:

- Avoids collisions with userland packages of the same name (e.g. `path`, `url`, `events`, `stream` exist on npm)
- Lets the Permission Model / loader hooks explicitly distinguish builtins
- Aligns with browser-compatible import maps

## CJS / ESM interop (runtime perspective)

- `"type": "module"` in `package.json` makes `.js` resolve as ESM. `.mjs` is always ESM, `.cjs` is always CJS.
- **`require(ESM)`**: `--experimental-require-module` became the default ON in v22.12 and v20.19, and is **stable as of 2026-05**. CJS can now `require('./foo.mjs')`.
- **Constraint**: `require(ESM)` is synchronous, so it **cannot load ESM containing top-level `await`** (`ERR_REQUIRE_ASYNC_MODULE`). Use `await import()` in that case.
- **`createRequire`**: for reading CJS from ESM.

  ```ts
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const pkg = require("./legacy.cjs");
  ```

- **`--experimental-detect-module`** (v22.7+, default ON): auto-detects CJS/ESM from syntax for extensionless files. Disable with `--no-experimental-detect-module`.

## Key built-in modules

| Module | Use |
|---|---|
| `node:fs/promises` | Promise-based FS. Avoid the sync version (`node:fs`) except at startup |
| `node:path` | OS-dependent paths. `join` / `resolve` / `sep` / `posix` |
| `node:url` | `fileURLToPath(import.meta.url)` to get a real path from ESM |
| `node:crypto` | `createHash` / HMAC / `randomUUID()` / `subtle` (WebCrypto) |
| `node:stream` | Readable/Writable/Duplex; the promises version of `pipeline` is preferred |
| `node:events` | `EventEmitter` / `once` / `on` async iterator / `AbortSignal` |
| `node:child_process` | `spawn` (streaming) / `exec` (batch) / `fork` |
| `node:worker_threads` | CPU-bound parallelism, `MessageChannel`, `workerData` |
| `node:http` / `node:https` | Low-level HTTP. Use the global `fetch` for general-purpose clients |
| `node:os` | `platform` / `arch` / `cpus` / `homedir` / `tmpdir` / `EOL` |
| `node:util` | `parseArgs` (CLI args) / `promisify` / `styleText` |

## Built-in test runner: `node:test`

```ts
import { test, describe } from "node:test";
import assert from "node:assert/strict";

describe("adder", () => {
  test("1 + 2 = 3", () => {
    assert.strictEqual(1 + 2, 3);
  });

  test("mocked timers", (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    // ...
  });
});
```

- Stable since v20, snapshot support since v22.3, expanded mocking from v23 onward.
- Run with: `node --test` / `node --test --watch` / `node --test-name-pattern="adder"` / `--test-concurrency=N`.
- Coverage: `--experimental-test-coverage` + `--test-reporter=lcov`.
- `.ts` files can be run directly via strip-types support since Node 23.6+.
- Choosing between this and vitest: use `node:test` for **small-to-medium scale, lightweight CI, zero-dep** needs; use `vitest` (`languages/js/vitest.md`) for UI, jsdom, Vite integration, or rich mocking.

## Execution flags

| Flag | Effect / status |
|---|---|
| `--watch` / `--watch-path=<p>` | Restart on file change (Stable) |
| `--env-file=<p>` / `--env-file-if-exists` | Load `.env`. Escaping/multiline handling differs subtly from dotenv |
| `--experimental-strip-types` | Strips type annotations to run `.ts` directly. Default ON since v23.6, Stable since v25.2. No type checking |
| `--experimental-transform-types` | Transforms **non-erasable syntax** such as enums / parameter properties (RC) |
| `--import <spec>` | Preload ESM before startup. Successor to `--experimental-loader` |
| `--conditions=<name>` | Add custom conditions to `package.json`'s `exports` (Stable since v22.9+) |
| `--cpu-prof` / `--heap-prof` | Profiling at startup |
| `--inspect` / `--inspect-brk` | Connect via Chrome DevTools |
| `--no-warnings` | Suppress process warnings |

## Permission Model

An experimental sandbox that became **Stable** in v22.13 / v23.5.

```bash
node --permission \
  --allow-fs-read=/app \
  --allow-fs-write=/app/logs \
  --allow-net \
  server.js
```

- `--allow-fs-read` / `--allow-fs-write`: support wildcards; `*` allows everything.
- `--allow-child-process` / `--allow-worker` / `--allow-addons` / `--allow-wasi`: grant each individually.
- Check at runtime: `process.permission.has("fs.write", "/path")`.
- **Constraints**: permissions are **not inherited** by Worker Threads, can be bypassed via existing fds, may be circumvented by following symlinks, and native addons / SQLite cannot be loaded. Don't over-rely on this as a sandbox.

## Web standard APIs (global)

| API | Introduced | Notes |
|---|---|---|
| `fetch` | v18 (Stable v21) | Built on `undici` |
| `AbortController` / `AbortSignal` | v15 / global v18 | Pass `signal` to `fetch` / `fs/promises` / `timers/promises` |
| `AbortSignal.timeout(ms)` | v17.3 | Standard pattern for timeouts |
| `globalThis.crypto` / `crypto.subtle` | v19 | WebCrypto API |
| `randomUUID()` | v19 global | `crypto.randomUUID()` |
| `Blob` / `File` / `FormData` | v18 | Available globally |
| `structuredClone` | v17 | Deep clone |

## Streams and Web Streams

- Converting between Node Streams and WHATWG Streams:
  - `Readable.toWeb(nodeReadable)` / `Readable.fromWeb(webStream)`
  - `Writable.toWeb/fromWeb`, `Duplex.toWeb/fromWeb`
- A `fetch` response's body is a Web `ReadableStream`. Convert it to a Node stream with `Readable.fromWeb(response.body)`.
- **Recommended pattern**: `pipeline()` from `node:stream/promises`. Supports `AbortSignal` and lets you insert an async generator as an intermediate stage.

```ts
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { createGzip } from "node:zlib";

await pipeline(
  createReadStream("input.txt"),
  createGzip(),
  createWriteStream("input.txt.gz"),
);
```

## Timers Promises

```ts
import { setTimeout, setInterval } from "node:timers/promises";

await setTimeout(1000, null, { signal: controller.signal });

for await (const _ of setInterval(500, null, { signal })) {
  // periodic work
}
```

Supports `AbortSignal`, eliminating the need for callbacks. `setImmediate` / `scheduler.wait(ms)` work the same way.

## Error handling

- **`unhandledRejection` defaults to `throw` since v15**. An unhandled Promise rejection now crashes the process. Configure via `--unhandled-rejections=strict|throw|warn|warn-with-error-code|none`.
- `process.on('uncaughtException', ...)` handles synchronous exceptions. Even with a handler attached, exit code 1 is the default.
- `Error.cause` (v16.9+): `throw new Error("wrap", { cause: original });`. The stack trace shows `Caused by:`.
- `AggregateError` (aggregates failures from `Promise.any`): holds causes in `.errors`.

## Common mistakes made by AI agents

1. **Using `__dirname` / `__filename` in ESM** — undefined. Use `import.meta.dirname` / `import.meta.filename` (v20.11+) or `fileURLToPath(import.meta.url)`.
2. **Calling `require()` directly inside ESM** — go through `createRequire(import.meta.url)` or use `await import()`.
3. **Importing a builtin without the `node:` prefix** — collision risk. Always use the `node:fs` form.
4. **Overusing sync FS APIs in a request handler** — blocks the event loop. Limit `readFileSync` etc. to startup config reads.
5. **String-concatenating Windows paths** — use `path.join` / `path.resolve`. For file URLs, use `new URL("./data.json", import.meta.url)` or `fileURLToPath`.
6. **Assuming `process.env.FOO` is a `string`** — its type is `string | undefined`. `Number(process.env.PORT)` may yield NaN; check for both existence and conversion errors.
7. **Ignoring stream backpressure** — `pipeline()` absorbs this automatically. Without an `await` on the write side inside a `for await (const chunk)` loop, memory can blow up.
8. **Large output with `child_process.exec`** — truncated by the default 1MB maxBuffer. Use `spawn` with streaming instead.
9. **`JSON.parse` without try/catch** — always wrap parsing of external input. Prefer safer alternatives like `util.parseArgs` where applicable.
10. **Assuming `unhandledRejection` only warns** — it throws since v15+. If you intend to ignore it, set `--unhandled-rejections=warn` explicitly.
11. **Not passing a signal to a long-running `fetch`** — it becomes uncancellable. Use `AbortSignal.timeout(ms)`.
12. **Assuming `process.argv[0]` is the script** — `argv[0]` is node itself, `argv[1]` is the script. User arguments are `argv.slice(2)` or via `util.parseArgs`.
13. **Launching a Worker under the Permission Model** — permissions are not inherited. Design permissions separately for Workers.
14. **Synchronously `require`-ing ESM with top-level await** — `ERR_REQUIRE_ASYNC_MODULE`. Switch to `await import()`.

## Troubleshooting

### `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT`

ESM requires explicit extensions and does not support directory imports. Change `./util` to `./util.js`, and `./dir` to `./dir/index.js`.

### `ERR_REQUIRE_ESM` / `ERR_REQUIRE_ASYNC_MODULE`

CJS is synchronously requiring ESM. On v22.12+, normal ESM can be `require()`d, but modules with top-level await cannot. Replace with `await import()`.

### `.env` values don't expand as expected

`--env-file` expansion isn't fully compatible with dotenv. Keep dotenv if you need complex `${VAR}` interpolation or multiline values.

### Permission Model prevents a file from being read

`--allow-fs-read=<path>` is missing the path. Check at runtime with `process.permission.has("fs.read", path)`; logging the missing path helps narrow it down.

### Infinite reload loop with `node --watch`

Typically caused by the process itself writing to a watched file (e.g. a log file). Narrow scope with `--watch-path`, or write output to a directory outside the watch scope.

## Related articles

- `languages/typescript-esm.md` — Configuration for running TS as ESM on Node.js, import type, dual packages
- `languages/js/pnpm.md` — Package manager (via corepack)
- `languages/js/vitest.md` — Choosing between this and node:test
- `tools/mise.md` — Current de facto standard for Node.js version management

## References

- [Node.js API Reference](https://nodejs.org/api/)
- [Node.js Release Schedule](https://github.com/nodejs/Release)
- [Previous Releases / EOL](https://nodejs.org/en/about/previous-releases)
- [Modules: CommonJS modules](https://nodejs.org/api/modules.html)
- [Modules: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Test runner](https://nodejs.org/api/test.html)
- [Permissions](https://nodejs.org/api/permissions.html)
- [CLI options](https://nodejs.org/api/cli.html)
- [Stream](https://nodejs.org/api/stream.html)
