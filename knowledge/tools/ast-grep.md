---
reviewed: 2026-05-03
---

# ast-grep

AST ベースのコード検索・lint・書き換えを 20+ 言語横断で行う Rust 製 CLI。`grep` / `sed` がテキストで失敗する「**構造を保ったまま**の置換」を、tree-sitter ベースのパターンマッチで安全に実行する。`jscodeshift` のような codemod よりセットアップが軽い。バイナリ名は `ast-grep` と短縮 `sg`。Linux で `sg` は `setsid` 系のコマンドと衝突するため `ast-grep` を使う。

公式: [ast-grep.github.io](https://ast-grep.github.io/)

## インストール

```bash
brew install ast-grep
cargo install ast-grep --locked
npm install -g @ast-grep/cli
pip install ast-grep-cli
```

## 基本コマンド

```bash
ast-grep run -p '<pattern>' [-l <lang>] [path]    # 構造検索
ast-grep run -p '<pattern>' -r '<rewrite>' -U     # 一括書き換え（-U で apply）
ast-grep scan                                      # rule ファイルで lint
ast-grep test                                      # rule のテスト
ast-grep lsp                                       # エディタ統合用 LSP
```

`run` のサブコマンドは `ast-grep -p ...` でも省略可。`-U` を付けないと dry-run（差分プレビューのみ）。

## パターン構文

メタ変数 `$X` / `$$$ARGS` を使って AST ノードを捕捉する:

| 記法 | マッチ対象 |
|---|---|
| `$NAME` | 単一の AST ノード（uppercase 必須） |
| `$$$ARGS` | 0 個以上の連続ノード（可変長） |
| `$_` | 名前なしの単一ノード |
| `$$NAME` | named multi。直近隣接ノード列を捕捉（実験的） |

`$` でシェル展開を防ぐため、パターンは**シングルクォート必須**。

### 例: `console.log` 削除

```bash
# JS / TS の任意の console.log() を全部削除
ast-grep -p 'console.log($$$ARGS)' -r '' -l ts -U src/
```

### 例: optional chaining 化

```bash
ast-grep -p '$PROP && $PROP()' \
         -r '$PROP?.()' \
         -l ts -U .
```

`$PROP` がパターンと書き換えで同名なので、同一ノードの参照になる（capture group の再利用）。

### 例: 関数呼び出しの引数追加

```bash
ast-grep -p 'fetch($URL)' \
         -r 'fetch($URL, { credentials: "include" })' \
         -l ts -U src/
```

## サポート言語

C / C# / C++ / CSS / Dart / Elixir / Go / Haskell / HTML / Java / JavaScript / JSON / Kotlin / Lua / PHP / Python / Ruby / Rust / Scala / Solidity / Swift / Thrift / TypeScript / TSX / YAML 他。`sgconfig.yml` で**カスタム tree-sitter parser** も登録可能。

## プロジェクト設定 (`sgconfig.yml`)

```yaml
ruleDirs:
  - rules
testConfigs:
  - testDir: tests
utilDirs:
  - utils
customLanguages:
  vue:
    libraryPath: ./parsers/tree-sitter-vue.so
    extensions: [vue]
```

`ast-grep new` で雛形が生成される（`rules/` と `tests/` を含む）。

## ルールファイル（YAML）

```yaml
# rules/no-deprecated-fetch.yml
id: no-deprecated-fetch
language: TypeScript
severity: warning
message: legacy fetch wrapper is deprecated, use `httpx`
rule:
  pattern: legacyFetch($URL)
fix: httpx.get($URL)
```

| キー | 用途 |
|---|---|
| `id` | ルール識別子 |
| `language` | 対象言語 |
| `severity` | `error` / `warning` / `info` / `hint` |
| `message` | 違反時の表示 |
| `rule` | パターン定義 |
| `fix` | 自動修正のテンプレート |

### `rule` の主要オペレータ

| オペレータ | 意味 |
|---|---|
| `pattern` | パターンマッチ |
| `kind` | tree-sitter の node 種別（例: `function_declaration`） |
| `regex` | 正規表現 |
| `inside` / `has` / `precedes` / `follows` | 位置関係 |
| `all` / `any` / `not` / `matches` | 論理結合 |
| `where` | メタ変数の追加制約 |

### ネスト例

```yaml
rule:
  all:
    - pattern: $FN($$$ARGS)
    - inside:
        kind: try_statement
    - not:
        has:
          pattern: await $FN($$$ARGS)
```

「`try` 文の中で `await` が付いていない関数呼び出し」を検出する。

## テスト

```yaml
# tests/no-deprecated-fetch-test.yml
id: no-deprecated-fetch
valid:
  - "httpx.get(url)"
invalid:
  - "legacyFetch(url)"
```

```bash
ast-grep test    # valid に false-positive、invalid に true-positive を期待
```

## CI 連携

```yaml
- uses: actions/checkout@v6
- uses: ast-grep/setup-ast-grep@v1
- run: ast-grep scan
```

`exit code` が 0 でないとき CI を失敗させる。`--error` で `severity: error` のみで失敗にする。

## エディタ統合（LSP）

```bash
ast-grep lsp
```

VS Code 拡張 [ast-grep](https://marketplace.visualstudio.com/items?itemName=ast-grep.ast-grep-vscode) や Neovim の `nvim-lspconfig` 経由で接続。インラインで rule 違反と quick-fix が出る。

## `grep` / `sed` / `jscodeshift` との比較

| 観点 | ast-grep | grep / sed | jscodeshift |
|---|---|---|---|
| マッチ単位 | AST ノード | 行・文字列 | AST（recast） |
| 言語数 | 20+（tree-sitter） | 言語非依存 | JS / TS のみ |
| セットアップ | 不要（CLI 1 本） | 不要 | Node.js + transform 関数を書く |
| 書き換え | `-r` テンプレートで宣言的 | テキスト置換 | `j(file).find(...).replaceWith(...)` を JS で書く |
| 学習曲線 | パターン構文を覚える | 既知 | API ドキュメントが必須 |
| スコープ | 全プロジェクト規模も可 | 小規模 | プロジェクト全体 |

「**構造を保つ置換**」「**多言語横断**」が必要なら ast-grep。JS/TS 内で複雑な分岐ロジックを書きたい場合は jscodeshift の方が表現力がある。

## AI エージェントがよくやるミス

1. **シングルクォートを忘れる** — `$X` がシェルで展開されて空になる。`'pattern'` で囲む
2. **`-l` を省略してマッチしない** — 言語が自動判定できないファイル拡張子で頻発。明示が確実
3. **`-U` を忘れて apply されない** — dry-run と本番の切替を意識する
4. **`$X` と `$x` を区別しない** — メタ変数は **uppercase + 数字** が確実。lowercase は識別子として扱われることがある
5. **複数行パターンのインデント** — YAML rule 内で複数行コードを書くなら `|` で literal block にする。`>` で folded にすると改行が消える
6. **`fix` で複数候補を提供したい** — 単一フィールド `fix:` のみ。複数なら `transform` プラグインまたは別ルールで
7. **`scan` と `run` の役割を混同** — `run` は単発検索、`scan` は ruleDirs 全部を一括 lint。CI は `scan`
8. **`sg` が Linux で別コマンドに当たる** — `sg` は `setsid` 系と衝突。シェル alias でも書き換え不可。`ast-grep` を使う

## 関連

- [`languages/typescript-esm.md`](../languages/typescript-esm.md) — TS でよく使う対象
- [`tools/biome.md`](biome.md) — JS / TS の lint。テキストパターンで足りるなら biome を優先
- [`tools/shellcheck.md`](shellcheck.md) — Shell の AST 解析（ast-grep でも shell をサポート）

## 参考

- [ast-grep Documentation](https://ast-grep.github.io/)
- [ast-grep on GitHub](https://github.com/ast-grep/ast-grep)
- [ast-grep playground](https://ast-grep.github.io/playground.html)
