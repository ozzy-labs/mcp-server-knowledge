---
reviewed: 2026-06-28
tags: [build, package, typescript]
---

# tsdown

Rolldown（Rust 製のバンドラ）+ Oxc をベースにした TypeScript ライブラリ向けビルドツール。`tsup` の事実上の後継として Rolldown チームが開発している。ESM ファースト、`.d.ts` 自動生成、コード分割を標準で備える。

公式: [tsdown.dev](https://tsdown.dev/)

## 位置付け

- ライブラリ／CLI パッケージの `dist/` 生成に特化
- アプリケーション（Web / Node サーバー）の最終成果物バンドルには通常使わない（そちらは Vite / Rolldown / esbuild 直呼び）
- 2026-06 時点で v0.22.3（最新、2026-06-16 リリース）。v0.22.0（2026-05-07）で Node サポート要件などに破壊的変更が入った。**1.0 未満で minor 更新に破壊的変更がある**ため、バージョンは厳密に固定する

## インストール

```bash
pnpm add -D tsdown
```

Node 22.18.0 以上が必要（v0.22.0 で Node 20 / 23 サポートを削除。`engines.node` は `^22.18.0 || >=24.11.0`）。Bun / Deno は experimental サポート。なお出力の `target` は別途下げられるため、ビルド成果物の利用者側は Node 22 未満でも動く。

## 最小設定

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

`package.json` の `types` / `typings` フィールド、または `tsconfig.json` の `compilerOptions.declaration: true` が設定されていれば `--dts` は自動で有効になる（v0.22.0 で tsconfig 連動が追加）。

## 主要 CLI フラグ

| フラグ | 用途 |
|---|---|
| `--watch` / `-w` | ファイル変更で再ビルド |
| `--dts` | `.d.ts` を出力（`types` フィールドがあれば自動） |
| `--format esm,cjs` | 出力形式。`esm` / `cjs` / `iife` / `umd`。デフォルト `esm` |
| `--minify` | minify 出力 |
| `--clean` | 出力先を削除してからビルド（デフォルト `true`） |
| `--target` | JS ターゲット。`engines.node` から自動判定 |
| `--sourcemap` | sourcemap 出力 |
| `--tsconfig <path>` | 使用する tsconfig を明示 |

## 設定オプション（代表）

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
  plugins: [],  // unplugin 互換プラグイン
});
```

`plugins` は unplugin / Rolldown プラグインを受け取る。esbuild プラグインをそのまま渡すとエラー。

## tsup からの移行

公式に移行ガイドがあり、多くの設定は互換。自動移行スクリプトもある:

```bash
npx tsdown-migrate
npx tsdown-migrate 'packages/*'  # monorepo
```

主要な差分:

| 項目 | tsup | tsdown |
|---|---|---|
| エンジン | esbuild | Rolldown (Rust) + Oxc |
| デフォルト `format` | `cjs` | `esm` |
| デフォルト `clean` | `false` | `true` |
| `dts` 既定 | `false` | `types` フィールドで自動 |
| `cjsInterop` | ✓ | `cjsDefault` に改名 |
| `esbuildPlugins` | ✓ | `plugins`（unplugin 前提） |
| コード分割 | 任意 | 常時 ON（無効化不可） |
| 開発体制 | メンテ停止（tsdown 推奨） | 活発 |

`splitting: false` / `metafile` / `swc` / `experimentalDts` は tsdown に対応オプションがない。

## 落とし穴

### v0.x のため minor 更新が破壊的

```json
{ "devDependencies": { "tsdown": "0.22.3" } }
```

のように**厳密固定**を推奨。`^` / `~` はリスクが高い。

### esbuild プラグイン資産は使えない

unplugin に書き換える必要がある。tsup 資産が多いプロジェクトは移行コストを見積もる。

### 出力パスは `dist/` 固定ではない

`outDir` で変更できるが、`exports` フィールドと整合させることを忘れやすい。

## AI エージェントがよくやるミス

1. **`format: 'cjs'` を付け忘れて CJS 利用者が壊れる** — 両対応したいなら `format: ['esm', 'cjs']` を明示する。
2. **`clean: true` 既定を知らず不要ファイルが残ると錯覚** — tsup 感覚で `clean: false` を書くと古い出力が積もる。
3. **unplugin を Rolldown 向けに import していない** — `unplugin-foo/esbuild` ではなく `unplugin-foo/rolldown` を使う。
4. **`^0.22.0` で固定して CI が壊れる** — 0.x はマイナー間で破壊的変更を許容するため `^` を使わない（実際 v0.22.0 で Node 20 / 23 サポートが削除された）。

## 他ツールとの比較

| ツール | 対象 | 備考 |
|---|---|---|
| tsdown | ライブラリ出力 | ESM ファースト、後発、活発 |
| tsup | ライブラリ出力 | esbuild ベース、事実上メンテ停止 |
| tshy | ライブラリ出力 | dual ESM/CJS 特化、設定ゼロ寄り |
| unbuild | ライブラリ出力 | Rollup + esbuild、設定ファイル中心 |
| Vite | アプリ | dev サーバ + HMR が主眼 |
| esbuild 直呼び | どちらも | 高速だが dts は別途必要 |

## 参考

- [tsdown 公式ドキュメント](https://tsdown.dev/)
- [Getting Started](https://tsdown.dev/guide/getting-started)
- [tsup からの移行](https://tsdown.dev/guide/migrate-from-tsup)
- [GitHub: rolldown/tsdown](https://github.com/rolldown/tsdown)
