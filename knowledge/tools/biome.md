---
reviewed: 2026-05-04
tags: [lint, format, javascript, typescript, json, rust, fast]
---

# Biome

Rust で書かれた高速な JavaScript / TypeScript / JSON / CSS / GraphQL のフォーマッタ + リンタ。ESLint + Prettier を単一ツールで置き換えることを目標とする。

公式: [biomejs.dev](https://biomejs.dev/)

## インストール

```bash
# プロジェクトローカル（推奨）
pnpm add -D -E @biomejs/biome

# グローバル or バージョン管理
mise use biome@2

# Homebrew
brew install biome
```

`-E`（exact version）を付けるのが公式推奨。マイナー更新でルールが変わることがあるため。

## 基本コマンド

| コマンド | 用途 |
|---|---|
| `biome check` | lint + format チェック（デフォルト、読み取り専用） |
| `biome check --write` | 自動修正を書き込む |
| `biome check --write --unsafe` | 破壊的変更を含む修正 |
| `biome format` | フォーマットのみ |
| `biome lint` | lint のみ |
| `biome ci` | CI 専用（失敗で非 0 終了） |
| `biome migrate eslint` | ESLint 設定を Biome に変換 |
| `biome migrate prettier` | Prettier 設定を Biome に変換 |

## 設定ファイル `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.14/schema.json",
  "files": {
    "includes": ["src/**", "tests/**", "*.json", "!**/node_modules", "!**/dist"],
    "ignoreUnknown": true
  },
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error"
      }
    }
  },
  "json": {
    "parser": {
      "allowComments": true,
      "allowTrailingCommas": true
    }
  }
}
```

### 主要フィールド

| セクション | 説明 |
|---|---|
| `files.includes` | 対象パターン（glob）。`!` で除外 |
| `files.ignoreUnknown` | 未知の拡張子を無視 |
| `formatter` | 全言語共通のフォーマット設定 |
| `javascript` / `typescript` / `json` / `css` | 言語別の上書き |
| `linter.rules` | ルール有効化。`recommended: true` で推奨セット適用 |
| `assist.actions.source.organizeImports` | import 整列（v2 で `organizeImports` から `assist` 配下に移動。`biome migrate` で自動変換可） |

### ルールの severity

```json
{ "noConsole": "error" | "warn" | "info" | "off" }
```

`recommended` のルールはすべて `error`。個別に弱める場合はキーで上書き。

### 個別ファイル / ブロックの抑止

```ts
// biome-ignore lint/suspicious/noExplicitAny: legacy API
function foo(x: any) {}

// biome-ignore-all lint/style/useConst: this file intentionally uses let
```

## フォーマッタの特徴

- Prettier 風だが高速（Rust、並列処理）
- `lineWidth` デフォルト 80 → 本リポジトリは 100
- JSX / TSX 対応
- `quoteStyle`: `"single"` / `"double"`
- `trailingCommas`: `"all"` / `"es5"` / `"none"`
- `semicolons`: `"always"` / `"asNeeded"`

## lint ルール体系

大分類:

| 分類 | 内容 |
|---|---|
| `correctness` | バグの可能性（未使用変数、構文の誤用） |
| `suspicious` | 怪しいが必ずしも間違いではない |
| `style` | コーディングスタイル |
| `complexity` | 複雑度（不要な async、重複条件等） |
| `performance` | パフォーマンス（無駄な allocation 等） |
| `security` | セキュリティ（dangerouslySetInnerHTML 等） |
| `a11y` | アクセシビリティ（JSX 向け） |
| `nursery` | 実験的ルール（安定前） |

## VS Code 連携

[Biome 拡張](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) をインストール + `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

## lefthook / pre-commit 連携

```yaml
pre-commit:
  commands:
    biome:
      glob: "**/*.{ts,tsx,js,jsx,json,jsonc}"
      run: biome check --write {staged_files}
      stage_fixed: true
```

`stage_fixed: true` で自動修正後のファイルを再ステージ。

## CI での使い方

```yaml
- run: pnpm biome ci
```

`biome ci` は自動修正せず、違反があれば非 0 で失敗する。GitHub Actions の `reporter` フォーマット出力もサポート。

## ESLint / Prettier との比較

| 観点 | Biome | ESLint + Prettier |
|---|---|---|
| 速度 | 〜10x 高速（Rust） | 普通 |
| 設定 | 単一ファイル | 2 ツール分 |
| プラグイン | なし（内蔵ルールのみ） | 豊富 |
| TypeScript | ネイティブ | `@typescript-eslint` 必要 |
| JSX | 対応 | 対応 |
| マイグレーション | `biome migrate` で自動変換 | — |

**Biome の弱点**: ESLint のサードパーティプラグインが使えない（例: `eslint-plugin-react-hooks`、`eslint-plugin-import` の細かい規則）。相当ルールが Biome 内蔵で揃っているか確認必須。

## トラブルシュート

### `biome check` が何も出ない

`files.includes` のパターンにマッチしていない可能性。`biome check --diagnostic-level=info src/` のようにパス明示で確認。

### 既存コードのフォーマット差分が巨大

初回適用時は別ブランチで一括実行 → `docs: apply biome format` 等の単独コミットにする。`.git-blame-ignore-revs` に commit hash を書いて `git blame` から除外。

### Prettier との併用は避ける

矛盾する整形ルールがあり、保存時の往復が発生する。`biome migrate prettier` で移行しきる。
