---
reviewed: 2026-05-04
tags: [format, yaml, go]
---

# yamlfmt

Google 製の YAML フォーマッタ。Go で書かれた単一バイナリ。インデント・行末・キー順などを一貫した形に整形する。yamllint（検証）と対になる。

公式: [github.com/google/yamlfmt](https://github.com/google/yamlfmt)

## インストール

```bash
# mise
mise use yamlfmt@0.21

# Homebrew
brew install yamlfmt

# Go
go install github.com/google/yamlfmt/cmd/yamlfmt@latest

# Docker
docker run --rm -v "$PWD:/workdir" ghcr.io/google/yamlfmt:latest -lint
```

## 基本的な使い方

```bash
# 書き戻し（デフォルト）
yamlfmt file.yaml

# 再帰
yamlfmt .

# フォーマット済みかチェック（書き戻さない）
yamlfmt -lint file.yaml

# 差分表示
yamlfmt -dry -output_format=diff file.yaml

# 設定指定
yamlfmt -conf .yamlfmt
```

## 設定 `.yamlfmt`

YAML / JSON 両対応:

```yaml
# .yamlfmt
formatter:
  type: basic
  indent: 2
  include_document_start: false
  retain_line_breaks_single: true
  scan_folded_as_literal: true
  max_line_length: 120
  trim_trailing_whitespace: true

include:
  - "**/*.yaml"
  - "**/*.yml"

exclude:
  - "node_modules/**"
  - ".git/**"
  - "dist/**"
  - "pnpm-lock.yaml"

gitignore_excludes: true
```

## 主要フォーマッタオプション

| オプション | 効果 |
|---|---|
| `indent` | インデント幅（デフォルト 2） |
| `line_ending` | `lf` / `crlf` |
| `max_line_length` | 長い行の折り返し（0 = 無制限） |
| `include_document_start` | 先頭 `---` を強制 |
| `trim_trailing_whitespace` | 行末スペース削除 |
| `eof_newline` | 末尾改行を保証 |
| `retain_line_breaks` | 連続空行を保持 |
| `retain_line_breaks_single` | 連続空行を 1 行に圧縮 |
| `scan_folded_as_literal` | `>` を `\|` として扱う |
| `disallow_anchors` | アンカー禁止（共有設定で混乱を避ける） |

## ディレクティブ

行単位・ブロック単位の整形抑制はサポートされない。整形を避けたい箇所は `.yamlfmt` の `exclude` でファイル単位で除外する。

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    yaml:
      glob: "**/*.{yaml,yml}"
      run: yamlfmt {staged_files} && yamllint -c .yamllint.yaml {staged_files}
      stage_fixed: true
```

フォーマット → lint の順で実行。`stage_fixed: true` で整形後の差分を再ステージ。

## CI での使い方

```bash
# CI モード（差分があれば非 0 終了）
yamlfmt -lint .
```

GitHub Actions（公式 Action はないため、バイナリを実行する）:

```yaml
- name: Run yamlfmt
  run: |
    docker run --rm -v "$PWD:/workdir" ghcr.io/google/yamlfmt:latest -lint .
```

または `mise` でバージョンを揃える:

```yaml
- uses: jdx/mise-action@v2
- run: yamlfmt -lint .
```

## 再現性のある運用

整形結果を安定させるために:

- `.yamlfmt` をリポジトリにコミット
- `mise use yamlfmt@<version>` でバージョン固定
- 初回適用は別コミットに（`style: apply yamlfmt` 等）、`.git-blame-ignore-revs` で blame から除外

## アンカーと参照

YAML の `&anchor` / `*anchor` はフォーマッタで展開されない（意味が変わるため）。使っている場合は意図通りか目視確認必須。`disallow_anchors: true` で禁止して明示的なコピーに強制するのも手。

## 複雑な型の扱い

```yaml
# block style（デフォルト保持）
list:
  - a
  - b

# flow style（強制変換しない、ユーザー指定を尊重）
list: [a, b]
```

yamlfmt は既存のスタイル（block / flow）を変えず、インデントと行末のみ整える保守的な方針。

## trouble shooting

### `document_start` が勝手に挿入される

デフォルト設定を確認。`include_document_start: false` で抑止。

### Helm / Ansible の template 構文で壊れる

`{{ }}` / `{% %}` は YAML として解析できないため、`exclude` で対象ディレクトリを除外。

### pnpm-lock.yaml を整形して lockfile が壊れる

lockfile は絶対に手で整形しない。`exclude: [pnpm-lock.yaml]` を必ず入れる。

### yamllint と衝突する

yamllint で「trailing-spaces」警告が出るなら yamlfmt の `trim_trailing_whitespace: true` で自動修正される。ルール設定を両ツールで揃える。

## 他ツールとの比較

| 観点 | yamlfmt | Prettier (YAML) | yq |
|---|---|---|---|
| 用途 | フォーマッタ専用 | 多言語フォーマッタ | パーサ + クエリ + フォーマット |
| 言語 | Go | Node.js | Go |
| 保守的整形 | ◎ | ○ | △（クエリ副作用あり） |
| 設定柔軟性 | 中 | 高 | — |

Prettier を他言語で既に使っているなら Prettier の YAML プラグインで十分な場合もある。shell ツールのみで完結させたい / Go バイナリで速度を出したいなら yamlfmt。
