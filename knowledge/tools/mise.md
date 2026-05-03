---
reviewed: 2026-05-04
tags: [version-manager, task-runner, rust]
---

# mise

開発ツールのバージョン管理 + タスクランナー + 環境変数管理を統合した CLI。asdf の後継として設計され、Go バイナリで起動が高速。Node / Python / Go / Rust / バイナリ単体まで単一設定で管理できる。

公式: [mise.jdx.dev](https://mise.jdx.dev/)

## インストール

```bash
# Homebrew
brew install mise

# curl
curl https://mise.run | sh

# cargo
cargo install mise
```

シェルへの統合を有効化（activate モード）:

```bash
# bash
echo 'eval "$(mise activate bash)"' >> ~/.bashrc

# zsh
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc

# fish
echo 'mise activate fish | source' >> ~/.config/fish/config.fish
```

`cd` するたびに `mise.toml` を読み、PATH を動的に切り替える。

## 設定ファイル `mise.toml`

```toml
[tools]
# Runtime & package managers
node = "24"
pnpm = "10"

# Linters & formatters
biome = "2"
shellcheck = "0.11"
shfmt = "3"
taplo = "0.10"
"npm:markdownlint-cli2" = "0.21"
"pipx:yamllint" = "1"
yamlfmt = "0.21"
actionlint = "1"
gitleaks = "8"
trivy = "0.69"
"pipx:mdformat" = "0.7"

# Git hooks
lefthook = "2"

[env]
NODE_ENV = "development"
DATABASE_URL = "postgresql://localhost/myapp"

[tasks.build]
description = "Build the project"
run = "pnpm run build"
```

`mise install` で全ツールを解決・インストール。`mise use <tool>@<version>` で追加も可能。

## バージョン指定の書式

| 指定 | 意味 |
|---|---|
| `"24"` | メジャー 24 の最新 |
| `"24.5"` | マイナー 24.5 の最新パッチ |
| `"24.5.1"` | 固定 |
| `"lts"` | LTS 最新 |
| `"latest"` | 最新安定 |
| `"ref:<commit>"` | Git ref 指定（プラグイン対応時） |

複数バージョン共存:

```toml
[tools]
node = ["24", "22"]  # 両方インストール、先頭が優先
```

## バックエンドの選択

mise は複数のインストーラバックエンドを使い分ける:

| バックエンド | 書式 | 用途 |
|---|---|---|
| core | `node = "24"` | ビルトインサポートのツール |
| aqua | 多くのバイナリ | GitHub Releases のバイナリ配布 |
| ubi | `ubi:<owner>/<repo>` | ubi 互換バイナリ |
| npm | `"npm:<pkg>" = "..."` | npm パッケージを mise shim 経由で提供 |
| pipx | `"pipx:<pkg>" = "..."` | Python ツール |
| cargo | `"cargo:<crate>" = "..."` | Rust クレート |
| asdf | `"asdf:<plugin>" = "..."` | asdf プラグインフォールバック |

## タスクランナー

```toml
[tasks.test]
description = "Run tests"
run = "pnpm run test"
depends = ["build"]

[tasks.build]
description = "Build"
run = "pnpm run build"
sources = ["src/**/*.ts"]
outputs = ["dist/**/*.js"]
```

- `mise run test` で実行
- `depends` で前提タスクを解決
- `sources` / `outputs` を書くと差分ベースでスキップされる（incremental build）
- `.mise/tasks/<name>` にスクリプトファイルとしても書ける（シェルスクリプト形式、引数を取れる）

## 環境変数

```toml
[env]
API_URL = "http://localhost:3000"

[env._.file]
_ = ".env"
```

- `[env]` にキー直書き
- `[env._.file]` で `.env` を読み込み
- `[env.redact]` でログマスク対象を指定

プロジェクトごとの環境変数を `.env` なしで mise 一元管理できる。

## `mise.local.toml`

ローカル上書き用（`.gitignore` 推奨）:

```toml
[env]
DATABASE_URL = "postgresql://localhost/myapp_dev"
DEBUG = "1"
```

## 主要コマンド

| コマンド | 用途 |
|---|---|
| `mise install` | `.mise.toml` のツールをすべてインストール |
| `mise use <tool>@<ver>` | 追加・バージョン変更 |
| `mise ls` | インストール済み一覧 |
| `mise current` | 現ディレクトリで有効なバージョン |
| `mise outdated` | 新バージョンがあるか確認 |
| `mise upgrade` | 上限内で更新 |
| `mise which <tool>` | 解決されているパスを表示 |
| `mise run <task>` | タスク実行 |
| `mise exec -- <cmd>` | mise の env で実行（activate なしで） |
| `mise trust` | 新しいディレクトリの `.mise.toml` を信頼 |

## 信頼モデル

`mise.toml` はシェルに影響するため、**信頼されていないディレクトリ**では読み込まれない:

```bash
cd new-repo
# → warn: Config file not trusted
mise trust
```

`[env]` による環境変数設定や `[tasks]` が自動実行されるのを防ぐセキュリティ機構。

## CI での使い方

```yaml
- uses: jdx/mise-action@v4
  with:
    version: 2026.4.28
    experimental: true
- run: pnpm install --frozen-lockfile
- run: pnpm run test
```

mise-action が `mise.toml` を読んで全ツールをインストール。キャッシュも自動。

## asdf からの移行

- `.tool-versions` は mise がそのまま読める
- プラグインは多くが自動で解決（asdf プラグイン互換）
- mise 固有機能（tasks / env）は `.mise.toml` に書き足す

## トラブルシュート

### `mise: command not found`

シェル統合されていない。`eval "$(mise activate <shell>)"` を rc に追加。

### `cd` してもツールが切り替わらない

`mise trust` されていない可能性。`mise trust .` で許可。

### CI で遅い

初回ビルドはインストール時間が長い。`mise-action` のキャッシュを使う、または OCI イメージに mise と tool を焼き込む。

### `shims` モードとの違い

mise には 2 モードある:

- **activate モード**（推奨）: PATH を書き換える。速い
- **shims モード**: `~/.local/share/mise/shims/` に薄いラッパースクリプトを配置。IDE が直接 `node` を叩くときに便利

使い分け: 対話シェルは activate、IDE は shims。

## 他ツールとの比較

| 観点 | mise | asdf | Volta | nvm + pyenv + ... |
|---|---|---|---|---|
| 対応言語 | 多数 | 多数 | Node 特化 | 個別ツール |
| 速度 | 速い（Go） | 普通（Bash） | 速い（Rust） | 個別 |
| tasks | あり | なし | なし | なし |
| env 管理 | あり | なし | なし | なし |
| プラグイン | asdf 互換 | 豊富 | なし | — |
