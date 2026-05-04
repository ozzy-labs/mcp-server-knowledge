---
reviewed: 2026-05-04
tags: [go, lsp, ide]
---

# gopls

Go チームが開発・保守する **公式 Language Server**。LSP 互換のあらゆるエディタ（VS Code / Neovim / Helix / Zed / Emacs / Vim）に IDE 機能を提供する。GoLand は JetBrains 自社の Go プラグイン（独自実装）を使うため gopls は不要。

公式: [pkg.go.dev/golang.org/x/tools/gopls](https://pkg.go.dev/golang.org/x/tools/gopls) / [GitHub](https://github.com/golang/tools/tree/master/gopls)

## インストール

```bash
go install golang.org/x/tools/gopls@latest
```

VS Code Go 拡張は初回起動時にインストールを自動で促す。最新リリース系列は **v0.21.x**（pkg.go.dev で確認）。

### Go バージョン要件

- **build 要件**: gopls v0.17+ は Go 1.23 以降でビルドする必要あり
- **サポート要件**: gopls v0.18+ は **直近 2 メジャー Go バージョン**のみ公式サポート（古い Go でも動くが CI 対象外）

## 主要機能

### Passive（常時有効）

- **Hover**: シンボルの型 / 値 / 宣言抜粋 / doc コメント / 構造体サイズ・フィールドオフセット
- **Signature help**: 関数引数のシグネチャ・型・doc 表示
- **Document highlight**: カーソル位置のシンボル、`return` / `for` / `switch` の関連トークンを強調
- **Inlay hint**（experimental）: 構造体フィールド名、関数引数名、型引数の注釈
- **Semantic tokens**: 関数と型を区別するセマンティックハイライト
- **Document link**: doc コメント内 URL や `import` のリンク化（pkg.go.dev へ）

### Diagnostics

- コンパイルエラー（`go list` メタデータ + コンパイラフロントエンド相当）
- Go analysis framework（`go vet` 相当）
- **staticcheck 統合**（`ui.diagnostic.staticcheck: true` で有効化、experimental 扱い）

### Navigation

- Go-to-definition / type definition / find references / implementations
- Document symbol / workspace symbol
- Call hierarchy / type hierarchy

### Code transformation

- フォーマット（`gofmt` ベース、`gofumpt` 切替可能）
- **Rename**（シャドーイング・インターフェース整合性チェック付き、embedded field 対応）
- **Organize imports**: 未使用削除 + 不足追加 + ソート
- **Extract**: function / method / variable / constant / "extract to new file"
- **Inline**: inline call / inline variable
- **Refactor.rewrite**: 未使用パラメータ除去、引数 swap、文字列クォート変換、`if` 反転、行分割/結合、struct/switch fill
- **Modernize**: 新しい Go 構文・標準 API への自動アップグレード（例: `strings.Cut` への置き換え、`new(expr)` 構文）

### Codelens

- テスト実行
- `go generate`
- `regenerate cgo`
- `run_govulncheck`（v0.21+ でデフォルト追加）

## 主要設定（VS Code `"gopls": {}`）

| キー | 既定 | 用途 |
|---|---|---|
| `ui.semanticTokens` | `false` | Semantic tokens 有効化 |
| `ui.codelenses` | `{...}` | code lens の個別 ON/OFF |
| `ui.completion.usePlaceholders` | `false` | 関数引数・struct フィールドのプレースホルダ展開 |
| `ui.diagnostic.staticcheck` | `false` | staticcheck 統合 |
| `ui.diagnostic.analyses` | `{}` | 個別 analyzer の ON/OFF |
| `ui.inlayHint.hints` | `{}` | inlay hint の項目を選択 |
| `formatting.gofumpt` | `false` | gofumpt をフォーマッタとして使用 |
| `formatting.local` | `""` | goimports `-local` 相当の prefix |
| `build.directoryFilters` | `["-**/node_modules"]` | workspace 包含/除外（`-` 全除外、`+pkg` 個別包含） |
| `build.buildFlags` | `[]` | `go list` 等に渡すフラグ（`-tags` 等） |
| `build.env` | `{}` | 外部コマンド呼び出し時の env 追加 |
| `expandWorkspaceToModule` | `true` | workspace パッケージ判定 |

### VS Code 設定例

```jsonc
"gopls": {
  "ui.diagnostic.staticcheck": true,
  "ui.completion.usePlaceholders": true,
  "ui.codelenses": {
    "run_govulncheck": true,
    "test": true
  },
  "ui.inlayHint.hints": {
    "assignVariableTypes": true,
    "compositeLiteralFields": true,
    "constantValues": true,
    "functionTypeParameters": true,
    "parameterNames": true,
    "rangeVariableTypes": true
  },
  "formatting.gofumpt": true,
  "formatting.local": "github.com/your-org",
  "build.directoryFilters": ["-**/node_modules", "-**/vendor"]
}
```

## エディタ別の組み込み

| エディタ | 統合方法 |
|---|---|
| VS Code | Go 拡張（自動インストール） |
| Neovim | `nvim-lspconfig` の `gopls` プリセット |
| Vim | `vim-lsp` / `coc.nvim` |
| Helix | 標準対応（`languages.toml` 不要） |
| Zed | 標準対応 |
| Emacs | `lsp-mode` / `eglot` |
| Sublime Text | `LSP-gopls` パッケージ |

## ワークスペース

- **`go.mod` のあるモジュール内で動く前提**。GOPATH モードや裸ファイルは限定対応
- **`go.work` を認識**しマルチモジュール workspace で動作
- **vendored モジュール** はそのまま読み取れる
- v0.20+ で **persistent index** がデフォルト有効化され、大規模 workspace の起動・補完が改善

## トラブルシュート

### gopls が起動しない

`$GOPATH/bin` が PATH に通っているか、`go install golang.org/x/tools/gopls@latest` が成功しているかを確認。`go env GOPATH` で実パスを確認。

### 補完が遅い・メモリ消費が多い

- `build.directoryFilters` で `vendor` / 巨大生成コードを除外
- workspace の規模を縮小（`go.work` で必要モジュールのみ使う）
- メモリ消費が 1 GB を超えると gopls が自動でデバッグ情報を出力

### import が機械的に整理されない

- `formatting.gofumpt: true` で gofumpt のルールを適用
- `formatting.local` で自社 prefix を末尾グループにする

### LSP 通信のデバッグ

```bash
gopls -logfile=/tmp/gopls.log -rpc.trace serve
```

`-rpc.trace` で LSP メッセージを詳細出力。

## 直近の変更（v0.20-0.21）

- **v0.20**: 実験的な MCP（Model Context Protocol）サーバ組み込み、Split Package リファクタ、`unusedfunc` analyzer 拡張、embedded field rename、persistent index デフォルト有効化
- **v0.21**: Hover が選択範囲の部分式情報を報告、modernize analyzer に `strings.Cut`（1.25）/ `new(expr)`（1.26）/ 標準ライブラリ新イテレータ API 対応、デフォルト codelens に `run_govulncheck`、package rename サポート

## AI エージェントがよくやるミス

1. **古い Go で gopls を起動** — v0.18+ は最新 2 メジャーのみサポート。`go env GOVERSION` で確認し、必要なら toolchain を更新
2. **GoLand で gopls を入れようとする** — JetBrains は自社プラグインを使う。gopls は不要
3. **`formatting.local` を空のまま** — 標準ライブラリと自社モジュールが同じ import グループに入る。`github.com/your-org` を設定する
4. **staticcheck 統合を有効化せず golangci-lint と二重チェック** — gopls の `ui.diagnostic.staticcheck: true` で IDE 上で警告を出すと修正サイクルが速い
5. **`build.directoryFilters` を未設定で巨大 monorepo を開く** — メモリと CPU を浪費。最初に除外パターンを決める

## 参考

- [gopls README](https://github.com/golang/tools/blob/master/gopls/README.md)
- [Settings reference](https://github.com/golang/tools/blob/master/gopls/doc/settings.md)
- [Features overview](https://github.com/golang/tools/blob/master/gopls/doc/features/index.md)
- [Troubleshooting](https://github.com/golang/tools/blob/master/gopls/doc/troubleshooting.md)
- [Release notes](https://go.dev/gopls/release/)
