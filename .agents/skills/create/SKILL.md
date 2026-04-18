---
name: create
description: トピックを指定して、新規の knowledge 記事をリサーチ・執筆・登録する。カテゴリ判定から INDEX 反映まで自動で行う。
---

# create - knowledge 記事の新規作成

指定トピックについて、最新情報をリサーチして新規の記事を生成し、適切なカテゴリに配置して INDEX を更新する。

## 入力

- **トピック**: `claude-code`, `Docker Compose`, `Prisma migrate` のような主題
- **カテゴリヒント**（任意）: `--category <tools|standards|languages|platforms>` でカテゴリを明示指定
- 引数なしの場合は何の記事を作るか確認する

## 手順

### 1. 重複チェック

1. `knowledge/**/*.md` を `Glob` し、既存のファイル名とタイトルを走査
2. 入力トピックと類似する記事があれば:
   - 完全一致 → 記事が既に存在することを報告し、`update` の使用を案内して終了
   - 類似（同一テーマの別名など）→ ユーザーに以下を確認:
     - 既存記事を更新する（`update` に委譲）
     - 新規として別ファイルで作成する（理由が必要）
     - 中止する

### 2. カテゴリ判定

`--category` 未指定の場合、トピック性質から判定:

| カテゴリ | 対象 |
|---|---|
| `tools/` | CLI ツール、開発者ツール、AI エージェント等の使い方・設定 |
| `standards/` | 規約・プラクティス・設計方針 |
| `languages/` | プログラミング言語固有の知識 |
| `platforms/` | クラウド / プラットフォーム / サービス |

どれにも当てはまらない場合はユーザーに確認する。

### 3. ファイル名決定

- `kebab-case.md`（例: `github-actions.md`, `anthropic-api.md`）
- 製品名はそのまま（`claude-code.md`）
- 略称より正式名を優先（`ghcli` より `gh-cli.md`）

配置先パス: `knowledge/<category>/<filename>.md`

### 4. リサーチ

- 公式ドキュメント、ソースリポジトリ、リリースノート、Web 検索を用いて主題を調査
- 検証すべき事実（バージョン・URL・API 署名・コマンドフラグ等）を収集
- 情報源は本文または末尾の「参考」セクションで明示できるよう控える
- 不確実な情報は記事に含めない

### 5. 執筆

記事の骨格（`knowledge/standards/markdown-style.md` 準拠）:

```markdown
---
reviewed: YYYY-MM-DD
---

# タイトル

1-2 段落の概要（何で、いつ使うか）。

## 主要セクション

- 実務で参照される情報を優先
- 網羅性より鮮度と正確さ

## 参考

- <公式ドキュメント URL>
```

- `reviewed` は今日の日付（作成日＝最終検証日）
- 記事本文は既存記事のスタイル・粒度に揃える
- 実例は最小限の動作するスニペット
- 推測や未検証の情報は書かない

### 6. 検証

1. `pnpm run generate-index` で INDEX.md を再生成
2. `pnpm run test` でテスト通過を確認
3. `markdownlint-cli2 --fix` で書式を整える

### 7. 完了報告

```text
create 完了:
  記事:    knowledge/<category>/<filename>.md
  カテゴリ: <category>
  reviewed: YYYY-MM-DD
  INDEX:   更新済み
```

## 責務の範囲

- 本スキルは**新規記事の作成のみ**を扱う
- 既存記事の再検証・最新化は `update` スキル
- 記事群の健全性検査は `audit` スキル
- 対象トピックの記事が既に存在する場合は `update` へ誘導する

## 注意事項

- 作業ツリーが clean であること
- 1 記事 = 1 PR を原則とする（他の変更と混ぜない）
- リサーチで確信が持てない事実は記述しない
- .env や機密情報を記述しない
