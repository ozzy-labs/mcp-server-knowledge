---
reviewed: 2026-05-03
tags: [task-runner, rust]
---

# just

プロジェクト固有のコマンドを `justfile` に集約して実行するコマンドランナー。**ビルドシステムではない**ので make の依存解決・タイムスタンプ追跡を持たず、その分シンプル。`.PHONY` 不要、引数・デフォルト値・属性が宣言的に書ける。AI エージェントが Makefile 風に書いて落とし穴に嵌まりやすい領域なので、make との差分を押さえることが重要。

公式: [just.systems](https://just.systems/) / [just.systems/man/en](https://just.systems/man/en/)

## インストール

```bash
# Homebrew
brew install just

# mise
mise use just

# cargo
cargo install just

# 公式インストールスクリプト
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# WinGet
winget install --id Casey.Just -e
```

## 基本

```bash
just                # 既定レシピを実行（justfile の最初）
just <recipe>       # 指定レシピを実行
just -l             # レシピ一覧
just --evaluate     # 変数を評価して表示
just --fmt          # justfile を整形（要 `--unstable` または stable 後の現行版）
just --choose       # 対話的にレシピを選択
just --dry-run -n   # 実行せず内容だけ表示
```

`justfile` はカレント、その親、**親ディレクトリを再帰的に**探索される。サブディレクトリから実行しても動く。

## `justfile` の最小例

```just
# justfile

default: build test    # 最初のレシピが既定。複数の依存を並べる

build:
    cargo build

test:
    cargo test

# パラメータと既定値
release version="dev":
    cargo build --release
    git tag v{{version}}
```

```bash
just                # build → test
just release        # version=dev で実行
just release 1.2.0  # version=1.2.0
```

### 依存・引数の渡し方

```just
fmt: clean
    cargo fmt

# 依存にも引数を渡せる
deploy env: (build env) (test env)
    ./scripts/deploy.sh {{env}}

build env:
    cargo build --release --features {{env}}
```

`(recipe args)` 形式で依存先のレシピに引数を渡す。

### 可変長引数

```just
# 0 個以上
run *args:
    cargo run -- {{args}}

# 1 個以上
push +files:
    git add {{files}}
    git commit -m "update"
```

## 変数と式

```just
project := "myapp"
version := "1.0.0"
target_dir := justfile_directory() / "target"     # 関数 + パス連結
hash := `git rev-parse --short HEAD`              # backtick でシェル実行

build:
    @echo "Building {{project}} v{{version}} ({{hash}})"
    cargo build --target-dir {{target_dir}}
```

主要な組み込み関数: `justfile_directory()` / `invocation_directory()` / `env_var("KEY")` / `env_var_or_default("KEY", "fallback")` / `os()` / `arch()` / `uppercase()` / `lowercase()` / `clean()`。

## レシピ属性

```just
[private]
_helper:
    echo internal

[group('test')]
unit:
    cargo test --lib

[confirm("本当に削除する？")]
nuke:
    rm -rf target

[linux]
[macos]
deps:
    brew install ripgrep

[windows]
deps:
    winget install BurntSushi.ripgrep.MSVC

[no-cd]
sibling:
    pwd                    # justfile のあるディレクトリに cd しない

[working-directory: 'src']
build:
    cargo build

[script("python3")]
analyze:
    import csv
    print("python から実行")

[doc("リリースの実行")]
release:
    ./release.sh
```

| 属性 | 用途 |
|---|---|
| `[private]` | `just -l` から隠し、`just` 直接呼びを禁止 |
| `[group('name')]` | 一覧でグループ化 |
| `[confirm("msg")]` | 実行前に確認プロンプト |
| `[no-cd]` | デフォルトの「justfile のあるディレクトリに cd」を無効化 |
| `[linux]` / `[macos]` / `[windows]` / `[unix]` / `[openbsd]` | OS フィルタ |
| `[working-directory: '<path>']` | レシピ単位の作業ディレクトリ |
| `[script("interpreter")]` | レシピ本体を別言語のスクリプトとして実行 |
| `[doc("...")]` | `just -l` の説明テキスト |
| `[positional-arguments]` | 引数を `$1` `$2` で受け取る（`{{var}}` ではなく） |
| `[no-exit-message]` | 失敗時の `error: Recipe ...` を抑制 |

## 設定 (`set`)

```just
set shell := ["bash", "-uc"]                # シェルを bash に固定
set windows-shell := ["powershell.exe"]
set dotenv-load := true                     # .env を読む
set dotenv-required := true                 # .env が無いとエラー
set positional-arguments := true            # $1, $2, ... で引数受け取り
set export := true                          # 全変数を環境変数に export
set fallback := true                        # 親ディレクトリの justfile も探す
set working-directory := "subproject"
```

| 設定 | 用途 |
|---|---|
| `shell` | レシピと backtick 実行に使うシェル |
| `windows-shell` | Windows での同上 |
| `dotenv-load` | `.env` を自動ロード |
| `dotenv-filename` | `.env` 以外のファイル名 |
| `dotenv-path` | 任意パス |
| `dotenv-override` | 既存環境変数を `.env` で上書き |
| `dotenv-required` | `.env` 必須 |
| `export` | 変数を環境変数に export |
| `positional-arguments` | レシピで `$1` `$2` を有効化 |
| `fallback` | 親 `justfile` をフォールバック |
| `allow-duplicate-recipes` | 後勝ちで上書き許容 |
| `ignore-comments` | `#` 行をスキップ |

## 別言語をレシピに書く

```just
# Python レシピ
analyze:
    #!/usr/bin/env python3
    import json, sys
    data = json.load(open("data.json"))
    print(len(data))

# Node.js レシピ
gen:
    #!/usr/bin/env node
    console.log(process.argv);
```

shebang から始まると `just` はレシピを単一スクリプトとして実行する。複数行を 1 プロセスで処理したいときに使う（既定では各行が独立した bash プロセス）。

## make との違い

| 観点 | just | make |
|---|---|---|
| ビルド差分 | **なし**（毎回実行） | タイムスタンプで差分判定 |
| `.PHONY` | 不要 | 必須（さもないとファイル名と衝突） |
| 引数 | レシピの第一級機能 | `target=value` で渡す（読みづらい） |
| OS 切替 | 属性で宣言的 | `ifeq` で分岐 |
| エラー表示 | 行番号 + 失敗レシピ名 | 暗号的 |
| 既定タブ | スペース可 | **タブ強制** |
| 並列実行 | しない | `-j` で可 |

`just` は**ビルドではなくコマンドランナー**。`Makefile` で増分ビルドを使っているなら `just` への置き換えはむしろ機能ダウン。`package.json` の `scripts` の自然な進化形と捉えるとよい。

## AI エージェントがよくやるミス

1. **`.PHONY` を書く** — `just` には不要。書くと正体不明のレシピ扱いになる
2. **タブを強制すると思い込む** — スペースインデント可。タブを混ぜると `error: Inconsistent leading whitespace` になる
3. **`$VAR` をレシピ内で使う** — 既定では `{{var}}` の二重ブレース。`$VAR` はシェル変数として展開される（`set positional-arguments` 時のみ `$1` `$2` が有効）
4. **依存にもコマンドラインフラグを書こうとする** — 依存は `(recipe args)` で引数を渡す。`build --release` のような書き方は属性ではなくレシピ呼び出し
5. **make の `@` をそのまま流用してエコーが変わらない** — `just` でも先頭 `@` で「コマンド非表示」になるが、`@` の挙動はやや異なる。`set quiet` で全体抑制が無難
6. **`set shell := ["bash", "-c"]` だけ書く** — `-u` `-e` `-o pipefail` を併記しないと bash の既定で失敗を見逃す
7. **`.env` を期待しているのに `set dotenv-load := true` を忘れる** — 既定はオフ
8. **`just` 単体で並列実行を期待する** — 並列実行は無い。並列にしたいレシピ内で `&` または `xargs -P` を使う

## 関連

- [`tools/mise.md`](mise.md) — mise の `tasks` も類似機能を持つ。プロジェクトで両用するならどちらに寄せるか決める
- [`tools/lefthook.md`](lefthook.md) — Git フック専用ツールとは責務が分かれる
- [`languages/bash.md`](../languages/bash.md) — レシピ本文を bash で書く前提知識

## 参考

- [Just Programmer's Manual](https://just.systems/man/en/)
- [casey/just (GitHub)](https://github.com/casey/just)
- [Settings Reference](https://just.systems/man/en/settings.html)
