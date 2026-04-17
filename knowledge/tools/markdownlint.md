---
reviewed: 2026-04-18
---

# markdownlint

Markdown の構文・スタイルを検証する Linter。`markdownlint-cli2` が現行推奨 CLI。ルール体系は [CommonMark](https://commonmark.org/) + GitHub Flavored Markdown 準拠。

公式: [github.com/DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint) / [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2)

## インストール

```bash
# mise + npm
mise use npm:markdownlint-cli2@0.21

# npm（プロジェクトローカル）
pnpm add -D markdownlint-cli2

# Homebrew
brew install markdownlint-cli2
```

**`markdownlint-cli`（無印）と `markdownlint-cli2` は別物**。後者が公式推奨で機能が豊富。本記事は cli2 を対象。

## 基本的な使い方

```bash
# 単一ファイル
markdownlint-cli2 README.md

# 再帰 + glob
markdownlint-cli2 "**/*.md"

# 自動修正
markdownlint-cli2 --fix "**/*.md"

# 設定指定
markdownlint-cli2 --config .markdownlint.jsonc "**/*.md"
```

## 設定 `.markdownlint.jsonc` / `.markdownlint-cli2.jsonc`

```jsonc
{
  // 継承プリセット
  "default": true,

  // 個別ルール
  "MD013": false,            // line-length（日本語では制限しにくい）
  "MD033": false,            // inline HTML 許容
  "MD041": true,             // ファイル先頭は H1
  "MD024": {
    "siblings_only": true    // 同階層での重複のみ禁止
  },

  "MD026": { "punctuation": ".,;:!" }, // 見出しの末尾記号
  "MD007": { "indent": 2 }             // 順序なしリストのインデント
}
```

- `default: true` で全ルール有効化 → 個別に無効化する運用が一般的
- 設定ファイルは `.markdownlint.json`, `.markdownlint.jsonc`, `.markdownlint.yaml`, `.markdownlint.cjs` 等を自動検出

### cli2 固有設定 `.markdownlint-cli2.jsonc`

```jsonc
{
  "config": { "default": true, "MD013": false },
  "globs": ["**/*.md", "!node_modules/**", "!dist/**"],
  "ignores": ["CHANGELOG.md"],
  "fix": true
}
```

cli2 は glob / ignore / fix 等をファイルに書けるので CLI 引数を単純化できる。

## 主要ルール

| ID | 意味 |
|---|---|
| MD001 | 見出しレベルの飛び越し禁止（H2 の次に H4 はダメ） |
| MD003 | 見出しスタイル統一（`#` 形式 / underline 形式） |
| MD004 | 順序なしリストのマーカー統一（`-` / `*` / `+`） |
| MD007 | 順序なしリストのインデント |
| MD009 | 行末スペース |
| MD010 | タブ使用 |
| MD011 | URL の括弧逆転 `(text)[url]` |
| MD013 | 行長 |
| MD018-MD023 | 見出し前後のスペース |
| MD024 | 重複見出し |
| MD025 | H1 の重複（1 つのみ） |
| MD029 | 順序リストの番号付け |
| MD031 | コードブロック前後の空行 |
| MD033 | インライン HTML |
| MD034 | 裸 URL（`<https://...>` にする） |
| MD040 | コードブロックに言語タグ必須 |
| MD041 | ファイル先頭は H1 |
| MD047 | ファイル末尾改行 |

全ルール: [公式ルール一覧](https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md)

## 個別抑制

### 行単位

```markdown
<!-- markdownlint-disable-next-line MD033 -->
<details>

<!-- markdownlint-disable MD033 MD041 -->
<div>complicated HTML</div>
<!-- markdownlint-enable MD033 MD041 -->
```

### ファイル単位

```markdown
<!-- markdownlint-disable MD013 -->
```

## 自動修正の範囲

`--fix` で多くは自動修正される:

- 行末スペース削除
- ファイル末尾改行
- 見出し前後の空行
- リストマーカー統一
- コードブロック周辺の空行

自動修正されないもの: 見出しレベルの飛び越し（MD001）、重複見出し（MD024）等、意味判断が必要なもの。

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    markdownlint:
      glob: "**/*.md"
      run: markdownlint-cli2 --fix {staged_files}
      stage_fixed: true
```

本リポジトリの `lefthook-base.yaml` と同じ構成。

## CI での使い方

```yaml
- run: pnpm dlx markdownlint-cli2 "**/*.md"
```

SARIF 出力は未対応なので、失敗時のログを Pull Request 注釈に流すツールと組み合わせる:

```yaml
- uses: DavidAnson/markdownlint-cli2-action@v16
  with:
    config: ".markdownlint.jsonc"
    globs: "**/*.md"
```

## 日本語固有の注意

- **MD013（行長）**: 日本語は単語境界がないため、行長制限は実用的でない。**無効化推奨**
- **MD026（末尾記号）**: 「。」「、」は `punctuation` オプションのデフォルトに含まれないため、日本語見出しの句読点は許容される
- **全角半角スペース**: markdownlint は検出しない。目視 or 別ツール（textlint）で対応

## MD013（行長）の折衷案

完全無効化ではなく、英語メインのドキュメントでは緩める形:

```jsonc
{
  "MD013": {
    "line_length": 120,
    "tables": false,      // 表は制限なし
    "code_blocks": false  // コードブロックは制限なし
  }
}
```

## エディタ統合

- **VS Code**: [markdownlint 拡張](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint)。保存時自動修正が効く
- **Neovim**: null-ls / conform.nvim 経由

## textlint / Vale との使い分け

| 観点 | markdownlint | textlint | Vale |
|---|---|---|---|
| 言語 | Node.js | Node.js | Go |
| 主眼 | 構文・フォーマット | 文章（日本語・英語） | 文章（英語中心） |
| プラグイン | ルールは内蔵 | 豊富（技術文書向け） | Google / Microsoft スタイル等 |
| 速度 | 速い | 中 | 速い |
| 適用場面 | markdown の構文担保 | 日本語の誤用検出 | 英語のスタイル統一 |

**組み合わせ例**: markdownlint（構文）+ textlint（日本語文章ルール）+ prh（表記ゆれ辞書）。markdownlint を最前線、textlint は任意運用。

## トラブルシュート

### `MD013` で日本語が毎行エラー

無効化するか `line_length` を 300 等に引き上げる。

### 自動修正されない

`markdownlint-cli` 旧版を使っている可能性。`markdownlint-cli2 --fix` に切り替え。

### 同じ見出しが複数あってエラー

`MD024` の `siblings_only: true` で同階層のみチェックに。異なる節の「トラブルシュート」サブ見出しは許容したいケースに有効。

### コードブロックの言語タグ警告（MD040）

```` ``` ```` だけで言語を指定していない。`bash` / `ts` / `text` 等を必ず付ける。本 KB の執筆規約でも必須（`standards/markdown-style.md` 参照）。
