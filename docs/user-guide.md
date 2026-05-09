# User Guide

このサーバーの価値は、収録されているナレッジの質と最新性に依存します。本ガイドでは、ナレッジ記事の作成・管理ルールと、トラブルシューティングについて説明します。

## 記事の基本構造

すべての記事は `knowledge/` ディレクトリ配下に `.md` ファイルとして作成します。ファイルは必ず以下の Frontmatter (YAML) で開始する必要があります。

```markdown
---
reviewed: 2026-05-10
tags: [typescript, testing]
aliases: [vitest, unit-test]
stability: ga
---

# 記事タイトル

本文は Markdown 形式で記述します...
```

### Frontmatter フィールド

| フィールド | 必須 | 型 | 説明 |
| :--- | :---: | :--- | :--- |
| `reviewed` | ○ | `YYYY-MM-DD` | 最後に内容を検証した日付。 |
| `tags` | | `string[]` | 記事の分類タグ。`src/schema.ts` で定義されている必要があります。 |
| `aliases` | | `string[]` | 検索や推薦で有効な別名。 |
| `stability` | | `enum` | `ga`, `beta`, `research-preview`, `deprecated` のいずれか。 |

## ディレクトリ構成ルール

記事のカテゴリに応じて、適切なディレクトリに配置してください。

- `ai/`: AI エージェント、プラットフォーム、方法論。
- `languages/`: 言語本体とそのエコシステム。
- `platforms/`: 特定のプラットフォーム（GitHub, AWS 等）に特化した知識。
- `standards/`: 業界標準、一般的な規約。
- `tools/`: 特定の言語やプラットフォームに依存しない汎用ツール。

## 執筆ガイドライン

1. **AI 向けに最適化**: 人間だけでなく、AI エージェントが読み取って即座にアクションに繋げられるよう、明確な手順や設定例を含めてください。
2. **陳腐化を防ぐ**: 特定のバージョンに依存しすぎる記述は避け、必要であればバージョン番号を明記してください。
3. **リンクの活用**: 外部の公式ドキュメントへのリンクを積極的に含め、情報のソースを明らかにしてください。
4. **汎用的な表現**: 特定の個人名やプライベートなプロジェクト名を含めないでください。例示が必要な場合は `your-org` や `my-app` といった汎用的な名前を使用してください。

## バリデーション

記事を作成・変更した後は、以下のコマンドで整合性を確認してください。

```bash
# 全記事の Frontmatter バリデーションを含むテストの実行
pnpm run test
```

## トラブルシューティング

### サーバーが起動しない (Validation Error)

起動時に以下のようなメッセージが表示される場合、ナレッジ記事の Frontmatter がスキーマに適合していません。

```text
[knowledge] 8 article(s) failed frontmatter validation; aborting startup
[knowledge] frontmatter error: path/to/article — tags.0: Invalid option...
```

**対処法:**

1. エラーメッセージに表示されたパスの記事を確認します。
2. 日付形式 (`YYYY-MM-DD`) や、使用しているタグが正しいか確認します。
3. 独自のタグを新規に追加したい場合は、[新しいタグの追加](#新しいタグの追加) を参照してください。

### 新しいタグの追加

ナレッジの分類に新しいタグが必要な場合は、以下のファイルを編集して `TagSchema` に値を追加してください。

- **ファイル:** `src/schema.ts`

```typescript
export const TagSchema = z.enum([
  "existing-tag",
  "new-tag", // ここに追加
  // ...
]);
```

追加後、`pnpm run build` を実行して反映させてください。
