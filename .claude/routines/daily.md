# knowledge-staleness-daily

Routines Web UI の prompt フィールドに **本ファイルの「Prompt」セクションのみ** を貼り付けて使用する。

- **Schedule**: Daily at 02:00 JST
- **Model**: Claude Opus 4.7
- **Environment**: `knowledge-staleness`
- **対象**: `scripts/staleness/sources.yaml` の `group: daily` 該当 8 記事
- **想定実行時間**: 約 10 分

## Prompt

あなたは knowledge-mcp-server リポジトリで動作する Claude Code agent です。
本セッションは Claude Code Routines によって毎日 02:00 JST に自動起動されました。
ユーザーへの確認 (`AskUserQuestion`) は一切利用できません。すべての判断を自身で行ってください。

## 実行内容

`/update --non-interactive --auto-ship --staleness-group daily` を実行してください。

`update` skill (`.agents/skills/update/SKILL.md` および `.claude/skills/update/SKILL.md`) のワークフローに完全に従い、以下を行います:

1. `scripts/staleness/sources.yaml` を `yq -o json` で読み込み、`group == "daily"` かつ `skip != true` のエントリを抽出
2. 該当する `knowledge/<path>.md` を対象に、定義された各 source method (`docs` / `github_releases` / `rss` / `raw_files` / `npm` / `pypi` / `eol` / `web_search` / `related_internal`) で並列フェッチ
3. 既存記事との差分を取得し、4 段階 confidence (`high` / `medium` / `low` / `fail`) で判定
4. confidence 別に PR / バッチ PR / issue を起票:
   - **high**: 個別 PR、ブランチ `claude/staleness/<path>/<YYYYMMDD>`、タイトル `docs(knowledge): refresh <path> (<YYYY-MM-DD>)`
   - **medium**: 個別 PR + `staleness:needs-review` ラベル
   - **low**: バッチ PR、ブランチ `claude/staleness/batch/daily/<YYYYMMDD>`、タイトル `chore(knowledge): verified N daily articles (<YYYY-MM-DD>)`
   - **fail**: 記事は変更せず、`staleness:fetch-failed` ラベル付き issue を起票
5. 既に open PR が `claude/staleness/<path>/*` ブランチに存在する記事は衝突回避のためスキップ
6. lint / typecheck が失敗したら in-session で 1〜2 回まで自動修正を試行。それでも失敗する記事は fail 扱いにし、issue を起票して他記事の処理を続行

## 完了報告

最後に必ず以下のサマリーを `console.log` 相当で出力してください（routine ログに残ります）:

```text
[knowledge-staleness-daily] complete:
  対象記事:    N 件
  内訳:        high X / medium Y / low Z / fail W
  個別 PR:     X+Y 件
  バッチ PR:   1 件 (low Z 件) または 0 件
  fail issue:  W 件
```

## 制約

- 本セッションは非対話。`AskUserQuestion` を呼ばないこと
- 機密情報（`.env` 等）は読み取らない / commit しない
- ブランチ命名規則を逸脱した push は許可されていない
- `main` への直接 push は禁止
- 各 PR は 1 記事 1 commit。バッチ PR のみ複数記事を 1 commit にまとめる
- 既知の 404 / 403 / network error は warning 扱いとし、対応する `staleness:fetch-failed` issue を起票して続行
