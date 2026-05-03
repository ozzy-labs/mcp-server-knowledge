---
reviewed: 2026-05-04
tags: [format, bash, go]
---

# shfmt

Go 製のシェルスクリプトフォーマッタ。bash / mksh / POSIX sh / zsh のパース + 整形を一貫して行う（zsh は v3.13.0 から）。shellcheck と並んで shell スクリプト運用のデファクトツール。

公式: [github.com/mvdan/sh](https://github.com/mvdan/sh)

## インストール

```bash
# mise
mise use shfmt@3

# Homebrew
brew install shfmt

# Go
go install mvdan.cc/sh/v3/cmd/shfmt@latest

# Docker
docker run --rm -v "$PWD:/mnt" mvdan/shfmt:latest -w /mnt
```

## 基本的な使い方

```bash
# 差分表示（変更しない）
shfmt -d script.sh

# 標準出力に整形結果
shfmt script.sh

# ファイルに書き戻し
shfmt -w script.sh

# 再帰ディレクトリ
shfmt -w .

# 特定 shell 方言指定
shfmt -ln bash script.sh   # bash
shfmt -ln posix script.sh  # POSIX sh
shfmt -ln mksh script.sh   # mksh
shfmt -ln zsh script.sh    # zsh（v3.13.0+）
```

## 主要フラグ

| フラグ | 意味 | デフォルト |
|---|---|---|
| `-w` | ファイルに書き戻し | — |
| `-d` | diff 表示 | — |
| `-l` | 変更が必要なファイル名のみ表示 | — |
| `-i <N>` | インデント幅（スペース数、0 でタブ） | 0（タブ） |
| `-bn` | `&&` / `\|\|` 等を行頭に置く | false |
| `-ci` | `case` の `)` を字下げ | false |
| `-sr` | リダイレクト前にスペース | false |
| `-kp` | 余分な空行を保持 | false |
| `-fn` | 関数の開き `{` を次行に | false |
| `-ln <variant>` | shell 方言 | shebang から自動 |
| `-s` | 簡略化（`[ ... ]` → `[[ ... ]]` 等） | false |

## 設定 `.editorconfig`

shfmt は `.editorconfig` を自動読み込み（`[*.sh]` セクション）:

```ini
[*.sh]
indent_style = space
indent_size = 2
binary_next_line = true
switch_case_indent = true
space_redirects = true
```

v3.13.1 から `[[zsh]]` セクションも認識し、`.zshrc` / `.bash_profile` 等のファイル名から方言を自動推定する。EditorConfig 経由で統一すると、他ツール（エディタ、prettier 等）と一貫できる。

## フォーマット例

```bash
# Before
if [[ $x = "foo" ]]
then
    echo "foo"
fi

# After（デフォルト）
if [[ $x = "foo" ]]; then
 echo "foo"
fi

# With -s（simplify）
if [[ $x == "foo" ]]; then
 echo "foo"
fi
```

## shebang と方言の自動検出

shfmt は shebang を見て方言を決定:

```bash
#!/bin/bash       → bash
#!/bin/sh         → POSIX sh
#!/usr/bin/env bash → bash
#!/bin/zsh        → zsh（v3.13.0+）
```

shebang がない場合は `-ln` で明示。`.zshrc` / `.bash_profile` などのファイル名は v3.13.1 以降自動で方言が決まる。

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    shell:
      glob: "**/*.sh"
      run: shfmt -w {staged_files} && shellcheck {staged_files}
      stage_fixed: true
```

`shfmt -w` でフォーマット → `shellcheck` で意味チェック → `stage_fixed` で再ステージ。この順が推奨。

## CI での使い方

```bash
# フォーマット準拠チェック（書き戻さない）
shfmt -d -l .

# 非 0 終了でチェック失敗
if [ -n "$(shfmt -l .)" ]; then
  echo "Format issues:"
  shfmt -d .
  exit 1
fi
```

## エディタ統合

- **VS Code**: [shell-format 拡張](https://marketplace.visualstudio.com/items?itemName=foxundermoon.shell-format)。`editor.defaultFormatter` を指定
- **Neovim**: null-ls / conform.nvim
- **IntelliJ / GoLand**: plugin あり

保存時自動フォーマットが開発体験上の正解。

## よくある誤解

- **shfmt は意味チェックしない** — 純粋にフォーマッタ。バグ検出は shellcheck の役目
- **タブデフォルト** — `-i 2` を明示しないと実インデントはタブ。EditorConfig で統一推奨
- **`-s` は破壊的に見えて安全** — `[ ]` → `[[ ]]` 等の変換は意味同等（bash 限定）
- **shebang の有無で出力が変わる** — 無シェバン bash スクリプトは `-ln bash` を付けるか shebang を付ける

## 他ツールとの比較

| 観点 | shfmt | beautysh | bashate |
|---|---|---|---|
| 言語 | Go | Python | Python |
| 速度 | 速い | 遅い | 遅い |
| 対応方言 | bash/sh/mksh | bash | bash |
| フォーマット精度 | 高 | 中 | なし（lint のみ） |
| メンテ | 活発 | 緩やか | 緩やか |

shellcheck（lint）+ shfmt（format）の二段構えが現代のシェルスクリプト運用標準。
