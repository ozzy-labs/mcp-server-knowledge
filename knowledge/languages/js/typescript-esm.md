---
reviewed: 2026-05-04
tags: [typescript, javascript]
---

# TypeScript + Node.js ESM

Node.js で TypeScript を ECMAScript Modules（ESM）として動かすセットアップの要点と落とし穴。CommonJS から移行するプロジェクトで AI エージェントが誤りやすいポイントに重点を置く。

公式: [typescriptlang.org](https://www.typescriptlang.org/) / [Node.js ESM docs](https://nodejs.org/api/esm.html)

## 判定: ESM か CommonJS か

```bash
# プロジェクトが ESM か CJS か
cat package.json | grep '"type"'
```

- `"type": "module"` → ESM（`.js` は ESM、`.cjs` のみ CJS）
- `"type": "commonjs"` or 未指定 → CJS（`.js` は CJS、`.mjs` のみ ESM）

**本セットアップは ESM を前提とする**。

## 最小 `tsconfig.json`

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

### 重要フィールド

| フィールド | 推奨値 | 理由 |
|---|---|---|
| `module` | `"NodeNext"` | `package.json` の `type` に従って ESM/CJS を切り替え |
| `moduleResolution` | `"NodeNext"` | 同上。Node.js の解決規則に準拠 |
| `target` | `"ES2024"` or later | Node 20+ で利用可能 |
| `strict` | `true` | 厳格な型チェック全部入り |
| `esModuleInterop` | `true` | CJS モジュールの default import 補正 |
| `skipLibCheck` | `true` | サードパーティ型のエラーを無視（ビルド高速化） |
| `declaration` / `declarationMap` | `true` | ライブラリ用途。consumer 側で補完と goto-def が効く |
| `verbatimModuleSyntax` | `true`（任意） | `import type` を強制し、ランタイムの副作用 import を明示化 |
| `rewriteRelativeImportExtensions` | `true`（任意, TS 5.7+） | TS ソースの `./foo.ts` を出力時に `./foo.js` に書き換え。Node ネイティブ実行と `tsc` ビルドを両立させる時に有用 |
| `erasableSyntaxOnly` | `true`（任意, TS 5.8+） | enum / namespace など非消去構文をエラーにし、Node の型ストリップ実行と互換にする |

### `module: "Node16"` / `"Node18"` / `"NodeNext"`

いずれも ESM/CJS 相互運用に対応する Node 系列の `module` 値。

| 値 | ターゲット | `require(ESM)` | JSON imports | 用途 |
|---|---|---|---|---|
| `Node16` | Node 16 時点固定 | 不可 | 不可 | レガシー互換が必要な時 |
| `Node18` | Node 18 時点固定 | 不可 | 可（`with` 必須） | Node 18 系で挙動を固定したい時 |
| `NodeNext` | 最新解決規則を追従 | 可 | 可（`with` 必須） | **2026 時点の推奨** |

Node v22.12+ / v24+ で `require(ESM)` が stable になったため、ライブラリでも `NodeNext` がデフォルト推奨。`exports` 内の types 条件など最新機能を取りこぼさない。

## `package.json` 最小構成

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

## 最大の落とし穴: `.js` 拡張子をつける

ESM では**ランタイム上のファイル名に `.js` を付けてインポートする**（TS ソースでも!）:

```ts
// NG（CJS / bundler 時代の書き方、ESM では解決失敗）
import { foo } from "./utils";

// OK（ESM。TS ファイル `utils.ts` を参照していても .js）
import { foo } from "./utils.js";
```

**理由**: TypeScript は型チェック時にのみソースを見るが、Node.js ランタイムは `.js` で解決する。コンパイル後の実行を想定して TS ソースから `.js` で書くのが正。

エイリアス（`@/utils`）は `tsconfig.json` の `paths` で解決できるが、Node ランタイムはそれを知らない。`tsc-alias` / `tsx` / bundler を介さないなら**相対パス + `.js` 拡張子**が最も安全。

## `import type` / `export type`

型のみの import は `import type` を使う:

```ts
import type { User } from "./types.js";
import { type User, getUser } from "./types.js";  // 混在もOK
```

メリット:

- ランタイムコードから型依存が取り除かれる（dead-code elimination）
- 循環参照の回避
- `verbatimModuleSyntax` オンで未使用ランタイム import を厳格禁止

## CJS ライブラリの consume

`esModuleInterop: true` で多くは解決する:

```ts
// CJS パッケージの default export
import express from "express";  // OK with esModuleInterop

// named export が取れない CJS
import pkg from "legacy-cjs";
const { foo } = pkg;  // default の中から取り出す
```

Node v22.12 / v24+ で `require(ESM)` が **Stable**。CJS から普通の ESM パッケージを `require()` できる。ただし top-level `await` を含む ESM は同期読みできず `ERR_REQUIRE_ASYNC_MODULE` になるため、その場合は `await import()` を使う。

## `__dirname` / `__filename` の代替

ESM ではこれらのグローバルは存在しない:

```ts
// Stable: Node v24.0.0+ / v22.16.0+（v21.2.0 / v20.11.0 で実験導入、v24/v22.16 で安定化）
const dir = import.meta.dirname;
const file = import.meta.filename;

// それ以前 / file: 以外のスキーム
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

`import.meta.dirname` / `filename` は `file:` URL のモジュールでのみ利用可能。`data:` / `http:` 経由のロードでは `undefined`。

## JSON import

```ts
// Stable: Node v23.1.0+ / v22.12.0+ / v20.18.3+ / v18.20.5+
import pkg from "./package.json" with { type: "json" };
```

- `with { type: "json" }` 構文（import attributes）が必須。旧 `assert { type: "json" }` は非推奨。
- default export のみ。named import 不可。
- TypeScript は `resolveJsonModule: true` が必要。`module: "NodeNext"` で attribute 構文を解釈できる。

## 開発用ランタイム

`tsc --watch` は堅実だが、実行には `node dist/index.js` を別途必要。開発中は以下のいずれかが便利:

| ツール | 特徴 |
|---|---|
| **Node 標準** | v25.2+ で **型ストリップが Stable**。`node src/index.ts` で直接実行（後述） |
| `tsx` | zero-config で TS/ESM を直接実行。`tsx src/index.ts` / `tsx watch`。enum / decorator など非消去構文も対応 |
| `ts-node` | 老舗。ESM サポートはやや癖 |
| `bun` | 別ランタイム。TS ネイティブ |
| `deno` | 別ランタイム。npm 互換モードあり |

本番ビルドは `tsc` が最もシンプル。型だけ `tsc --noEmit` でチェック、バンドルは `esbuild` / `rollup` / `tsup` のようにする構成も一般的。

### Node ネイティブ TypeScript 実行（v25.2+ Stable）

```bash
node src/index.ts                                 # 型注釈を空白に置換して実行（型チェックなし）
node --no-strip-types src/index.ts                # 型ストリップを無効化
node --experimental-transform-types src/index.ts  # enum / namespace など変換
```

- **型チェックは行わない**（`tsc --noEmit` を併用）
- **`tsconfig.json` は読まれない**（`paths` エイリアス無効、`#imports` を使う）
- `node_modules` 配下の `.ts` は実行不可
- `.tsx` は非対応
- 拡張子は `.ts` / `.mts` / `.cts` をサポート
- `enum` / `namespace` / parameter properties は `--experimental-transform-types` 必須

互換のため `tsconfig.json` は `erasableSyntaxOnly: true` / `rewriteRelativeImportExtensions: true` を入れておくと、TS ソース直実行と `tsc` ビルドが両立する。

## CJS と ESM の公開（デュアルパッケージ）

ライブラリとして両方サポートする場合:

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

`tsup` などで CJS 版も並行出力。型ファイル（`.d.ts`）は両方で共有されることが多い。

## strict オプションの内訳

`"strict": true` は以下を一括有効化:

| フラグ | 効果 |
|---|---|
| `strictNullChecks` | `null` / `undefined` の明示 |
| `noImplicitAny` | 型推論できない any を禁止 |
| `strictFunctionTypes` | 関数引数の反変チェック |
| `strictBindCallApply` | `bind` / `call` / `apply` の型付け |
| `strictPropertyInitialization` | クラスプロパティの初期化強制 |
| `noImplicitThis` | 暗黙の `this: any` 禁止 |
| `alwaysStrict` | `"use strict"` 付与 + 字句的厳格モード |
| `useUnknownInCatchVariables` | `catch (e)` を `unknown` 型に |

個別に緩めるより全部有効が標準。

## Node.js サポートポリシー

`engines.node` は**サポート対象の最小バージョン**を書く:

```json
{ "engines": { "node": ">=20" } }
```

Node 18 は 2025-04 で EOL。2026 時点では 20 / 22 / 24 のいずれかを最低ラインに。

## AI エージェントがよくやるミス

1. **`.js` を付けずに relative import** — ESM では解決失敗
2. **`module: "CommonJS"` のままで `import.meta` を使う** — ランタイムエラー
3. **`"type": "module"` を package.json に書かず import 構文** — `SyntaxError` で起動しない
4. **`require()` を ESM の中で使う** — `ReferenceError`。`createRequire` 経由か `import` に直す
5. **`tsc` のパスエイリアス（`paths`）を本番で使う** — Node が解決できない。bundler / `tsc-alias` を介す
6. **`__dirname` を ESM で使う** — 未定義。`import.meta.dirname` へ

## トラブルシュート

### `ERR_MODULE_NOT_FOUND: Cannot find module '.../foo'`

拡張子忘れ。`./foo` → `./foo.js` に。

### `SyntaxError: Cannot use import statement outside a module`

`package.json` に `"type": "module"` がない。追加する。

### `Cannot find module 'foo' or its corresponding type declarations`

`@types/foo` が入っていないか、モジュールが型定義を配布していない。`declare module "foo";` を `.d.ts` に書くか、`any` で逃がす（後で型を足す）。

### `TypeError [ERR_REQUIRE_ESM]`

CJS コードから ESM パッケージを `require()` している。`import()` を使うか、プロジェクト全体を ESM に移行する。

### TypeScript 型チェックは通るがランタイムで落ちる

型システムとランタイムの乖離。典型は `.js` 拡張子忘れ、`paths` エイリアス、`process.env` 型保証不足。`vitest` や `smoke test` で早期検出する。

## 参考資料

- [Node.js: Modules: ECMAScript modules](https://nodejs.org/api/esm.html)
- [Node.js: Modules: TypeScript](https://nodejs.org/api/typescript.html)
- [TypeScript: Modules Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)
- [`verbatimModuleSyntax`](https://www.typescriptlang.org/tsconfig#verbatimModuleSyntax)
- [`rewriteRelativeImportExtensions`](https://www.typescriptlang.org/tsconfig#rewriteRelativeImportExtensions)
- [`erasableSyntaxOnly`](https://www.typescriptlang.org/tsconfig#erasableSyntaxOnly)
