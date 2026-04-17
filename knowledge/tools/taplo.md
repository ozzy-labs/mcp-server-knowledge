# taplo

Rust 製の TOML フォーマッタ + バリデータ + 言語サーバー。`pyproject.toml` / `Cargo.toml` / `.mise.toml` など TOML 採用が広がるにつれて有用性が増した。

公式: [taplo.tamasfe.dev](https://taplo.tamasfe.dev/)

## インストール

```bash
# mise
mise use taplo@0.10

# Homebrew
brew install taplo

# Cargo
cargo install taplo-cli --locked

# npm（LSP 同梱）
pnpm add -D @taplo/cli
```

## 基本的な使い方

```bash
# フォーマット（書き戻し）
taplo format file.toml

# 短縮
taplo fmt file.toml

# チェックのみ（CI 用、書き戻さない）
taplo format --check file.toml

# 再帰
taplo format .

# 構文検証
taplo check file.toml

# JSON Schema に対する検証
taplo lint file.toml
```

## 設定 `taplo.toml` / `.taplo.toml`

```toml
include = ["**/*.toml"]
exclude = [
  "node_modules/**",
  ".git/**",
]

[formatting]
align_entries = false              # 整列しない（diff を小さく保つ）
align_comments = true
array_trailing_comma = true
array_auto_expand = true
array_auto_collapse = true
compact_arrays = true
compact_inline_tables = false
inline_table_expand = true
trailing_newline = true
allowed_blank_lines = 1
column_width = 100
indent_tables = false
indent_entries = false
reorder_keys = false               # 順序を変えない
reorder_arrays = false

[[rule]]
include = ["**/Cargo.toml"]
[rule.formatting]
reorder_keys = true                # Cargo.toml ではキー順正規化
```

## JSON Schema 検証

taplo は TOML ファイルを JSON Schema で検証できる。`@taplo/cli` の内蔵カタログに以下を含む:

- `Cargo.toml`
- `pyproject.toml`
- `.mise.toml` / `mise.toml`
- `rustfmt.toml`
- `cargo-release.toml`

カスタムスキーマは `taplo.toml` の `schema` フィールドで指定:

```toml
[[rule]]
include = ["myapp.toml"]
schema = { url = "https://example.com/schema.json" }
```

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    taplo:
      glob: "**/*.toml"
      run: taplo format {staged_files}
      stage_fixed: true
```

TOML ファイルが少ないプロジェクトでは大きな恩恵はないが、`.mise.toml` / `pyproject.toml` がある場合は常時整形が効く。

## CI での使い方

```yaml
- run: taplo format --check .
```

失敗時は差分がリポジトリ内にある。チェックのみなので書き戻さない。

## エディタ統合

### VS Code

[Even Better TOML](https://marketplace.visualstudio.com/items?itemName=tamasfe.even-better-toml) 拡張が taplo ベース。保存時フォーマット + JSON Schema 補完 + 検証が効く。

```json
{
  "[toml]": {
    "editor.defaultFormatter": "tamasfe.even-better-toml",
    "editor.formatOnSave": true
  }
}
```

### Neovim / Emacs

LSP クライアント（nvim-lspconfig / lsp-mode）で `taplo lsp stdio` を起動。

## ファイル固有の設定（`# taplo:` ディレクティブ）

```toml
# taplo: formatting.align_entries = true
[package]
name = "x"
version = "0.1.0"
description = "aligned"
```

ファイル先頭で `# taplo:` プレフィックス付きのコメントで局所ルール上書き。

## Cargo.toml 特有の注意

`reorder_keys = true` で Cargo のエコシステム慣習（`[package]` → `[dependencies]` → `[dev-dependencies]` 順、内部はアルファベット順）を自動適用できる。ただし**破壊的な整形**なので既存コードベースでは別 PR で一括適用 → `.git-blame-ignore-revs` 推奨。

## トラブルシュート

### `.mise.toml` で fail

mise は拡張文法（backend prefix `npm:` / `pipx:` 等）を使うため、taplo の JSON Schema 検証で警告が出ることがある。formatting は通るので `taplo format` のみ使い、`taplo lint` は除外するのが安全。

### 配列の改行が毎回変わる

`array_auto_expand` / `array_auto_collapse` が `column_width` を超えたときに働く。値を大きくする、または `array_auto_expand: false` で固定。

### 整列が気に入らない

`align_entries`, `align_comments` を `false` に。diff の読みやすさ優先なら整列しないのが実務的。

## 他ツールとの比較

| 観点 | taplo | dprint (toml plugin) | prettier-plugin-toml |
|---|---|---|---|
| 言語 | Rust | Rust | Node.js |
| 速度 | 速い | 速い | 中 |
| JSON Schema 検証 | あり | なし | なし |
| LSP | あり | なし | なし |
| エディタ拡張 | 公式 | 公式 | Prettier 経由 |

TOML 専用機能（LSP、JSON Schema）が必要なら taplo 一択。複数言語を dprint で統一したいなら dprint + toml plugin も選択肢。
