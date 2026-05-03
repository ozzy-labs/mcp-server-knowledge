---
reviewed: 2026-05-04
tags: [package, npm, javascript, fast]
---

# pnpm

高速・ディスク効率の良い Node.js パッケージマネージャ。グローバルストアへのハードリンクで依存を共有し、厳格な node_modules ツリー（hoisting しない）で間接依存への依存を防ぐ。

2026-05 時点の `latest` dist-tag は **v10.33.2** のまま。v11.0.4（2026-04-28）はリリース済みだが `latest-11` / `next-11` での opt-in 配布で、`corepack use pnpm@latest` や `npm install -g pnpm` は v10 を取得する。

v11 の主な変更点は **Node.js 22+ 必須**、純 ESM 配布、サプライチェーン保護がデフォルト ON（`minimumReleaseAge: 1440` で公開後 24 時間未満のパッケージは解決されない）、設定の `.npmrc` → `pnpm-workspace.yaml` 移行。

公式: [pnpm.io](https://pnpm.io/)

## インストール

```bash
# Corepack 経由（Node.js 同梱、推奨）
corepack enable pnpm
corepack use pnpm@latest          # v10 系（latest dist-tag）
corepack use pnpm@next-11         # v11 系を opt-in

# スタンドアロンインストーラ（Node.js / Corepack なしで pnpm 単体を導入）
curl -fsSL https://get.pnpm.io/install.sh | sh -                          # latest dist-tag（現在 v10）
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=11.0.4 sh -  # 任意バージョンを PNPM_VERSION で固定

# mise / asdf
mise use pnpm@10                  # latest 系
mise use pnpm@11                  # opt-in v11

# Homebrew
brew install pnpm

# npm 経由
npm install -g pnpm               # v10 系（latest dist-tag）
npm install -g pnpm@next-11       # v11 系を opt-in
```

## バージョン固定

`package.json` の `packageManager` フィールドで固定（Corepack が自動適用）:

```json
{ "packageManager": "pnpm@10.33.2" }
```

## 主要コマンド

| コマンド | npm 相当 | メモ |
|---|---|---|
| `pnpm install` | `npm install` | `pnpm i` でも |
| `pnpm add <pkg>` | `npm install <pkg>` | |
| `pnpm add -D <pkg>` | `npm install -D` | dev 依存 |
| `pnpm add -g <pkg>` | `npm install -g` | グローバル |
| `pnpm remove <pkg>` | `npm uninstall` | `pnpm rm` でも |
| `pnpm update` | `npm update` | `pnpm up` でも |
| `pnpm run <script>` | `npm run` | `pnpm <script>` と省略可（ただし組み込みコマンドと衝突注意） |
| `pnpm exec <bin>` | `npx --no` | node_modules/.bin 内のバイナリ実行 |
| `pnpm dlx <bin>` | `npx` | 一時ダウンロードして実行 |
| `pnpm outdated` | `npm outdated` | |
| `pnpm audit` | `npm audit` | |
| `pnpm prune` | `npm prune` | |
| `pnpm list` | `npm ls` | `pnpm ls` でも |

## よく使うフラグ

| フラグ | 意味 |
|---|---|
| `--frozen-lockfile` | `pnpm-lock.yaml` を更新しない（CI で必須） |
| `--ignore-scripts` | postinstall 等のスクリプトを実行しない |
| `--filter <pattern>` | workspace のサブセットに適用 |
| `--recursive` / `-r` | workspace 全体で再帰実行 |

## workspace（monorepo）

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

```bash
# 全 workspace でテスト
pnpm -r test

# 特定 workspace のみ
pnpm --filter "@myorg/web" test

# 依存の末端から順に build
pnpm -r --filter ./apps/web... build
```

`workspace:*` プロトコルでローカル workspace を依存指定できる:

```json
{ "dependencies": { "@myorg/core": "workspace:*" } }
```

## 厳格な node_modules レイアウト

pnpm はデフォルトで **hoisting しない**。`package.json` に宣言していないパッケージは `import` できない（phantom dependency 防止）。

これにより npm では通っていたコードが pnpm で壊れることがある。対処:

1. 欠けている依存を `package.json` に宣言する（推奨）
2. `pnpm-workspace.yaml` に `shamefullyHoist: true`（npm 互換、非推奨）
3. `pnpm-workspace.yaml` に `publicHoistPattern: ["*eslint*"]` 等で特定パッケージだけ hoist

## 設定ファイル（v11 以降）

pnpm 11 から `.npmrc` は **認証 / レジストリ専用**。それ以外の設定は `pnpm-workspace.yaml`（プロジェクト）または `~/.config/pnpm/config.yaml`（グローバル）に camelCase で書く。`package.json` の `pnpm` フィールドも読まれない。

`pnpm-workspace.yaml`:

```yaml
# CI でのロックファイル固定
frozenLockfile: true

# peer dependency の自動インストール
autoInstallPeers: true

# レジストリ（v11 で新設、複数を一括宣言可）
registries:
  default: https://registry.npmjs.org/
  "@myorg": https://npm.pkg.github.com/
```

`.npmrc`（認証のみ）:

```ini
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

環境変数は `npm_config_*` ではなく `pnpm_config_*` を使う（例: `pnpm_config_registry`）。

## CI でのベストプラクティス

```yaml
- uses: actions/checkout@v6
- uses: pnpm/action-setup@v6
  with:
    version: 10              # v11 を opt-in する場合はここを 11 に
- uses: actions/setup-node@v6
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm run test
```

- **`--frozen-lockfile`** は必須（`pnpm-lock.yaml` と `package.json` の不整合で失敗させる）
- `actions/setup-node` の `cache: pnpm` で node_modules ではなく**ストア**をキャッシュ（ビルド時間短縮）

## トラブルシュート

### `ERR_PNPM_OUTDATED_LOCKFILE`

`package.json` と `pnpm-lock.yaml` が不整合。ローカルで `pnpm install` し直してコミット。

### ビルドで `Cannot find module 'foo'`

phantom dependency。`foo` を直接依存していないのに使っている。`pnpm add foo` で明示する。

### `peer dependency 警告`

`pnpm-workspace.yaml` に `autoInstallPeers: true` を追加。または `peerDependenciesMeta.<name>.optional = true` でオプション化。

### `pnpm install` が遅い

ストアキャッシュが効いていない可能性。`pnpm store path` でストア場所を確認し、CI でキャッシュ対象に含める。

## npm / yarn との違い

| 観点 | pnpm | npm | yarn (v1) | yarn berry |
|---|---|---|---|---|
| node_modules | シンボリックリンク + ハードリンク | フラット | フラット | PnP（ファイルなし） or nm |
| ディスク使用 | 小（ストア共有） | 大 | 大 | 小（PnP） |
| phantom deps | 防止 | 許容 | 許容 | 防止（PnP） |
| workspace | 成熟 | npm 7+ で対応 | 成熟 | 成熟 |
| 速度 | 速い | 遅め | 普通 | 速い |

AI エージェントは npm コマンドを推測して実行しがちだが、pnpm リポジトリでは `pnpm` を使うこと（ロックファイル形式が異なる）。
