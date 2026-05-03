# knowledge-staleness-monthly

Routines Web UI の prompt フィールドに **本ファイルの「Prompt」セクションのみ** を貼り付けて使用する。

- **Schedule**: Monthly on the 1st at 04:00 JST
- **Model**: Claude Opus 4.7
- **Environment**: `knowledge-staleness`
- **対象**: `scripts/staleness/sources.yaml` の `group: monthly` 該当 31 記事 + `/audit` 併設
- **想定実行時間**: 約 60 分

## Prompt

あなたは knowledge-mcp-server リポジトリで動作する Claude Code agent です。
本セッションは Claude Code Routines によって毎月 1 日 04:00 JST に自動起動されました。
ユーザーへの確認 (`AskUserQuestion`) は一切利用できません。すべての判断を自身で行ってください。

## 実行内容

以下を順番に実行してください。

### Step 1: monthly group の update

`/update --non-interactive --auto-ship --staleness-group monthly` を実行してください。

`update` skill (`.agents/skills/update/SKILL.md` および `.claude/skills/update/SKILL.md`) のワークフローに完全に従い、以下を行います:

1. `scripts/staleness/sources.yaml` を `yq -o json` で読み込み、`group == "monthly"` かつ `skip != true` のエントリ 31 件を抽出
2. 4 並列ウェーブで各 `knowledge/<path>.md` を処理。各 sub-agent には sources.yaml の該当エントリと記事パスを渡し、confidence 判定と差分要約を返させる
3. 各 source method (`docs` / `github_releases` / `rss` / `raw_files` / `npm` / `pypi` / `eol` / `web_search` / `related_internal`) で並列フェッチ
4. 既存記事との差分を取得し、4 段階 confidence (`high` / `medium` / `low` / `fail`) で判定
5. confidence 別に PR / バッチ PR / issue を起票:
   - **high**: 個別 PR、ブランチ `claude/staleness/<path>/<YYYYMMDD>`、タイトル `docs(knowledge): refresh <path> (<YYYY-MM-DD>)`
   - **medium**: 個別 PR + `staleness:needs-review` ラベル
   - **low**: バッチ PR、ブランチ `claude/staleness/batch/monthly/<YYYYMMDD>`、タイトル `chore(knowledge): verified N monthly articles (<YYYY-MM-DD>)`
   - **fail**: 記事は変更せず、`staleness:fetch-failed` ラベル付き issue を起票
6. 既に open PR が `claude/staleness/<path>/*` ブランチに存在する記事は衝突回避のためスキップ

### Step 2: ベース全体の audit

monthly update が完了した後、`/audit --non-interactive` を実行してください。

`audit` skill (`.agents/skills/audit/SKILL.md`) のワークフローに完全に従い、以下を点検します:

- frontmatter の欠損 / 必須フィールド不足
- INDEX.md と実ファイルの整合性
- リンク切れ（記事内および knowledge/ 全体）
- 重複記事 / 孤立記事
- stale 記事（`reviewed` から閾値超過）

audit の指摘事項は以下のいずれかでエスカレーションする:

- **構造的問題（リンク切れ / frontmatter 不正 / 重複）**: 個別 issue を起票、ラベル `staleness:audit`（必要に応じて事前作成）
- **stale 警告**: 既存の routine スケジュールでカバーされる範囲なら issue 不要。範囲外（カテゴリ未登録など）は issue 起票
- **自動修正可能（リンク先 URL 末尾の slash 整合等）**: ブランチ `claude/staleness/audit/<YYYYMMDD>` で個別 PR

## 完了報告

最後に必ず以下のサマリーを `console.log` 相当で出力してください（routine ログに残ります）:

```text
[knowledge-staleness-monthly] complete:
  Step 1 (update):
    対象記事:    N 件
    内訳:        high X / medium Y / low Z / fail W
    個別 PR:     X+Y 件
    バッチ PR:   1 件 (low Z 件) または 0 件
    fail issue:  W 件
  Step 2 (audit):
    指摘:        Critical A / Warning B / Info C
    起票 issue:  D 件
    起票 PR:     E 件
```

## 制約

- 本セッションは非対話。`AskUserQuestion` を呼ばないこと
- 機密情報（`.env` 等）は読み取らない / commit しない
- ブランチ命名規則を逸脱した push は許可されていない
- `main` への直接 push は禁止
- 各 PR は 1 記事 1 commit。バッチ PR のみ複数記事を 1 commit にまとめる
- 既知の 404 / 403 / network error は warning 扱いとし、対応する `staleness:fetch-failed` issue を起票して続行
- 31 件 + audit の処理で実行時間が想定の 2 倍 (120 分) を超えそうな場合、未処理記事の数だけ `staleness:fetch-failed` 相当の issue を起票してから終了し、翌月の routine に委ねる
- audit Step 2 が Step 1 のエラーで実行できない場合は、`staleness:audit-skipped` 相当の issue を起票し、翌週の weekly routine に audit の手動実行を促すコメントを残す
