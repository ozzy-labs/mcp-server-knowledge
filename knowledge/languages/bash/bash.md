---
reviewed: 2026-05-10
tags: [bash]
---

# Bash / POSIX shell

AI コーディングエージェントが最も頻繁に書く言語のひとつ。落とし穴は大半が「変数展開」「終了コード」「サブシェル境界」に集中する。ツール記事は `tools/shellcheck.md` / `tools/shfmt.md` を参照。

公式: [GNU Bash Manual](https://www.gnu.org/software/bash/manual/bash.html) / [POSIX.1-2024 Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)

## Bash と POSIX sh の関係

| | Bash | POSIX sh |
|---|---|---|
| 現行 | 5.3 (2025-07) | IEEE Std 1003.1-2024 (Issue 8) |
| 配列 / 連想配列 | あり | なし |
| `[[ ... ]]` / `=~` | あり | なし |
| Process substitution `<(...)` | あり | なし |
| `local` | あり | Issue 8 で追加（要確認） |
| `pipefail` | あり | Issue 8 で標準化 |

- **開発スクリプト**は迷わず Bash 固定（`#!/usr/bin/env bash`）。表現力と安全性が段違い。
- **配布物 / Alpine / initramfs / Docker scratch 系**は `/bin/sh` 縛りが必要。POSIX のみに絞る。
- macOS の `/bin/bash` は**bash 3.2 (GPLv2)** で固定されている。配列など 4.x 以降の機能は使えない。

## Shebang

```bash
#!/usr/bin/env bash   # 推奨: PATH の bash を使う（Homebrew 5.x, mise/asdf 管理下も追従）
#!/bin/bash           # 非推奨: macOS は 3.2 固定、Alpine には存在しない
#!/bin/sh             # POSIX 縛り: ash/dash/bash --posix のどれにもなる
```

セキュリティが厳しい root スクリプト（setuid 相当）は PATH 依存を嫌って `#!/bin/bash` を選ぶ運用もある。通常の CI / 開発スクリプトは `env` 版で統一。

## Strict mode

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

| フラグ | 効果 |
|---|---|
| `-e` (errexit) | コマンド失敗で即 exit |
| `-u` (nounset) | 未定義変数参照で exit |
| `-o pipefail` | パイプ内のどれか 1 つでも失敗すれば非 0 exit |
| `-E` (errtrace) | `ERR` trap をサブシェル・関数にも継承 |
| `IFS=$'\n\t'` | 単語分割をタブと改行のみに（スペース混入ファイル名対策） |

### errexit が効かないケース

1. `if cmd; then ...` の `cmd` は失敗しても exit しない（仕様）。
2. `local var=$(cmd)` は `local` の 0 が戻り値をマスクする → 宣言と代入を分離する。
3. `$(...)` の内部は errexit を継承しない。Bash 4.4+ では `shopt -s inherit_errexit` で継承。
4. 関数を `if f`, `!f`, `f && ...` の**条件文脈**で呼ぶと関数内の `-e` が無効化される。
5. Process substitution `<(cmd)` の失敗は呼び出し側の終了コードに反映されない。

詳細は [Wooledge BashFAQ/105](https://mywiki.wooledge.org/BashFAQ/105)。

## Quoting と変数展開

```bash
# NG: スペース入りファイル名で壊れる（SC2086）
rm $file

# OK
rm -- "$file"
```

### `"$@"` vs `"$*"`

```bash
"$@"   # 各引数を個別の単語として展開（ループに渡すならこれ）
"$*"   # IFS の先頭 1 文字で結合した単一文字列
```

配列も同じ: `"${arr[@]}"` vs `"${arr[*]}"`。

### パラメータ展開

| 構文 | 意味 |
|---|---|
| `${var:-word}` | unset/null なら `word` を返す（代入はしない） |
| `${var:=word}` | unset/null なら `word` を**代入**して返す |
| `${var:?msg}` | unset/null なら `msg` を stderr に出して非 0 exit |
| `${var:+word}` | set なら `word`、unset なら空 |
| `${#var}` | 文字列長 |
| `${var#pat}` / `${var##pat}` | 前方短/最長一致削除（POSIX） |
| `${var%pat}` / `${var%%pat}` | 後方短/最長一致削除（POSIX） |
| `${var/pat/repl}` / `${var//pat/repl}` | 先頭 1 回 / 全置換（Bash 拡張） |

## Test コマンド

| 観点 | `[ ]`（POSIX） | `[[ ]]`（Bash） |
|---|---|---|
| 変数クオート | 必須 | 不要 |
| `&&` / `\|\|` 内部使用 | NG | OK |
| 正規表現 `=~` | なし | あり（右辺はクオートしない） |
| Glob パターン `==` | なし | あり |

```bash
# Bash
[[ $file == *.txt ]] && echo "text file"
[[ $addr =~ ^[0-9]+\.[0-9]+$ ]] && echo "captured: ${BASH_REMATCH[0]}"

# POSIX
[ "$x" = "a" ] && [ "$y" = "b" ]   # 外側で && を繋ぐ
```

## 配列と連想配列

インデックス配列は Bash 2.0+ から。**連想配列** (`declare -A`) は Bash 4.0+ が必要で、macOS 標準 3.2 では使えない点に注意。

```bash
declare -a arr=(a b c)
declare -A map=([k1]=v1 [k2]=v2)

echo "${arr[@]}"       # 全要素を個別単語に
echo "${#arr[@]}"      # 要素数
echo "${!map[@]}"      # キー一覧
echo "${arr[@]:1:2}"   # オフセット 1 から 2 個
```

Bash 4.3 以前では空配列 + `set -u` + `"${arr[@]}"` が "unbound" エラーになる。4.4+ で解消。

## 関数と return

```bash
# POSIX 互換: function キーワードは付けない
my_func() {
  local output                    # ① 宣言と代入を分離
  output=$(some_command) || return 1
  printf '%s\n' "$output"
}

result=$(my_func) || exit 1
```

- `function f() { ... }` の `function` キーワードは Bash / ksh / zsh 拡張。**POSIX 互換が必要なら `f() { ... }` のみ**を使う。
- 関数の「戻り値」は**終了コードのみ**。データは stdout か変数経由で返す。
- 変数はデフォルトでグローバル。**必ず `local` で宣言**する。
- `local var=$(cmd)` は終了コードがマスクされる（SC2155）→ 宣言と代入を分離。

## サブシェルとパイプの境界

```bash
# NG: while read はサブシェル実行 → count が外に漏れない
count=0
find . -type f | while read -r f; do
  ((count++))
done
echo "$count"   # => 0

# OK1: process substitution（Bash）
count=0
while IFS= read -r -d '' f; do
  ((count++))
done < <(find . -type f -print0)
echo "$count"

# OK2: mapfile（Bash 4+）
mapfile -t files < <(find . -type f)
count=${#files[@]}
```

- `(cmd)` はサブシェル、`{ cmd; }` は現シェル（変数変更が伝わる）。
- `shopt -s lastpipe`（Bash 4.2+、non-interactive 時のみ）でパイプ右側を現シェルで実行させる手もある。

## trap とクリーンアップ

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
trap 'echo "error at line $LINENO" >&2' ERR

# ... 作業 ...
```

- `EXIT` trap はスクリプト先頭（`mktemp` 直後）に置く。途中に置くと初期化失敗でクリーンアップされない。
- `ERR` trap を使うなら `set -E` (`errtrace`) を併用して関数・サブシェルに継承させる。
- macOS `mktemp` は GNU と `-t` の挙動が違う。移植性は `mktemp -d -t myapp.XXXXXX` のようにテンプレの `X` を明示する。

## ヒアドキュメント

```bash
# 変数展開あり
cat <<EOF
user=$USER
EOF

# 変数展開なし（クオートした区切りがポイント）
cat <<'EOF'
$USER is literal
EOF

# here-string（単一文字列を stdin へ）
read -r a b <<< "foo bar"
```

`<<-EOF` は**行頭タブのみ**を剥がす（スペースは残る）。ネストしたブロック内でインデントしたまま書くのに便利だが、エディタや markdownlint がタブをスペースに変換すると剥がれなくなるため、`.editorconfig` で該当ファイルのインデントをタブに固定すること。本 KB はタブを markdownlint が正規化するため、このリポでは `<<EOF` を推奨する。

## AI エージェントがよくやるミス

1. **未クオート変数** — `rm $file` は空白入り名で壊滅。`"$file"`。SC2086。
2. **`[ ]` 内で `&&`** — 構文エラー。`[ ... ] && [ ... ]` か `[[ ... && ... ]]` に。
3. **`ls | while read`** — ファイル名の空白・改行で壊れる。`find -print0` + `read -d ''` か `mapfile`。SC2012。
4. **`cd` 失敗を無視** — `cd /tmp; rm -rf *` の `cd` 失敗で `/` を消す事故。`cd /tmp || exit 1`。SC2164。
5. **`local var=$(cmd)`** — `set -e` しても抜けない。宣言と代入を分離。SC2155。
6. **`$?` を直接比較** — `cmd; if [ $? -eq 0 ]` → `if cmd; then` に。SC2181。
7. **`echo -e` / `echo -n` に依存** — POSIX では未定義。`printf '%s\n'` を使う。
8. **`eval $var`** — コマンドインジェクション温床。配列と `"${arr[@]}"` で置換。
9. **`sudo cmd > file`** — リダイレクト先は親 shell の権限で開かれる。`sudo tee file > /dev/null` が正。
10. **shebang と内容の不一致** — `#!/bin/sh` のまま `[[` / 配列 / `source` を書く。shellcheck が検出。
11. **`cd` しっぱなし** — サブシェル `(cd dir && cmd)` か `pushd`/`popd` で囲む。
12. **`|| true` の乱用** — `set -e` を実質無効化する。意図的に使うときはコメントを添える。

## トラブルシュート

### `unbound variable` が空配列で出る

Bash 4.3 以前の `set -u` + `"${arr[@]}"` の既知問題。4.4+ で解消。対症療法は `"${arr[@]:-}"`。

### macOS で連想配列が使えない

`/bin/bash` は 3.2。`#!/usr/bin/env bash` に変え、Homebrew の bash 5.x を `brew install bash` で入れて PATH に通す。

### `command not found` だが手元では動く

PATH 依存。CI は最小環境。`command -v cmd` で事前チェック、または絶対パス (`/usr/bin/jq`) を使う。

### pipefail を付けたら動かなくなった

`head` / `grep -q` などの早期終了が SIGPIPE を伝搬するケース。意図的に許容するなら `cmd1 | cmd2 || true`、または構造を `mapfile` + 配列処理に書き換える。

### シェルスクリプトで色が出ない

tty 判定を入れる: `[[ -t 1 ]] && red=$'\e[31m' reset=$'\e[0m'`。パイプやログ出力時に制御シーケンスが混入するのを防ぐ。

## 他ツールとの関係

- **git submodule**（`tools/git-submodule.md`）: 外部のシェルスクリプトライブラリをプロジェクトに取り込み、依存関係として管理する際に使用する。
- **ShellCheck**（`tools/shellcheck.md`）: 書いたら必ず通す。SC2086 / 2155 / 2164 は AI エージェントの定番ミス。
- **shfmt**（`tools/shfmt.md`）: フォーマッタ。`.editorconfig` で `indent_size` / `binary_next_line` / `space_redirects` を揃える。
- **lefthook**（`tools/lefthook.md`）: pre-commit で shellcheck + shfmt を自動実行する構成がリポ既定。

## 参考

- [GNU Bash Manual](https://www.gnu.org/software/bash/manual/bash.html)
- [GNU Bash: Shell Parameter Expansion](https://www.gnu.org/software/bash/manual/html_node/Shell-Parameter-Expansion.html)
- [GNU Bash: Arrays](https://www.gnu.org/software/bash/manual/html_node/Arrays.html)
- [POSIX.1-2024 Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)
- [Wooledge BashFAQ/105 (`set -e` pitfalls)](https://mywiki.wooledge.org/BashFAQ/105)
- [Wooledge ProcessSubstitution](https://mywiki.wooledge.org/ProcessSubstitution)
- [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html)
- [ShellCheck wiki](https://www.shellcheck.net/wiki/)
