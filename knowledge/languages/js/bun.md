---
reviewed: 2026-06-16
tags: [package, test, build, javascript, typescript, fast]
---

# Bun

JavaScript / TypeScript 向けのオールインワンツールキット。単一バイナリに **ランタイム・パッケージマネージャ・バンドラ・テストランナー** を内蔵し、Node.js のドロップイン置き換えを目指す。Zig で書かれ、エンジンに V8 ではなく **JavaScriptCore**（Apple が Safari 向けに開発）を採用するため、プロセス起動が Node.js より大幅に速い。

2026-06 時点の最新安定版は **1.3.14**（2026-05 リリース）。メジャーは 1.0（2023-09）→ 1.1（2024-04, Windows 対応 + Bun Shell）→ 1.2（2025-01, テキスト `bun.lock` 既定化 + 組み込み S3/Postgres）→ 1.3（2025-10, 組み込み Redis + monorepo catalogs）と進み、パッチは概ね 1〜3 週間間隔で不定期にリリースされる。

公式: [bun.com](https://bun.com)（旧 [bun.sh](https://bun.sh) も有効）／ [github.com/oven-sh/bun](https://github.com/oven-sh/bun)

## インストール

```bash
# 公式インストーラ（macOS / Linux）
curl -fsSL https://bun.com/install | bash
curl -fsSL https://bun.com/install | bash -s "bun-v1.3.14"   # バージョン固定

# Windows（PowerShell）
powershell -c "irm bun.sh/install.ps1 | iex"

# npm / Homebrew / Scoop
npm install -g bun
brew install oven-sh/bun/bun
scoop install bun
```

```bash
bun upgrade            # 自己アップグレード（stable）
bun upgrade --canary   # 毎コミットの canary に切替（--stable で戻す）
```

対応プラットフォーム: macOS 13+、Linux（kernel 5.6+ 推奨、glibc 2.17+。musl 系は専用バイナリ）、Windows 10 1809+。アーキは x64 / ARM64。古い CPU 向けに `-baseline` ビルドあり。

## 基本コマンド

| コマンド | 役割 | npm / 他相当 |
|---|---|---|
| `bun install` / `bun i` | 依存をインストール | `npm install` |
| `bun add <pkg>` | 依存を追加（`--dev` / `-g` / `--exact`） | `npm install` |
| `bun remove <pkg>` | 依存を削除 | `npm uninstall` |
| `bun update` | 依存を更新 | `npm update` |
| `bun run <script>` | `package.json` の script 実行 | `npm run` |
| `bun <file>` / `bun run <file>` | TS/JS ファイルを実行 | `node` |
| `bunx <pkg>` / `bun x` | パッケージを一時取得して実行 | `npx` |
| `bun test` | テスト実行 | `jest` / `vitest` |
| `bun build` | バンドル | `esbuild` / `tsup` |
| `bun init` | プロジェクト雛形生成 | `npm init` |
| `bun pm` | lockfile / キャッシュ操作 | — |

`run` を省いた「裸」実行（`bun index.ts`）も `bun run` と同一挙動。スクリプトは `pre<name>` / `post<name>` ライフサイクルを尊重する。

## ランタイム

### TypeScript / JSX のネイティブ実行

`.ts` / `.tsx` / `.jsx` を設定なしでそのまま実行できる。ファイルは実行直前に Bun の高速トランスパイラでオンザフライ変換される（型チェックは行わない。型検査は別途 `tsc --noEmit`）。

```bash
bun run index.ts     # トランスパイル設定不要でそのまま動く
```

### ホットリロード

| フラグ | 挙動 |
|---|---|
| `bun --watch <file>` | ファイル変更でプロセスを **ハード再起動**（状態は失われる） |
| `bun --hot <file>` | プロセスを維持したままモジュールを再評価。`globalThis` などのグローバル状態は保持（HTTP サーバを落とさずハンドラだけ差し替え可） |

`--hot` はサーバ用途のリロードで、ブラウザの HMR とは別物。

### .env 自動読み込み

`.env` 系ファイルを自動で読む（`dotenv` 不要）。優先順は `.env` → `.env.{production,development,test}`（`NODE_ENV` 依存）→ `.env.local`。値は `process.env` / `Bun.env` / `import.meta.env` で参照。任意ファイルは `--env-file` で指定。

### Node.js 互換性

Bun は「Node.js で動くパッケージが Bun で動かなければ Bun のバグ」という方針で互換性を追い込んでおり、毎リリース前に Node.js テストスイートを走らせている。`node:fs` などの `node:` プレフィックス付きビルトインをサポートし、Next.js / Express をはじめ大半の npm パッケージが動く。ESM と CommonJS を同一ファイル内で混在させても動く（`import` と `require` が常に併用可。例外は top-level await を含むモジュールの同期 `require()`）。

ただし完全互換ではない。`node:crypto` / `node:http2` / `node:worker_threads` などは一部 API 欠落、`node:repl` / `node:trace_events` は未実装。とくに Node 標準の `node:sqlite` は未実装だが、Bun 独自の `bun:sqlite` があるため SQLite 自体は使える。Node.js ランタイムの詳細は [nodejs](nodejs.md) を参照。

## Bun 独自 API

標準 Web API に加え、`Bun.*` グローバルでネイティブ実装の高速 API を提供する。

| API | 用途 |
|---|---|
| `Bun.serve` | HTTP / WebSocket サーバ。宣言的 `routes`（`:id` 動的パラメータ等）は v1.2.3+ |
| `Bun.file` / `Bun.write` | ファイル I/O（遅延読み込みの `BunFile`） |
| `bun:sqlite` | 組み込み SQLite ドライバ |
| `Bun.sql` | 組み込み PostgreSQL クライアント（tagged template で SQL） |
| `Bun.redis` | 組み込み Redis / Valkey クライアント |
| `Bun.s3` | 組み込み S3 クライアント |
| `Bun.$` | シェル（Bun Shell。クロスプラットフォームで bash 風構文） |
| `Bun.password` | パスワードハッシュ（argon2 / bcrypt） |
| `Bun.Glob` / `Bun.spawn` | glob マッチ / 子プロセス |

```ts
const server = Bun.serve({
  routes: {
    "/": new Response("Hello from Bun"),
    "/users/:id": (req) => Response.json({ id: req.params.id }),
  },
});
console.log(`Listening on ${server.url}`);
```

## パッケージマネージャ

`bun install` は `node_modules` を生成する npm 互換のマネージャで、`npm install` から差し替えるだけで大幅に高速化する。`overrides`（npm）/ `resolutions`（yarn）の両方に対応。

主なフラグ:

| フラグ | 意味 |
|---|---|
| `--frozen-lockfile` | lockfile を更新せず、`package.json` と不整合ならエラー（CI 必須）。`bun ci` がエイリアス |
| `--production` / `--omit dev` | `devDependencies` を除外 |
| `--dev` / `-g` | dev 依存 / グローバルへ追加（`bun add`） |
| `--linker hoisted\|isolated` | node_modules レイアウトを選択 |
| `--filter <pattern>` | workspace のサブセットに適用 |

> **注意**: セキュリティのため、依存パッケージの `postinstall` 等ライフサイクルスクリプトは **既定で実行されない**。許可するパッケージは `package.json` の `trustedDependencies` に列挙する。

### bun.lock（テキスト lockfile）

Bun 1.2 から lockfile は **JSONC 形式のテキスト `bun.lock`** が既定。git diff が読め、マージ競合が減る。1.2 より前のバイナリ `bun.lockb` も引き続きサポートされる（自動移行はしない）。既存プロジェクトの移行:

```bash
bun install --save-text-lockfile --frozen-lockfile --lockfile-only
rm bun.lockb
```

### node_modules レイアウト

```bash
bun install --linker hoisted    # npm/yarn 式のフラット化
bun install --linker isolated   # pnpm 式（中央ストア + シンボリックリンク、phantom dep 防止）
```

既定は monorepo / workspace が `isolated`、単一パッケージが `hoisted`。pnpm の厳格レイアウトについては [pnpm](pnpm.md) を参照。

### workspaces と catalogs

`package.json` の `workspaces` で monorepo を構成し、`workspace:*` でローカル参照する。共通依存のバージョンはルートの `catalog` / `catalogs` に一元定義し、各パッケージから `catalog:` プロトコルで参照できる（pnpm の catalog と互換）。

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

`bunx <pkg>`（= `bun x`）は npx 相当。ローカル依存を優先し、なければ npm から取得して実行、結果をグローバルキャッシュ（`~/.bun/install/cache/`）に保存して再利用する。`bunx --bun <pkg>` で対象の Node shebang を無視して Bun ランタイムで実行する。

## 組み込みツール

### bun test

Jest 互換の高速テストランナー。`bun:test` から `test` / `expect` / `mock` / `jest` などを import する。TS/JSX をそのまま実行でき、`*.test.ts` / `*.spec.ts` / `*_test.ts` を自動検出する。

```bash
bun test                       # 全テスト実行
bun test --watch               # 変更監視
bun test --coverage            # カバレッジ（--coverage-reporter text|lcov）
bun test -t "user"             # 名前で絞り込み
bun test -u                    # スナップショット更新
```

モックは `mock(fn)` / `jest.fn()`、スナップショットは `toMatchSnapshot()`、フックは `beforeAll` / `afterEach` 等。GitHub Actions を自動検出してアノテーションを出す。Vite ベースの代替は [vitest](vitest.md) を参照。

### bun build と単一実行ファイル

ネイティブバンドラ。`--target browser|bun|node`、`--format esm|cjs|iife` を選べる。`--compile` で **ランタイム同梱の単一実行ファイル** を生成できる。

```bash
bun build ./index.ts --outdir ./dist --target node
bun build ./cli.ts --compile --outfile mycli                 # 単一バイナリ
bun build ./cli.ts --compile --target=bun-linux-arm64 --outfile mycli  # クロスコンパイル
```

本番は `--minify --sourcemap`、起動高速化に `--bytecode`。ライブラリ向けビルドは [tsdown](tsdown.md) も選択肢。

### bun run --bun

`bun run --bun <script>` は、スクリプトが呼ぶローカル CLI（vite / next など `#!/usr/bin/env node` 付き）を Node ではなく **Bun ランタイムで強制実行** する。monorepo 実行は `--filter` / `--parallel` / `--sequential` に対応。

### bun init

```bash
bun init -y               # 質問なしで雛形生成
bun init --react=tailwind # React + Tailwind テンプレート
```

`package.json` / `tsconfig.json` / エントリポイント / `.gitignore` を生成し、`@types/bun` を導入する。非破壊的なので再実行可。

## TypeScript 設定

Bun の組み込み API の型は `@types/bun` で入れる:

```bash
bun add -d @types/bun
```

`tsconfig.json` の `compilerOptions` は `"types": ["bun"]`、`"module": "Preserve"`、`"moduleResolution": "bundler"`、`"allowImportingTsExtensions": true`、`"noEmit": true` などが推奨（`bun init` が自動生成）。ESM の落とし穴は [typescript-esm](typescript-esm.md) を参照。

## Docker

公式イメージは [`oven/bun`](https://hub.docker.com/r/oven/bun)。メジャー固定で使う。

```dockerfile
FROM oven/bun:1
WORKDIR /usr/src/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
USER bun
ENTRYPOINT ["bun", "run", "index.ts"]
```

`.dockerignore` で `node_modules` を除外する。Docker 全般は [docker](../../platforms/docker/docker.md) を参照。

## AI エージェントがよくやるミス

1. **`npm` / `pnpm` コマンドを推測実行する** — Bun リポジトリでは `bun install` を使う。lockfile 形式（`bun.lock`）が異なり、混在させると壊れる。
2. **`bun.lockb` を前提にする** — 1.2 以降の既定はテキストの `bun.lock`。古い記事のバイナリ前提で扱わない。
3. **`postinstall` が動く前提で書く** — 既定で無効。必要なら `trustedDependencies` に追加する。
4. **Node 完全互換とみなす** — 大半は動くが `node:sqlite` 等は未実装。SQLite は `bun:sqlite` を使う。
5. **`bun build` で型チェックされると思う** — トランスパイルのみ。型検査は `tsc --noEmit` を別途回す。
6. **CI で lockfile を更新してしまう** — `bun install --frozen-lockfile`（または `bun ci`）で固定する。

## 参考

- 公式ドキュメント: <https://bun.com/docs>
- インストール: <https://bun.com/docs/installation>
- Node.js 互換性: <https://bun.com/docs/runtime/nodejs-apis>
- パッケージマネージャ: <https://bun.com/docs/cli/install>
- バンドラ / 単一実行ファイル: <https://bun.com/docs/bundler/executables>
- リリースノート: <https://github.com/oven-sh/bun/releases>
