---
reviewed: 2026-05-04
tags: [javascript]
---

# Node.js

JavaScript のサーバーサイドランタイム。本記事は**ランタイム本体・内蔵モジュール・実行フラグ**を対象にする。TypeScript を ESM で動かすための tsconfig / 依存解決の細部は `languages/typescript-esm.md` を参照。

公式: [nodejs.org/api](https://nodejs.org/api/) / [release schedule](https://github.com/nodejs/Release)

## バージョンと LTS ポリシー

| 系列 | コード名 | 2026-05 時点のフェーズ | EOL |
|---|---|---|---|
| 25.x | - | Current（偶数まで中継） | 2026-06 |
| 24.x | Krypton | **Active LTS** | 2028-04 |
| 22.x | Jod | Maintenance LTS | 2027-04 |
| 20.x | Iron | **EOL**（2026-04-30 到達） | 2026-04-30 |
| 18.x | Hydrogen | EOL | 2025-04 |

- **偶数メジャーのみ LTS 対象**、奇数は Current として 6 ヶ月のみ。
- LTS は Active 12 ヶ月 + Maintenance 18 ヶ月 = 合計 30 ヶ月。
- 本番は Active LTS (v24) か Maintenance LTS (v22)。v20 は 2026-04-30 で EOL を迎えたため、まだ残っていれば即時移行する。
- `engines.node` は**サポート対象の最小バージョン**を書く: `"node": ">=22"`。

## インストール / バージョン管理

| 方法 | 用途 |
|---|---|
| 公式バイナリ / Docker Hub `node:24-alpine` | 本番・CI の固定インストール |
| `mise` | 多言語対応。`.mise.toml` でプロジェクト固定 |
| `fnm` | Rust 製、クロスプラットフォーム |
| `nvm` | macOS/Linux のデファクト（Windows は非対応） |
| Volta | `package.json` の `volta` キーにピン留め |

`corepack` は Node 同梱で `pnpm` / `yarn` のバージョン固定に使う（`package.json` の `packageManager` フィールド）。

## `node:` プロトコル

組み込みモジュールは**必ず `node:` プレフィックス**で import する。

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
```

理由:

- ユーザーランドの同名パッケージ（`path`, `url`, `events`, `stream` など npm に存在）との衝突防止
- Permission Model / Loader hooks で builtin を明示的に区別
- ブラウザ互換の import map との整合

## CJS / ESM 相互運用（ランタイム観点）

- `package.json` の `"type": "module"` で `.js` が ESM 解釈になる。`.mjs` は常に ESM、`.cjs` は常に CJS。
- **`require(ESM)`**: v22.12 と v20.19 で `--experimental-require-module` がデフォルト ON 化し、**2026-05 時点で stable**。CJS から `require('./foo.mjs')` が可能。
- **制約**: `require(ESM)` は同期ゆえ **top-level `await` を含む ESM には不可**（`ERR_REQUIRE_ASYNC_MODULE`）。その場合は `await import()` を使う。
- **`createRequire`**: ESM から CJS を読むとき。

  ```ts
  import { createRequire } from "node:module";
  const require = createRequire(import.meta.url);
  const pkg = require("./legacy.cjs");
  ```

- **`--experimental-detect-module`** (v22.7+、デフォルト ON): 拡張子なしファイルを構文から CJS/ESM 自動判定。無効化は `--no-experimental-detect-module`。

## 主要内蔵モジュール

| モジュール | 用途 |
|---|---|
| `node:fs/promises` | Promise ベース FS。同期版 (`node:fs`) は起動時以外避ける |
| `node:path` | OS 依存パス。`join` / `resolve` / `sep` / `posix` |
| `node:url` | `fileURLToPath(import.meta.url)` で ESM から実パスへ |
| `node:crypto` | `createHash` / HMAC / `randomUUID()` / `subtle`（WebCrypto） |
| `node:stream` | Readable/Writable/Duplex、`pipeline` は promises 版が主流 |
| `node:events` | `EventEmitter` / `once` / `on` 非同期イテレータ / `AbortSignal` |
| `node:child_process` | `spawn`（ストリーミング）／`exec`（一括）／`fork` |
| `node:worker_threads` | CPU バウンド並列、`MessageChannel`、`workerData` |
| `node:http` / `node:https` | 低レベル HTTP。汎用クライアントはグローバル `fetch` |
| `node:os` | `platform` / `arch` / `cpus` / `homedir` / `tmpdir` / `EOL` |
| `node:util` | `parseArgs`（CLI 引数）/ `promisify` / `styleText` |

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

- v20 で Stable、v22.3 で snapshot、v23 以降で mocking 拡充。
- 実行: `node --test` / `node --test --watch` / `node --test-name-pattern="adder"` / `--test-concurrency=N`。
- Coverage: `--experimental-test-coverage` + `--test-reporter=lcov`。
- `.ts` ファイルは Node 23.6+ の strip-types で直接走らせられる。
- vitest との使い分け: **小〜中規模 / CI 軽量 / zero-dep** なら `node:test`、UI / jsdom / Vite 連携 / リッチ mock なら `vitest`（`tools/vitest.md`）。

## 実行フラグ

| フラグ | 効果 / 状態 |
|---|---|
| `--watch` / `--watch-path=<p>` | ファイル変更で再起動（Stable） |
| `--env-file=<p>` / `--env-file-if-exists` | `.env` をロード。エスケープや multiline の扱いは dotenv と微妙に異なる |
| `--experimental-strip-types` | 型注釈を剥がして `.ts` を直接実行。v23.6 でデフォルト ON、v25.2 で Stable。型チェックなし |
| `--experimental-transform-types` | enum / parameter properties など**非消去構文**を変換（RC） |
| `--import <spec>` | 起動前に ESM をプリロード。`--experimental-loader` の後継 |
| `--conditions=<name>` | `package.json` の `exports` に独自条件を追加（Stable v22.9+） |
| `--cpu-prof` / `--heap-prof` | 起動時プロファイリング |
| `--inspect` / `--inspect-brk` | Chrome DevTools で接続 |
| `--no-warnings` | プロセス warning を抑制 |

## Permission Model

v22.13 / v23.5 で **Stable** 化した実験的サンドボックス。

```bash
node --permission \
  --allow-fs-read=/app \
  --allow-fs-write=/app/logs \
  --allow-net \
  server.js
```

- `--allow-fs-read` / `--allow-fs-write`: ワイルドカード可、`*` で全許可。
- `--allow-child-process` / `--allow-worker` / `--allow-addons` / `--allow-wasi`: それぞれ個別許可。
- ランタイム確認: `process.permission.has("fs.write", "/path")`。
- **制約**: Worker Thread に**継承されない**、既存 fd 経由はバイパス、symlink 追従でポリシーを迂回される可能性、native addons / SQLite はロード不可。サンドボックスに期待しすぎない。

## Web 標準 API（グローバル）

| API | 導入 | 備考 |
|---|---|---|
| `fetch` | v18（Stable v21） | `undici` ベース |
| `AbortController` / `AbortSignal` | v15 / グローバル v18 | `fetch` / `fs/promises` / `timers/promises` に `signal` 渡し |
| `AbortSignal.timeout(ms)` | v17.3 | タイムアウト用の定番 |
| `globalThis.crypto` / `crypto.subtle` | v19 | WebCrypto API |
| `randomUUID()` | v19 グローバル | `crypto.randomUUID()` |
| `Blob` / `File` / `FormData` | v18 | グローバル利用可 |
| `structuredClone` | v17 | deep clone |

## Streams と Web Streams

- Node Streams と WHATWG Streams の相互変換:
  - `Readable.toWeb(nodeReadable)` / `Readable.fromWeb(webStream)`
  - `Writable.toWeb/fromWeb`, `Duplex.toWeb/fromWeb`
- `fetch` レスポンスの body は Web `ReadableStream`。`Readable.fromWeb(response.body)` で Node ストリームに変換可能。
- **推奨パターン**: `node:stream/promises` の `pipeline()`。`AbortSignal` 対応、async generator を中間段に挟める。

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

AbortSignal 対応で、コールバックが不要になる。`setImmediate` / `scheduler.wait(ms)` も同様。

## Error handling

- **`unhandledRejection` は v15 以降デフォルト `throw`** に変更。未ハンドル Promise rejection はプロセスを落とす。変更は `--unhandled-rejections=strict|throw|warn|warn-with-error-code|none`。
- `process.on('uncaughtException', ...)` は同期例外。ハンドラを付けても exit 1 が既定。
- `Error.cause`（v16.9+）: `throw new Error("wrap", { cause: original });`。スタックトレースに `Caused by:` が出る。
- `AggregateError` (`Promise.any` の失敗集約): `.errors` に原因を保持。

## AI エージェントがよくやるミス

1. **ESM で `__dirname` / `__filename` を使う** — 未定義。`import.meta.dirname` / `import.meta.filename`（v20.11+）か `fileURLToPath(import.meta.url)`。
2. **ESM 内で直接 `require()`** — `createRequire(import.meta.url)` を経由するか `await import()`。
3. **builtin を `node:` なしで import** — 衝突リスク。常に `node:fs` 形式。
4. **同期 FS API をリクエストハンドラで多用** — イベントループ停止。`readFileSync` などは起動時の config 読みに限定。
5. **Windows パスを文字列結合** — `path.join` / `path.resolve` 必須。ファイル URL は `new URL("./data.json", import.meta.url)` か `fileURLToPath`。
6. **`process.env.FOO` を `string` と仮定** — 型は `string | undefined`。`Number(process.env.PORT)` は NaN の可能性、存在チェックと変換エラーを両方見る。
7. **Stream の backpressure を無視** — `pipeline()` を使えば自動吸収。`for await (const chunk)` ループに書き込み先 `await` を挟まないとメモリ爆発。
8. **`child_process.exec` で大量出力** — デフォルト maxBuffer 1MB で切れる。`spawn` + streaming に。
9. **`JSON.parse` に try/catch なし** — 外部入力は必ず囲む。`util.parseArgs` など安全な代替を優先。
10. **`unhandledRejection` が warn で済むと思う** — v15+ は throw。意図的に無視するなら `--unhandled-rejections=warn` を明示。
11. **長時間 `fetch` に signal を渡さない** — キャンセル不能。`AbortSignal.timeout(ms)` を使う。
12. **`process.argv[0]` をスクリプトだと思う** — `argv[0]` は node 自身、`argv[1]` がスクリプト。ユーザ引数は `argv.slice(2)` か `util.parseArgs`。
13. **Permission Model 下で Worker を起動** — 権限は継承されない。Worker 用に別途設計する。
14. **`require(ESM)` で top-level await 付きを同期読み** — `ERR_REQUIRE_ASYNC_MODULE`。`await import()` に変える。

## トラブルシュート

### `ERR_MODULE_NOT_FOUND` / `ERR_UNSUPPORTED_DIR_IMPORT`

ESM では拡張子必須、ディレクトリ import 不可。`./util` → `./util.js` に、`./dir` → `./dir/index.js` に明記。

### `ERR_REQUIRE_ESM` / `ERR_REQUIRE_ASYNC_MODULE`

CJS から ESM を同期 require している。v22.12+ なら普通の ESM は `require()` 可だが、top-level await 付きは不可。`await import()` に置き換える。

### `.env` の値が期待通り展開されない

`--env-file` の expansion は dotenv と完全互換ではない。複雑な `${VAR}` 補間や multiline が必要なら dotenv を残す。

### Permission Model でファイルが読めない

`--allow-fs-read=<path>` が不足。`process.permission.has("fs.read", path)` でランタイム判定、ログに不足パスを出すと絞り込みやすい。

### `node --watch` で無限リロード

監視対象のファイルを自身が書き換えているケース（ログファイル等）。`--watch-path` で絞るか、書き込み先を監視外ディレクトリに。

## 関連記事

- `languages/typescript-esm.md` — Node.js で TS を ESM として動かす設定・import type・デュアルパッケージ
- `tools/pnpm.md` — パッケージマネージャ（corepack 経由）
- `tools/vitest.md` — node:test との使い分け
- `tools/mise.md` — Node.js バージョン管理の現行デファクト

## 参考

- [Node.js API Reference](https://nodejs.org/api/)
- [Node.js Release Schedule](https://github.com/nodejs/Release)
- [Previous Releases / EOL](https://nodejs.org/en/about/previous-releases)
- [Modules: CommonJS modules](https://nodejs.org/api/modules.html)
- [Modules: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Test runner](https://nodejs.org/api/test.html)
- [Permissions](https://nodejs.org/api/permissions.html)
- [CLI options](https://nodejs.org/api/cli.html)
- [Stream](https://nodejs.org/api/stream.html)
