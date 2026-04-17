# lefthook

Go で書かれた高速な Git フック管理ツール。並列実行、ファイルフィルタ、ステージ更新、複数リポジトリ横断の設定共有をサポート。husky / pre-commit の置き換えとして採用が進む。

公式: [github.com/evilmartians/lefthook](https://github.com/evilmartians/lefthook)

## インストール

```bash
# mise / asdf
mise use lefthook@2

# Homebrew
brew install lefthook

# npm
pnpm add -D lefthook

# Go
go install github.com/evilmartians/lefthook@latest
```

## 有効化

```bash
lefthook install
```

`.git/hooks/` に lefthook のディスパッチャスクリプトを配置する。`package.json` の `scripts.prepare`（pnpm / npm）に書くと clone 後の `pnpm install` で自動セットアップできる:

```json
{ "scripts": { "prepare": "lefthook install" } }
```

## 設定ファイル `lefthook.yaml`

```yaml
commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json,jsonc}"
      run: biome check --write {staged_files}
      stage_fixed: true
    markdownlint:
      glob: "**/*.md"
      run: markdownlint-cli2 --fix {staged_files}
      stage_fixed: true
    gitleaks:
      run: gitleaks protect --staged --no-banner

pre-push:
  commands:
    typecheck:
      run: npx tsc --noEmit
```

## 主要フィールド

### トップレベル

| フィールド | 説明 |
|---|---|
| `<hook-name>:` | `pre-commit` / `commit-msg` / `pre-push` / `post-checkout` 等、Git が定義するフック名 |
| `extends:` | 他の yaml ファイルをマージ（monorepo や共通設定の共有） |
| `min_version:` | lefthook の最小要求バージョン |
| `glob_matcher:` | `doublestar`（推奨、`**` が再帰的にマッチ） |

### hook 内

| フィールド | 説明 |
|---|---|
| `parallel: true` | コマンドを並列実行 |
| `piped: true` | 直列実行で前段の失敗で中断 |
| `skip:` | 条件付きスキップ（`- merge` / `- rebase` / `ref: refs/heads/main` 等） |
| `only:` | 条件付き実行（逆） |
| `commands:` | 実行する個別コマンド |

### command 内

| フィールド | 説明 |
|---|---|
| `run:` | 実行するシェルコマンド |
| `glob:` | 対象ファイルの glob パターン |
| `exclude:` | 除外パターン |
| `tags:` | フック呼び出し時のフィルタ用ラベル |
| `stage_fixed: true` | コマンド後に変更ファイルを再ステージ |
| `fail_text:` | 失敗時に表示するメッセージ |
| `root:` | 実行する作業ディレクトリ（monorepo） |

## 変数

| 変数 | 展開 |
|---|---|
| `{staged_files}` | ステージ中のファイル（pre-commit） |
| `{push_files}` | push 対象のファイル（pre-push） |
| `{all_files}` | 追跡中の全ファイル |
| `{files}` | `glob` にマッチしたファイル |
| `{1}` / `{2}` ... | フックに渡された引数（`{1}` は commit-msg の COMMIT_EDITMSG パス） |

## `extends` によるベース設定の共有

組織で複数リポジトリを運用する場合、共通部分を別リポジトリに切り出してシンボリックリンク or `git subtree` で配置:

```yaml
# lefthook-base.yaml
glob_matcher: doublestar

commit-msg:
  commands:
    commitlint:
      run: npx commitlint --edit {1}

pre-commit:
  parallel: true
  commands:
    gitleaks:
      run: gitleaks protect --staged --no-banner
```

```yaml
# 各リポジトリの lefthook.yaml
extends:
  - lefthook-base.yaml

pre-commit:
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json}"
      run: biome check --write {staged_files}
      stage_fixed: true
```

## スキップ方法

### ユーザー側

```bash
# 単一のフックをスキップ
LEFTHOOK=0 git commit
LEFTHOOK_EXCLUDE=biome,gitleaks git commit

# 特定コマンドのみ実行
lefthook run pre-commit --commands biome
```

CLAUDE.md やチーム規約では `--no-verify` を原則禁止とするプロジェクトが多い。`LEFTHOOK_EXCLUDE` で個別スキップする方が目的明確。

### 設定側

```yaml
pre-commit:
  commands:
    slow-check:
      run: ./scripts/heavy.sh
      skip:
        - merge
        - rebase
      only:
        ref: "refs/heads/main"
```

## 実行順とエラー

- `parallel: true`: 全コマンドを並列実行。どれか失敗しても他は走りきる
- `piped: true`: 直列、前段失敗で即中断
- デフォルト（両方なし）: 直列だが全コマンド実行

終了コードが非 0 なら hook 全体が fail し、Git 操作が中断される。

## Windows 対応

Git Bash / WSL で動作。ネイティブ Windows では `run:` のコマンドが POSIX shell 前提のものは失敗する。クロスプラットフォーム化するときは Node スクリプト経由にするのが安全。

## よくあるトラブル

### `lefthook install` が何もしない

`.git/hooks/` が既存のフックで埋まっている場合、`lefthook install --force` で上書き。事前に既存フックをバックアップすること。

### ステージに乗っていないファイルまで直してしまう

`stage_fixed: true` を付けていても、コマンドが `{staged_files}` 以外を触ると意図せず変更される。`glob` と `{staged_files}` の併用が安全。

### 既存 husky からの移行

1. `.husky/` 内のスクリプトを `lefthook.yaml` に書き直す
2. `package.json` から `husky` を削除、`"prepare": "husky"` を `"lefthook install"` に
3. `.husky/` を削除

### commitlint が走らない

`commit-msg` フックの命名ミス（`commit_msg` ではない）、`{1}` 引数忘れが典型。

## 他ツールとの比較

| 観点 | lefthook | husky | pre-commit (Python) |
|---|---|---|---|
| 言語 | Go（単一バイナリ） | シェル + Node | Python |
| インストール | バイナリ | npm | pip |
| 並列実行 | ネイティブ | なし | あり |
| ファイルフィルタ | glob 内蔵 | 個別処理 | pattern 対応 |
| 設定共有 | `extends` | なし | `repos` 参照 |
| 速度 | 速い | 普通 | Python 起動分遅い |
