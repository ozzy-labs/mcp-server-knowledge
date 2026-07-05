---
reviewed: 2026-06-28
tags: [test, javascript, typescript]
---

# Vitest

A Vite-native, fast test runner. Handles ESM, TypeScript, and JSX natively with a Jest-compatible API. Notable for its HMR-based watch mode.

Official: [vitest.dev](https://vitest.dev/)

## Installation

```bash
pnpm add -D vitest
```

Works standalone even in projects that don't use Vite (via esbuild internally).

## Minimal setup

`package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^4.1.0"
  }
}
```

- `vitest` alone (no arguments) runs watch mode
- `vitest run` runs once (for CI)
- `vitest --coverage` enables coverage (requires `@vitest/coverage-v8` or `@vitest/coverage-istanbul` separately)

## Minimal test

```ts
import { describe, it, expect } from "vitest";

describe("add", () => {
  it("sums two numbers", () => {
    expect(1 + 2).toBe(3);
  });
});
```

Get the APIs you need via `import ... from "vitest"` (unlike Jest, global injection is disabled by default).

## Key APIs

| API | Purpose |
|---|---|
| `describe(name, fn)` | Test group |
| `it` / `test` | Individual case |
| `expect(actual).toBe(x)` | Strict equality |
| `expect(actual).toEqual(x)` | Structural equality |
| `expect.soft(...)` | Continue subsequent tests even on failure |
| `beforeAll` / `afterAll` / `beforeEach` / `afterEach` | Hooks |
| `vi.mock(module, factory?)` | Module mocking |
| `vi.fn()` / `vi.spyOn()` | Function mocking |
| `vi.useFakeTimers()` | Timer control |
| `it.skip` / `it.only` / `it.todo` | Selective execution |
| `it.concurrent` | Parallel within a file |
| `it.each` | Parameterization |

## Configuration: `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",          // "jsdom" | "happy-dom" | "edge-runtime"
    include: ["tests/**/*.test.ts"],
    globals: false,                // if true, exposes describe/it globally
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

If coexisting with a Vite config, you can also add a `test` field to `vite.config.ts` (add a triple-slash reference):

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: { /* ... */ },
});
```

## Mocking

### Module mocking

```ts
import { vi } from "vitest";

vi.mock("./fs", () => ({
  readFile: vi.fn(() => Promise.resolve("mocked")),
}));

// Partial mock
vi.mock("./fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fs")>()),
  readFile: vi.fn(),
}));
```

### Function mocking

```ts
const fn = vi.fn((x: number) => x * 2);
fn(3);
expect(fn).toHaveBeenCalledWith(3);
expect(fn).toHaveReturnedWith(6);
```

### Timers

```ts
vi.useFakeTimers();
setTimeout(cb, 1000);
vi.advanceTimersByTime(1000);
expect(cb).toHaveBeenCalled();
vi.useRealTimers();
```

## Snapshots

```ts
expect(obj).toMatchSnapshot();
expect(obj).toMatchInlineSnapshot(`{ "foo": "bar" }`);
```

To update: `vitest -u` or `vitest --update`.

## Migrating from Jest

| Jest | Vitest |
|---|---|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `--watch` | Watch mode by default |
| `--runInBand` | `--max-workers=1` (`maxWorkers: 1, isolate: false`) |

Setting `globals: true` lets you use `describe` / `it` without importing them (closer to Jest's behavior).

## Benchmarking

```ts
import { bench, describe } from "vitest";

describe("sort", () => {
  bench("arr.sort", () => {
    [3, 1, 2].sort();
  });
});
```

Run with `vitest bench`.

## Command-line flags

| Flag | Purpose |
|---|---|
| `--run` | Run once without watch |
| `--reporter=verbose` | Verbose report |
| `-t "<pattern>"` | Filter by test name |
| `--coverage` | Enable coverage |
| `--pool=threads` / `--pool=forks` | Parallel execution mode |
| `--bail=1` | Stop on first failure |
| `--browser` | Test in a browser environment |

## Troubleshooting

### Mixed ESM / CJS

Vitest defaults to ESM. Include CJS-only libraries in the transform target via `deps.optimizer.web.include` etc. If `package.json` lacks `"type": "module"`, be explicit with `.mts` / `.cts`.

### `ReferenceError: describe is not defined`

`globals: false` is the default (v3/v4). Either write `import { describe } from "vitest"` or set `test.globals = true`.

### `vi.mock` has no effect

`vi.mock` is **hoisted to the top of the file**. For dynamic mocking, use `vi.hoisted(() => ...)`:

```ts
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("./m", () => ({ f: mockFn }));
```

### Testing MCP servers

`InMemoryTransport` allows writing in-process integration tests (see `ai/platform/mcp-typescript-sdk.md`). Vitest + `@modelcontextprotocol/sdk` is the standard combination.

## Comparison with Jest / Mocha

| Aspect | Vitest | Jest | Mocha |
|---|---|---|---|
| ESM support | Native | Experimental | Requires tooling |
| TypeScript | Native | Requires `ts-jest` | Requires `ts-node` |
| Watch speed | Fast (HMR) | Normal | Requires nodemon |
| Parallelism | Default | Default | Requires configuration |
| API compatibility | Jest-compatible | — | Own API |
