---
name: audit
description: knowledge ベース全体の健全性を検査し、リンク切れ・frontmatter 欠損・重複・孤立記事・stale 記事をレポートする。
---

# audit - knowledge の健全性監査

`knowledge/**/*.md` を走査し、次の問題を検出してレポートする。本スキルは**検出のみ**で修正は行わない（修正は `update` / `create` で個別に実施する）。

## 入力

- **フィルタ（任意）**: `--category <name>` または記事パスで監査範囲を限定できる
- **`--stale [days]`**: stale の閾値を上書き（デフォルト 90）
- 引数なしの場合は全記事を対象とする

## 検出項目

優先度順:

1. **Critical**
   - frontmatter 欠損（`reviewed` フィールドなし、または不正な日付形式）
   - INDEX.md への未登録記事
2. **Warning**
   - Stale 記事（`reviewed` が閾値より古い）
   - リンク切れ（404 や到達不能な外部リンク）
   - 重複候補（タイトルまたはファイル名が類似する記事ペア）
3. **Info**
   - 孤立記事（他記事から参照されていない。INDEX は除く）
   - 参考セクションなし

## 手順

### 1. 対象の収集

1. フィルタに従って `knowledge/**/*.md` を抽出
2. 各記事の frontmatter と本文を Read

### 2. 検査

各項目を並行して実施:

1. **frontmatter 検査**: `reviewed` の有無・形式（`YYYY-MM-DD`）
2. **INDEX 整合**: `knowledge/INDEX.md` を Read し、各記事が列挙されているか照合
3. **Stale 判定**: 今日との差分が閾値を超えているか
4. **リンク検査**: 本文中の HTTP/HTTPS URL を抽出し、HEAD リクエストで到達確認（並列化可）
5. **重複候補**: ファイル名・H1 タイトル・主題キーワードの類似度で重複候補を抽出
6. **孤立判定**: `knowledge/**/*.md` 全体を Grep し、他記事からの相互参照を確認

### 3. レポート生成

```text
audit 結果（対象: N 件）:

[Critical] frontmatter 欠損: 2 件
  - knowledge/tools/foo.md
  - knowledge/platforms/bar.md

[Critical] INDEX 未登録: 1 件
  - knowledge/languages/baz.md

[Warning] Stale (>90 日): 3 件
  - knowledge/tools/old-tool.md (reviewed: 2024-10-01)
  ...

[Warning] リンク切れ: N 件
  - knowledge/.../article.md:42 → https://example.com/dead

[Warning] 重複候補: N ペア
  - knowledge/tools/gh-cli.md ↔ knowledge/tools/github-cli.md (類似度: 0.82)

[Info] 孤立記事: N 件
  - knowledge/.../isolated.md
```

### 4. 推奨アクション提示

検出項目ごとに対応方法を案内:

- **frontmatter 欠損** → 該当記事を手動で修正、または `update <path>` で再検証
- **INDEX 未登録** → `pnpm run generate-index` を実行
- **Stale** → `update --stale <days>` で一括更新
- **リンク切れ** → 該当記事を `update <path>` で修正
- **重複候補** → 人手でレビューし、統合するか別記事として明確化
- **孤立記事** → 相互参照の追加を検討、または本当に必要かレビュー

### 5. 完了報告

```text
audit 完了:
  対象: N 件
  Critical: X 件
  Warning:  Y 件
  Info:     Z 件
  状態: <問題なし | 要対応>
```

## 責務の範囲

- 本スキルは**検出とレポートのみ**を行い、修正はしない
- 修正は `update` / `create` で個別に実施する
- CI で定期実行することも想定した副作用のない設計

## 注意事項

- 外部リンクの HEAD リクエストは秒間リクエスト数を抑制する（過剰なアクセスを避ける）
- リンク検査で一時的な 5xx が出た場合は 1 回だけリトライし、それでも失敗なら「要確認」として報告（誤検知を避ける）
- 重複候補の判定は保守的に（類似度 0.8 以上など、明らかなもののみ）
- .env や機密情報は読み取らない
