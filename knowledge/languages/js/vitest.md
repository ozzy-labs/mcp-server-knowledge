---
reviewed: 2026-06-28
tags: [test, javascript, typescript]
---

# Vitest

Vite ネイティブの高速テストランナー。Jest 互換の API で ESM・TypeScript・JSX をネイティブに扱える。HMR ベースの watch モードが特徴。

公式: [vitest.dev](https://vitest.dev/)

## インストール

```bash
pnpm add -D vitest
```

Vite を使っていないプロジェクトでも単独で動く（内部で esbuild 経由）。

## 最小セットアップ

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

- `vitest` のみ（引数なし）は watch モード
- `vitest run` で 1 回実行（CI 用）
- `vitest --coverage` でカバレッジ（別途 `@vitest/coverage-v8` または `@vitest/coverage-istanbul` が必要）

## 最小テスト

```ts
import { describe, it, expect } from "vitest";

describe("add", () => {
  it("sums two numbers", () => {
    expect(1 + 2).toBe(3);
  });
});
```

`import ... from "vitest"` で必要な API を取る（Jest と違いグローバル注入はデフォルト無効）。

## 主要 API

| API | 用途 |
|---|---|
| `describe(name, fn)` | テストグループ |
| `it` / `test` | 個別ケース |
| `expect(actual).toBe(x)` | 厳密等価 |
| `expect(actual).toEqual(x)` | 構造等価 |
| `expect.soft(...)` | 失敗しても後続テスト継続 |
| `beforeAll` / `afterAll` / `beforeEach` / `afterEach` | フック |
| `vi.mock(module, factory?)` | モジュールモック |
| `vi.fn()` / `vi.spyOn()` | 関数モック |
| `vi.useFakeTimers()` | タイマー制御 |
| `it.skip` / `it.only` / `it.todo` | 選択的実行 |
| `it.concurrent` | ファイル内並列 |
| `it.each` | パラメータ化 |

## 設定 `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",          // "jsdom" | "happy-dom" | "edge-runtime"
    include: ["tests/**/*.test.ts"],
    globals: false,                // true なら describe/it をグローバルに
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

Vite 設定と共存する場合は `vite.config.ts` に `test` フィールドを追加してもよい（triple-slash reference を入れる）:

```ts
/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  test: { /* ... */ },
});
```

## モック

### モジュールモック

```ts
import { vi } from "vitest";

vi.mock("./fs", () => ({
  readFile: vi.fn(() => Promise.resolve("mocked")),
}));

// 部分モック
vi.mock("./fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./fs")>()),
  readFile: vi.fn(),
}));
```

### 関数モック

```ts
const fn = vi.fn((x: number) => x * 2);
fn(3);
expect(fn).toHaveBeenCalledWith(3);
expect(fn).toHaveReturnedWith(6);
```

### タイマー

```ts
vi.useFakeTimers();
setTimeout(cb, 1000);
vi.advanceTimersByTime(1000);
expect(cb).toHaveBeenCalled();
vi.useRealTimers();
```

## スナップショット

```ts
expect(obj).toMatchSnapshot();
expect(obj).toMatchInlineSnapshot(`{ "foo": "bar" }`);
```

更新: `vitest -u` または `vitest --update`。

## Jest からの移行

| Jest | Vitest |
|---|---|
| `jest.fn()` | `vi.fn()` |
| `jest.mock()` | `vi.mock()` |
| `jest.spyOn()` | `vi.spyOn()` |
| `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| `--watch` | デフォルトで watch |
| `--runInBand` | `--max-workers=1`（`maxWorkers: 1, isolate: false`） |

`globals: true` を設定すれば `describe` / `it` をインポートなしで使える（Jest の挙動に近い）。

## ベンチマーク

```ts
import { bench, describe } from "vitest";

describe("sort", () => {
  bench("arr.sort", () => {
    [3, 1, 2].sort();
  });
});
```

`vitest bench` で実行。

## コマンドラインフラグ

| フラグ | 用途 |
|---|---|
| `--run` | watch なしで 1 回実行 |
| `--reporter=verbose` | 詳細レポート |
| `-t "<pattern>"` | テスト名フィルタ |
| `--coverage` | カバレッジ有効化 |
| `--pool=threads` / `--pool=forks` | 並列実行モード |
| `--bail=1` | 最初の失敗で停止 |
| `--browser` | ブラウザ環境でテスト |

## トラブルシュート

### ESM / CJS の混在

Vitest は ESM がデフォルト。CJS のみのライブラリは `deps.optimizer.web.include` 等で変換対象に入れる。`package.json` に `"type": "module"` がない場合は `.mts` / `.cts` で明示。

### `ReferenceError: describe is not defined`

`globals: false` がデフォルト（v3/v4）。`import { describe } from "vitest"` を書くか、`test.globals = true` を設定。

### `vi.mock` が効かない

`vi.mock` は**ファイル先頭にホイスト**される。動的に mock する場合は `vi.hoisted(() => ...)` を使う:

```ts
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock("./m", () => ({ f: mockFn }));
```

### MCP サーバーのテスト

`InMemoryTransport` で in-process 結合テストが書ける（`ai/platform/mcp-typescript-sdk.md` 参照）。Vitest + `@modelcontextprotocol/sdk` の組み合わせが標準。

## Jest / Mocha との比較

| 観点 | Vitest | Jest | Mocha |
|---|---|---|---|
| ESM 対応 | ネイティブ | 実験的 | 要ツール |
| TypeScript | ネイティブ | `ts-jest` 必要 | `ts-node` 必要 |
| watch 速度 | 速い（HMR） | 普通 | 要 nodemon |
| 並列 | デフォルト | デフォルト | 要設定 |
| API 互換性 | Jest 互換 | — | 独自 |
