# yamllint

YAML ファイルの構文と**スタイル**を検証する Linter。Python 製。インデント、行長、コメントフォーマット、truthy 値の扱い等、YAML 特有の落とし穴を検出する。

公式: [github.com/adrienverge/yamllint](https://github.com/adrienverge/yamllint)

## インストール

```bash
# mise + pipx
mise use pipx:yamllint@1

# pipx（推奨、他の Python 依存と隔離）
pipx install yamllint

# pip
pip install yamllint

# Homebrew
brew install yamllint
```

## 基本的な使い方

```bash
# 単一ファイル
yamllint config.yaml

# 再帰
yamllint .

# 設定指定
yamllint -c .yamllint.yaml .

# フォーマット指定
yamllint -f parsable .         # gcc 互換（エディタ統合向け）
yamllint -f github .           # GitHub Actions 注釈
yamllint -f colored .          # カラー
yamllint -f standard .         # デフォルト
```

## 内蔵 preset

| preset | 特徴 |
|---|---|
| `default` | 標準ルール一式 |
| `relaxed` | 緩め。警告のみに近い |

```yaml
# .yamllint.yaml
extends: default

rules:
  line-length:
    max: 120
```

## 主要ルール

| ルール | 意味 |
|---|---|
| `indentation` | インデント幅（spaces-consistent, sequences） |
| `line-length` | 最大行長（デフォルト 80） |
| `trailing-spaces` | 行末スペース禁止 |
| `new-line-at-end-of-file` | 末尾改行必須 |
| `truthy` | `yes`/`no`/`on`/`off` の扱い。bool として解釈されないことを警告 |
| `key-duplicates` | 同一キー重複 |
| `document-start` | `---` の有無 |
| `empty-lines` | 連続空行の上限 |
| `brackets` / `braces` | 括弧の前後スペース |
| `comments` | `#` と本文の間のスペース |
| `comments-indentation` | コメントのインデント |
| `quoted-strings` | 文字列のクオート方針 |

## 設定 `.yamllint.yaml`

```yaml
extends: default

rules:
  line-length:
    max: 120
    level: warning
  truthy:
    check-keys: false        # GitHub Actions の `on:` 等を許容
  comments:
    min-spaces-from-content: 1
  document-start: disable

ignore: |
  node_modules/
  dist/
  .git/
```

`.yamllintignore` にも除外パターンを書ける（.gitignore 風）。

## ルールの severity

各ルールは以下のいずれか:

- `enable` / `disable`（プリセットの値を継承）
- `error` — 違反で非 0 終了
- `warning` — レポートするが非 0 にしない

```yaml
rules:
  line-length:
    max: 120
    level: warning
```

## 個別抑制

行またはブロックで `yamllint` ディレクティブを使う:

```yaml
# yamllint disable-line rule:line-length
very-long-line-that-exceeds-120-chars-yadda-yadda-yadda-yadda-yadda

# yamllint disable rule:truthy
deprecated: yes
production: no
# yamllint enable rule:truthy
```

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    yaml:
      glob: "**/*.{yaml,yml}"
      run: yamlfmt {staged_files} && yamllint -c .yamllint.yaml {staged_files}
      stage_fixed: true
```

yamlfmt で整形 → yamllint で検証の順が推奨。

## CI での使い方

```yaml
- run: yamllint -f github .    # GitHub Actions に注釈として表示
```

SARIF 出力には対応していないため、生テキスト or `parsable` フォーマットを使う。

## よくある問題

### `truthy` ルールで GitHub Actions が警告される

GitHub Actions の `on:` は yaml として `true` に解釈される（予約語）:

```yaml
on:
  push:
    branches: [main]
```

`truthy.check-keys: false` を設定で許容。

### インデント揺れ

sequence（`- item`）のインデントに流派がある:

```yaml
# indent-sequences: true（推奨、デフォルト）
list:
  - a
  - b

# indent-sequences: false
list:
- a
- b
```

`.yamllint.yaml` で `indentation.indent-sequences` を統一。

### 行長 80 が厳しい

実用では 100-120 が現実的。`line-length.max` を引き上げる or `level: warning` に落とす。

### Helm / Ansible テンプレートで誤検知

`{{ ... }}` / `{% %}` が非 YAML 記法で壊れる。yamllint は Go template / Jinja を理解しないため、該当ディレクトリは `.yamllintignore` で除外が実務的。

## yamlfmt との使い分け

- **yamllint**: **lint**（バリデーション）。自動修正しない
- **yamlfmt**: **format**。自動整形

両方通すのが理想。lint を通すために format が必要な指摘（trailing-spaces, new-line-at-end-of-file 等）が多いため、yamlfmt を先に走らせる。

## エディタ統合

- **VS Code**: [YAML 拡張](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml)（JSON Schema 検証とは別だが併用可）
- **Neovim**: null-ls / efm-langserver 経由

保存時 lint が効くと書きながら直せる。

## 他ツールとの比較

| 観点 | yamllint | Spectral | check-yaml (pre-commit) |
|---|---|---|---|
| 検査範囲 | YAML 構文 + スタイル | JSON Schema + OpenAPI 等 | パース可否のみ |
| 言語 | Python | Node.js | Python |
| カスタマイズ | ルール設定 | 強力（DSL） | 限定 |
| 用途 | 汎用 YAML | スキーマ検証 | 最小限の健全性 |

一般的な YAML ファイル品質なら yamllint。特定スキーマ（OpenAPI、Kubernetes 等）には Spectral や JSON Schema 検証を併用。
