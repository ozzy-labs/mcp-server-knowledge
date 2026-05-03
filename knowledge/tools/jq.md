---
reviewed: 2026-05-04
tags: [data-cli, json, fast]
---

# jq

JSON を処理するコマンドラインフィルタ。`grep` / `sed` / `awk` の JSON 版。API 応答の整形、設定ファイルの抽出、CI スクリプトでの値取り出しに必須。C 製の単一バイナリ。

公式: [jqlang.org](https://jqlang.org/) / [manual](https://jqlang.org/manual/)

最新版は **1.8.1**（2025-07-01）。1.8.0（2025-06-01）でメジャー更新があり、`trim/0` などの新関数・複数のセキュリティ修正・一部 breaking change（`indices/1` / `index/1` / `rindex/1` が code point ベースに変更など）が入った。

## インストール

```bash
# Homebrew
brew install jq

# apt
sudo apt install jq

# mise
mise use aqua:jqlang/jq@latest

# Windows
winget install jqlang.jq
```

## 基本的な使い方

```bash
# 整形（pretty print）
echo '{"a":1,"b":2}' | jq
# → {
#     "a": 1,
#     "b": 2
#   }

# 単一フィールド抽出
echo '{"name":"alice","age":30}' | jq '.name'
# → "alice"

# 文字列として抽出（クオートなし）
echo '{"name":"alice"}' | jq -r '.name'
# → alice
```

## フィルタ構文の基礎

| フィルタ | 意味 |
|---|---|
| `.` | 入力全体 |
| `.foo` | フィールド `foo` |
| `.foo.bar` | ネスト |
| `.[0]` | 配列の 0 番目 |
| `.[0:3]` | スライス |
| `.[]` | 配列を展開（各要素にパイプ） |
| `.foo // "default"` | 値が null なら代替 |
| `.foo?` | エラーを null に（optional access） |
| `length` | 長さ |
| `keys` / `values` | オブジェクトのキー/値 |
| `map(f)` | 配列の各要素に `f` を適用 |
| `select(cond)` | 条件で絞り込み |
| `sort` / `sort_by(.x)` | ソート |
| `group_by(.x)` | グルーピング |
| `unique` / `unique_by(.x)` | 重複除去 |
| `min` / `max` / `min_by(.x)` | 最小・最大 |
| `add` | 配列の要素を結合（数値なら合計、文字列なら連結） |

## 典型的なパイプライン

```bash
# 配列から name だけ抽出
echo '[{"name":"a"},{"name":"b"}]' | jq -r '.[].name'

# 同上（map 版）
echo '[{"name":"a"},{"name":"b"}]' | jq -r 'map(.name) | .[]'

# オブジェクトを再構築
echo '{"a":1,"b":2,"c":3}' | jq '{x: .a, y: .b}'

# 条件で絞り込み
echo '[{"n":1},{"n":5},{"n":3}]' | jq '.[] | select(.n > 2)'

# 集計
echo '[{"type":"a","v":10},{"type":"b","v":20},{"type":"a","v":30}]' \
  | jq 'group_by(.type) | map({type: .[0].type, sum: map(.v) | add})'
```

## よく使う例

### gh CLI との組み合わせ

```bash
# オープン PR のタイトル一覧
gh pr list --json number,title --jq '.[] | "\(.number) \(.title)"'

# レビュー未完了 PR の数
gh pr list --json reviewDecision \
  | jq '[.[] | select(.reviewDecision != "APPROVED")] | length'

# 指定ラベル付き Issue を CSV で
gh issue list --label bug --json number,title \
  | jq -r '.[] | [.number, .title] | @csv'
```

### package.json から依存一覧

```bash
jq -r '.dependencies | keys[]' package.json
```

### 環境変数置換 + ファイル更新

```bash
jq '.version = "1.2.3"' package.json > tmp.json && mv tmp.json package.json
```

### 配列の結合とフラット化

```bash
echo '[[1,2],[3,4]]' | jq 'add'                  # → [1,2,3,4]
echo '[1,[2,[3]]]' | jq '[.. | numbers]'          # → [1,2,3]
```

## 文字列操作

```bash
echo '"hello"' | jq 'length'             # → 5
echo '"hello"' | jq 'ascii_upcase'       # → "HELLO"
echo '"a,b,c"' | jq 'split(",")'         # → ["a","b","c"]
echo '["a","b"]' | jq 'join("-")'        # → "a-b"
echo '"  x  "' | jq 'trim'                            # → "x"（jq 1.8+）
echo '"  x  "' | jq 'ltrimstr(" ") | rtrimstr(" ")'   # 旧来の書き方
```

## フォーマット変換

```bash
# CSV 出力
echo '[{"a":1,"b":2},{"a":3,"b":4}]' | jq -r '.[] | [.a, .b] | @csv'

# TSV
echo '[{"a":1,"b":2}]' | jq -r '.[] | [.a, .b] | @tsv'

# raw文字列（クオート除去、エスケープ解除）
echo '"hello\nworld"' | jq -r '.'

# URL encode
echo '"hello world"' | jq -r '@uri'

# base64
echo '"hello"' | jq -r '@base64'
```

## エラー処理

```bash
# キーが存在しないとエラー: jq '.missing'
# → null が返る（`-e` 付きなら非 0 終了）

# optional
echo '{}' | jq '.foo?'                   # → null
echo '{}' | jq 'try .foo catch "err"'    # → null (存在するので try 成功)

# -e（exit code）
jq -e '.success' response.json >/dev/null || exit 1
```

## 変数とバインディング

```bash
# 外部変数
echo '{"a":1}' | jq --arg name "alice" '. + {name: $name}'
echo '{"a":1}' | jq --argjson n 42 '.a = $n'

# 内部バインディング
echo '[1,2,3]' | jq '. as $arr | $arr | length'
```

## 条件分岐

```bash
echo '5' | jq 'if . > 3 then "big" else "small" end'

# パターン的
echo '{"t":"a","v":1}' | jq '
  if .t == "a" then .v * 2
  elif .t == "b" then .v + 10
  else .v
  end
'
```

## 関数定義

```bash
# 単発
echo '5' | jq 'def double: . * 2; double'

# ファイル読み込み
jq -f script.jq data.json
```

## Claude Code / MCP との関連

- Claude Code の **statusline script** 例で jq を使って `.model.display_name` / `.context_window.used_percentage` を抽出（`ai/agents/claude-code.md` 参照）
- `gh <cmd> --json ...` の結果処理で頻出
- MCP サーバーのデバッグで `npx @modelcontextprotocol/inspector` の出力整形にも

## トラブルシュート

### `-r` を忘れてクオート付きで出た

```bash
# 付け忘れ
echo '{"x":"hello"}' | jq '.x'     # → "hello"
# raw
echo '{"x":"hello"}' | jq -r '.x'  # → hello
```

シェル変数に取り込む場合は `-r` 必須。

### ネストの Null で落ちる

```bash
# .a.b.c のどこかが null だと Cannot index null with ...
# → `?` を付ける
jq '.a?.b?.c?'
# または // で fallback
jq '(.a.b.c) // "default"'
```

### 大量データで遅い

jq 1.7 / 1.8 でパフォーマンス改善あり（`bsearch/1`、`unique/0`、文字列繰り返しなど）。`--stream` モードで逐次処理も可能（巨大 JSON 向け）:

```bash
jq --stream 'select(.[0][0] == "users") | .[1]' huge.json
```

### Windows で動作が違う

シングルクオートがコマンドプロンプトで解釈されない。PowerShell か WSL を使う、または `-f script.jq` でファイル化。

## 他ツールとの比較

| 観点 | jq | yq (mikefarah) | gron |
|---|---|---|---|
| 対象 | JSON | YAML/JSON/XML | JSON → grep 可能な形式 |
| 言語 | C | Go | Go |
| 速度 | 速い | 速い | 速い |
| 学習コスト | 中 | jq 互換 | 低 |
| ファイル更新 | コピー経由 | `-i` で in-place | — |

YAML を扱うなら `yq`（`mikefarah/yq` が主流、jq 互換構文）。grep 連携が欲しいときは gron（JSON をドット記法で列挙）。
