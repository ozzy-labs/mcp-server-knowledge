---
reviewed: 2026-04-18
---

# ShellCheck

Bash / POSIX sh スクリプトの静的解析ツール。よくあるバグ・移植性問題・クオート抜けなど、エディタと目視では拾いきれない問題を検出する。Haskell 製。

公式: [shellcheck.net](https://www.shellcheck.net/) / [github.com/koalaman/shellcheck](https://github.com/koalaman/shellcheck)

## インストール

```bash
# mise
mise use shellcheck@0.11

# Homebrew
brew install shellcheck

# apt
sudo apt install shellcheck

# Docker
docker run --rm -v "$PWD:/mnt" koalaman/shellcheck:stable myscript.sh
```

## 基本的な使い方

```bash
# 単一ファイル
shellcheck script.sh

# 複数ファイル（glob）
shellcheck scripts/*.sh

# 再帰
shellcheck **/*.sh

# フォーマット指定
shellcheck -f gcc script.sh       # gcc 互換（エディタ統合向け）
shellcheck -f json script.sh      # JSON
shellcheck -f sarif script.sh     # SARIF（GitHub Security タブ）

# 最小深刻度
shellcheck -S error script.sh     # error のみ
shellcheck -S warning script.sh   # warning 以上
```

## shebang と shell 判定

shellcheck はスクリプトの**shebang**または`-s`フラグで対象 shell を決める:

```bash
#!/bin/bash       # bash
#!/bin/sh         # POSIX sh（互換性厳格）
#!/usr/bin/env bash
```

**sh と bash で挙動が大きく異なる**: `[[ ]]`、`$()` 内の複雑な構文、配列、etc. は POSIX sh では動かない。shebang を正しく付けることが最優先。

## 典型的な指摘

| コード | 意味 | 例 |
|---|---|---|
| `SC2086` | 未クオート変数展開 | `echo $var` → `echo "$var"` |
| `SC2046` | コマンド置換の未クオート | `cp $(ls)` → `cp "$(ls)"`（本質的には while read 推奨） |
| `SC2155` | `declare` + 代入で終了コードがマスクされる | `local x=$(cmd)` → 2 行に分ける |
| `SC2181` | `$?` の直接比較 | `cmd; if [ $? -ne 0 ]` → `if ! cmd` |
| `SC2164` | `cd` の失敗チェック欠落 | `cd dir` → `cd dir \|\| exit` |
| `SC2016` | 単引用符内の `$var` は展開されない | 意図的なら `# shellcheck disable=SC2016` |
| `SC2034` | 未使用変数 | 参照されない代入 |
| `SC2059` | `printf` フォーマット文字列に変数 | `printf "$var"` → `printf "%s" "$var"` |
| `SC2012` | `ls` を parse してはいけない | `for f in $(ls)` → `for f in *` |

完全リスト: [shellcheck wiki](https://www.shellcheck.net/wiki/)

## 抑制

### 行単位

```bash
# shellcheck disable=SC2086
echo $var   # 意図的に未クオート
```

### ブロック / 関数

```bash
# shellcheck disable=SC2086
function f() {
  echo $1
  echo $2
}
```

### ファイル全体

スクリプト先頭（shebang の次行）:

```bash
#!/bin/bash
# shellcheck shell=bash
# shellcheck disable=SC2086,SC2034

...
```

### プロジェクト全体（`.shellcheckrc`）

```text
disable=SC2086
enable=require-double-brackets
external-sources=true
source-path=SCRIPTDIR
```

リポジトリルートに置く。

## ソース指定

別ファイルを `source` で読む場合、shellcheck に場所を教える:

```bash
# shellcheck source=./lib/common.sh
source "$(dirname "$0")/lib/common.sh"
```

あるいは `.shellcheckrc` に `source-path=SCRIPTDIR` を書けば自動解決。

## shfmt との組み合わせ

- **shellcheck**: 「意味的」な問題検出
- **shfmt**: 「構文的」なフォーマッティング

両方パスで健全。lefthook 等で併用するのが定番:

```yaml
pre-commit:
  commands:
    shell:
      glob: "**/*.sh"
      run: shfmt -w {staged_files} && shellcheck {staged_files}
      stage_fixed: true
```

## CI での使い方

```yaml
- name: Run ShellCheck
  uses: ludeeus/action-shellcheck@master
  with:
    severity: warning
    scandir: ./scripts
```

または生コマンド:

```yaml
- run: find . -name "*.sh" -not -path "./node_modules/*" | xargs shellcheck
```

SARIF 出力を GitHub Security タブに上げる:

```yaml
- run: shellcheck -f sarif $(find . -name "*.sh") > shellcheck.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: shellcheck.sarif
```

## よくある難所

### `set -eu` を先頭に書いていても気が付かない問題

shellcheck は `set -eu` の有無に関わらず問題を指摘する（set の有無とバグの有無は別）。`#!/bin/bash` の直後に `set -euo pipefail` を書くのは別途ベストプラクティス。

### `[[ ]]` vs `[ ]`

- `[[ ]]`: bash / ksh / zsh の拡張構文。変数展開時のクオート不要、`&&` / `||` サポート
- `[ ]`: POSIX sh 互換の `test` コマンド。クオート必須

bash スクリプトなら `[[ ]]` を使うのが推奨（shellcheck も `[[ ]]` を推奨）。

### eval を使いたくなったら負け

動的なコマンド生成は `eval` 以外の方法を検討する。shellcheck は `eval` 自体は警告しないが、多くの shellcheck ルール（SC2086 等）が `eval` 周辺で頻出する。

## エディタ統合

- VS Code: [ShellCheck 拡張](https://marketplace.visualstudio.com/items?itemName=timonwong.shellcheck)
- Neovim: null-ls / efm-langserver / ALE
- Emacs: flycheck-shellcheck

保存時にリアルタイム警告を出せると開発体験が大きく向上する。

## 他ツールとの比較

| 観点 | shellcheck | bashate | shfmt |
|---|---|---|---|
| 対象 | sh / bash / dash / ksh | bash のみ | sh / bash |
| 検査範囲 | 意味・移植性・バグ | スタイル寄り | フォーマット |
| 精度 | 非常に高 | 中 | — |
| エコシステム | デファクト標準 | 小 | デファクト標準 |

POSIX 互換を重視するプロジェクトでは shellcheck + shfmt の組み合わせで十分。
