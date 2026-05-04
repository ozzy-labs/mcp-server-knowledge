---
reviewed: 2026-05-04
tags: [github, cli, extension]
---

# GitHub CLI Extensions

`gh` のサブコマンドをユーザーが追加できる拡張機構。`gh-*` という命名規則の GitHub リポジトリをインストールすると、`gh foo ...` のように本体コマンドと同じ感覚で呼べる。Bash スクリプト・Go バイナリ・任意言語のプリコンパイル拡張に対応する。

公式: [Using GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/using-github-cli-extensions) / [Creating GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/creating-github-cli-extensions) / [`gh extension` manual](https://cli.github.com/manual/gh_extension)

`gh` 本体のインストール・認証・基本コマンドは [`gh-cli.md`](gh-cli.md) を参照。

## 仕組み

- リポジトリ名が `gh-` プレフィックスで始まり、リポジトリ直下にリポ名と同じ実行可能ファイル（`gh-foo` または `gh-foo.exe`）があれば拡張として認識される
- 拡張はユーザースコープでローカルにインストールされる（マシン・ユーザー間で共有されない）
- バイナリ拡張のディレクトリには `manifest.yml` が配置され、`Owner` / `Name` / `Tag` / `IsPinned` などが記録される

### インストール先パス

| OS | デフォルトパス |
|---|---|
| Linux / macOS | `~/.local/share/gh/extensions/` |
| Windows | `%LocalAppData%\GitHub CLI\extensions\` |

`XDG_DATA_HOME` を設定するとそちらが優先される。

## 管理コマンド

### install

```bash
# 基本
gh extension install owner/gh-foo

# GHES のフル URL
gh extension install https://ghe.example.com/owner/gh-foo

# カレントディレクトリの拡張をローカルインストール（開発用）
gh extension install .

# バージョン固定（バイナリ拡張はタグ、スクリプト拡張はコミット ref）
gh extension install owner/gh-foo --pin v1.2.3

# 同名が既にあるとき強制上書き
gh extension install owner/gh-foo --force
```

| フラグ | 説明 |
|---|---|
| `--pin <ref>` | リリースタグまたはコミット ref に固定 |
| `--force` | 既存を上書きインストール |

`gh` 2.90.0（2026-04）以降、パブリックなリリースアセットのみを扱うため `gh extension install` は **未認証でも実行可能**。

### list / upgrade / remove

```bash
# 一覧（アップデート可能な拡張には印が付く）
gh extension list      # alias: gh ext ls / gh extensions ls

# アップグレード
gh extension upgrade gh-dash
gh extension upgrade --all
gh extension upgrade --all --dry-run    # 何が更新されるか確認のみ
gh extension upgrade gh-dash --force

# 削除
gh extension remove gh-dash
```

`--pin` 済みの拡張は `upgrade --all` でもスキップされる。

### search / browse

```bash
# キーワード検索（デフォルトはスター数 desc 上位 30）
gh ext search dashboard
gh ext search --owner github
gh ext search --sort updated --order desc --limit 10
gh ext search --license MIT --json fullName,description

# TUI ブラウザ（インストール / 削除 / アップグレードを対話で）
gh ext browse
gh ext browse --single-column   # アクセシビリティ向け
```

`search` の主要フラグ:

| フラグ | 説明 |
|---|---|
| `--sort` | `forks` / `help-wanted-issues` / `stars` / `updated` |
| `--order` | `asc` / `desc` |
| `--owner` | 所有者で絞り込み |
| `--license` | ライセンスで絞り込み |
| `--limit` / `-L` | 取得件数（デフォルト 30） |
| `--json` / `--jq` / `--template` | 機械可読出力 |

### exec

コア `gh` コマンドと拡張名が衝突したときの回避策。short name（`owner/gh-foo` なら `foo`）で拡張側を強制実行する。

```bash
gh extension exec foo -- args...
```

## 拡張の作成

### Bash スクリプト拡張（最も簡単）

```bash
gh extension create gh-hello
cd gh-hello
# gh-hello（実行可能ファイル）に処理を書き、push してリリースを切る
```

スキャフォールドにはリポ初期化済みの `gh-foo` シェルスクリプトが含まれる。Python / Ruby など任意のインタプリタ型でも、shebang が機能して `gh-foo` が実行可能であれば同じ仕組みで動く。

### Go プリコンパイル拡張

```bash
gh extension create --precompiled=go gh-hello
```

GitHub Actions ワークフロー（`cli/gh-extension-precompile`）も同梱され、タグを push するだけで各 OS / Arch のバイナリがリリースに添付される。

### その他言語のプリコンパイル拡張

```bash
gh extension create --precompiled=other gh-hello
# script/build.sh を自前で書く
```

リリース添付バイナリの命名規則: `gh-<name>_<version>_<os>-<arch>[.exe]`。

### `cli/gh-extension-precompile` Action

Go 拡張のクロスコンパイル + リリース公開を自動化する公式 Action。

```yaml
name: release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cli/gh-extension-precompile@v2
        with:
          go_version_file: go.mod
```

主な input:

| Input | 用途 |
|---|---|
| `go_version` / `go_version_file` | Go バージョン指定 |
| `go_build_options` | `go build` 追加フラグ |
| `build_script_override` | 非 Go 拡張のカスタムビルドスクリプト |
| `gpg_fingerprint` | チェックサムを GPG 署名 |
| `generate_attestations` | ビルド供給情報の attestation を生成 |
| `release_android` | Android ターゲットを有効化（v2 でデフォルト無効） |

特徴:

- ハイフンを含むタグ（`v2.0.0-rc.1` 等）は自動で **prerelease** として公開
- `CGO_ENABLED=0` でビルド（Android を除く）
- v1 は新しい Go との組み合わせで失敗するため **v2 系を使う**

リポトピックに `gh-extension` を付けると `github.com/topics/gh-extension` および `gh ext search` の結果に載る。

## 著名な拡張

| 拡張 | 用途 |
|---|---|
| `dlvhdr/gh-dash` | PR / Issue ダッシュボード TUI |
| `github/gh-aw` | GitHub Agentic Workflows |
| `github/gh-actions-importer` | 他 CI/CD から Actions への移行 |
| `github/gh-gei` | GitHub-to-GitHub 移行（GitHub Enterprise Importer） |
| `github/gh-skyline` | コントリビューション 3D モデル化 |
| `seachicken/gh-poi` | マージ済みローカルブランチの一括削除 |
| `Link-/gh-token` | GitHub App インストールトークン取得 |
| `basecamp/gh-signoff` | ローカル CI sign-off |

検索: `gh ext search`、または [github.com/topics/gh-extension](https://github.com/topics/gh-extension)。

### 内蔵化・廃止された拡張

- **`github/gh-projects`** は `gh project` として **本体に取り込み済み**（リポは archived）。`gh project create / list / view / item-add / item-edit / field-list` 等が利用可能。`--user` / `--org` は `--owner` に統合された
- **`github/gh-copilot`** は 2025-09-25 に deprecate。2026-01-21 以降、`gh copilot` は新しい agentic な GitHub Copilot CLI のインストーラ／フォワーダとして動作する

## CI での扱い

GitHub-hosted runner には `gh` がプリインストール済みなので、認証だけ env で渡せば拡張も追加できる。

```yaml
- name: Install gh extension
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh extension install owner/gh-foo --pin v1.2.3
    gh foo --help
```

注意点:

- パブリック拡張は `gh` 2.90.0 以降未認証でもインストール可能だが、CI では再現性のため **`--pin <tag>` を必須化する**
- プライベートリポの拡張をインストールするには `GITHUB_TOKEN` ではなく PAT / GitHub App トークンが必要（`GITHUB_TOKEN` は実行リポへの権限しか持たない）
- Copilot 系（`gh copilot`）は OAuth 前提で CI 用途は非サポート

## セキュリティ

- 「**GitHub 製でない拡張は GitHub によって認証・署名・推奨されていない**」と公式が明記。インストールは任意リポから実行可能ファイルを取得する行為であり、**インストール前にソースをレビュー**するのがユーザー責任
- サプライチェーン攻撃耐性のため `--pin <tag>` を使う（後追いの悪意あるリリースを取り込まない）
- 配布側は `cli/gh-extension-precompile` の `gpg_fingerprint` / `generate_attestations` を使うとチェックサム署名・ビルド由来証明が付与できる
- 組織運用では「許可した拡張だけ入れる」運用ルール + `gh extension list` で所有者を確認

## AI エージェントがよくやるミス

1. **`gh-` プレフィックス忘れ** — リポ名が `my-tool` だと拡張として認識されない。必ず `gh-my-tool` で作成・公開する
2. **`gh extension install` をフラグなしで CI に書く** — 未指定だと最新リリースを引き、ある日突然壊れる。CI では `--pin <tag>` を付ける
3. **`gh-projects` を新規にインストール** — 既に `gh project` として本体内蔵済み。新規導入では拡張をインストールせず本体コマンドを使う
4. **コア `gh` コマンドと衝突する拡張名を作る** — `gh-pr` や `gh-issue` のような名前は本体に隠される。衝突時は `gh extension exec` で逃げる必要があり、利用者体験が悪い
5. **プライベート拡張で `GITHUB_TOKEN` を使う** — 別リポへの権限がないため 404。PAT または GitHub App トークンを使う
6. **`gh-extension-precompile@v1` をテンプレートからコピー** — 新しい Go との組み合わせで build が失敗する。新規拡張は `@v2` を使う

## 参考

- [Using GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/using-github-cli-extensions)
- [Creating GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/creating-github-cli-extensions)
- [`gh extension` manual](https://cli.github.com/manual/gh_extension)
- [`cli/gh-extension-precompile`](https://github.com/cli/gh-extension-precompile)
- [github.com/topics/gh-extension](https://github.com/topics/gh-extension)
