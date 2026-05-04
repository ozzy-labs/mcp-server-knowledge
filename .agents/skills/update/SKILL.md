---
name: update
description: knowledge ベース内の既存記事を最新情報で再検証・更新する。Routines (cron) からの自動実行を主用途とし、lint → commit → PR → auto-merge までを完全自動で行う。
---

# update - knowledge 記事の再検証・最新化

指定した記事（または古い記事すべて）について、外部情報源で現状を再確認し、ずれている箇所を書き換えて `reviewed` 日付を更新する。**Routines / cron 想定の非対話・完全自動実行**。完了時は自動で lint → commit → PR → auto-merge までを行う。

## 入力

```text
/update [target] [--parallel N] [--dry-run] [--force-research]
```

### target

- **単一記事**: `ai/agents/gemini-cli.md` のようなパス、または `ai/agents/gemini-cli` / `gemini-cli` の省略形
- **カテゴリ**: `tools`, `standards`, `languages`, `platforms`（配下の全記事）
- **`--stale [days]`**: `reviewed` が `days` 日以上前の記事すべて（デフォルト 90）
- **`--staleness-group <daily|weekly|monthly>`**: `scripts/staleness/sources.yaml` の `group: <name>` に該当する記事すべて（`skip: true` の記事は除外）
- **`--all`**: 全記事
- 引数省略時は `--stale 90` として扱う

### モディファイア

- **`--parallel <N>`**: sub-agent の並列度（デフォルト 4、上限 16）。GitHub API rate limit (5000/h authenticated) から逆算した安全値
- **`--dry-run`**: research のみ実行し、ファイル編集・commit・PR 起票は行わない。ワーキングツリーには変更を残さない
- **`--force-research`**: fast-path（後述）を無効化し、reviewed が新しい記事も常に sub-agent 研究を実行

## 手順

### 1. 対象記事の特定 + fast-path 振り分け

1. 引数を解析し、対象記事の配列を決定する
2. `--staleness-group <name>` の場合:
   - `scripts/staleness/sources.yaml` を `yq -o json` で JSON に変換し、`group == <name>` かつ `skip != true` のキーを抽出
   - 抽出キーに `.md` を付け `knowledge/` 配下にマッピング、ファイルが無ければエラー中断
3. 各記事の `reviewed` 日付を確認し、以下に振り分け:
   - **fast-path 対象**: `--force-research` 未指定かつ `today - reviewed < threshold/2` の記事
     - threshold: daily=1, weekly=7, monthly=30 日
     - sub-agent 起動を**省略**し、reviewed のみ today に bump、confidence は `low`
   - **通常 path**: それ以外（fast-path 不該当）
4. `--stale` の場合は通常 path のみ（閾値より古いもののみが対象）
5. 単一指定したパスが存在しない場合はエラー → `create` スキル案内
6. 既存 open PR が `chore/staleness-<routine>-*` または `docs/staleness-<article-slug>-*` で立っている記事は衝突回避でスキップ:

   ```bash
   gh pr list --state open --search "staleness in:head" --json headRefName
   ```

### 2. リサーチ（通常 path のみ）

`subagent_type: staleness-researcher` を `--parallel` 指定の並列度で起動する（定義は `.claude/agents/staleness-researcher.md`）。同 agent は `allowed-tools` で Edit / Write / curl が **物理的に禁止**されており、JSON 出力のみを返す。

各 sub-agent には以下を渡す:

- 記事ファイルの絶対パス
- sources.yaml の該当エントリ（JSON 化）
- 今日の日付（ISO 8601）

各 sub-agent は sources.yaml の各 method を以下の手段で並列フェッチする:

- `docs[]` / `rss[]` → `WebFetch`
- `github_releases[]` → `gh release list -R <owner/repo> --limit 5` + 必要なら `gh release view`
- `raw_files[]` → `gh api repos/<owner>/<repo>/contents/<path>` (curl 不可)
- `npm[]` → `gh api https://registry.npmjs.org/<pkg>/latest`
- `pypi[]` → `gh api https://pypi.org/pypi/<pkg>/json`
- `eol` → `gh api https://endoflife.date/api/<product>.json`
- `web_search[]` → `WebSearch`
- `related_internal[]` → `Read` で `knowledge/<path>.md`

返却 JSON は `scripts/staleness/agent-output.schema.json` 準拠。

### 3. 検証 → confidence 判定 + 自動正規化

各 sub-agent JSON に対して main セッションが以下を順に適用する:

1. **JSON Schema 検証**: `node scripts/staleness/validate-output.mjs` にパイプ
   - 不適合 → 当該記事は fail 扱い、`staleness:fetch-failed` issue 起票（schema error を本文に含める）
2. **confidence 自動正規化**: `node scripts/staleness/normalize-output.mjs` にパイプ
   - sub-agent が `high` / `medium` と返しても、edits が空、または全 edits が `reviewed` 行のみなら **強制的に `low` に降格**
   - これにより集計値の正確性を担保

confidence 4 段階:

| Confidence | 条件 | アクション |
|---|---|---|
| **high** | 明確な事実誤り（バージョン・URL・API 署名等）を複数ソースで確認 | 個別 PR 起票 |
| **medium** | パターンシフト示唆（推奨手順変化、deprecation 等）、判断余地あり | 個別 PR + `staleness:needs-review` ラベル |
| **low** | 既存本文と矛盾なし。`reviewed` のみ更新（fast-path 対象もここ） | バッチ PR に集約 |
| **fail** | 必要ソースの取得に全失敗 | `staleness:fetch-failed` issue 起票、記事は変更なし |

### 4. 書き換え

confidence 別:

- **high / medium**: sub-agent の `edits[]` を main セッションが Edit ツールで適用 + `reviewed` を today に更新
- **low**: 本文は変更せず `reviewed` のみ today に更新
- **fail**: 何も変更しない

更新ルール:

- 事実訂正を優先、スタイル微調整は別 PR で
- `2026-04 時点` のような時点表記があれば日付を更新
- 情報源 URL 切れもその場で直す

### 5. 検証

1. `pnpm run test`
2. `markdownlint-cli2 --fix knowledge/**/*.md`

INDEX.md は git 管理外（`pnpm run generate-index` で必要時のみ手動生成）。

### 6. PR / issue 起票

`--dry-run` 指定時はここで終了し、ワーキングツリーから変更を破棄して完了報告する。それ以外は以下を自動実行する。

#### 個別 PR（high / medium）

記事ごとに 1 PR:

- **ブランチ**: `docs/staleness-<article-slug>-<YYYYMMDD>`（slug は `ai-agents-gemini-cli` のように slash → hyphen に変換）。type prefix `docs` は CI Branch Name Check の許容 type に合わせる
- **コミット**: `docs(knowledge): refresh <article-path> (<YYYY-MM-DD>)`
- **PR タイトル**: 同上
- **PR 本文**: 検出差分の要約 + 参照ソース URL リスト
- **medium のみ**: `gh pr edit <N> --add-label staleness:needs-review`
- **auto-merge**: `gh pr merge --auto --squash --delete-branch`

#### バッチ PR（low）

`--staleness-group <name>` 指定時のみ routine 名でひとまとめにする:

- **ブランチ**: `chore/staleness-<routine>-<YYYYMMDD>`（例: `chore/staleness-monthly-20260504`）。type prefix `chore` は CI Branch Name Check の許容 type に合わせる
- **コミット**: `chore(knowledge): verified N <routine> articles (<YYYY-MM-DD>)`
- **PR タイトル**: 同上
- **PR 本文**: 検証済み記事のリスト（`reviewed` 更新のみ、fast-path 件数も内訳表示）
- **auto-merge**: 同上

`--staleness-group` 以外で low のみのケース（単一指定など）はバッチ PR を作らずワーキングツリーに残して終了。

#### Issue（fail）

- **タイトル**: `staleness: fetch failed for <article-path>`
- **本文**: 失敗 sources の URL とエラー内容（schema validation 失敗時は schema error も）
- **ラベル**: `staleness:fetch-failed`
- 同名 open issue が既にあれば新規起票せずコメント追記

#### lint/test 失敗時

`pnpm run typecheck` / `test` / markdownlint 等が失敗したら in-session で 1〜2 回まで自動修正を試みる。それでも解決しない場合は該当記事を skip し、fail 扱い issue を起票して残りの記事処理は続行する。

### 7. 完了報告

```text
update 完了:
  対象:        <path>（N 件 / fast-path F 件）
  内訳:        high X / medium Y / low Z / fail W
  PR 起票:     個別 X+Y 件 + バッチ 1 件
  issue 起票:  W 件
  reviewed:    YYYY-MM-DD に更新
```

## frontmatter の扱い

各記事冒頭に `reviewed: YYYY-MM-DD` 等のメタデータを保持する。新規記事作成時のルールは `create` スキル参照。

## 責務の範囲

- 本スキルは **既存記事の再検証と最新化のみ**
- 新規記事作成は `create`、健全性検査（リンク切れ・frontmatter 欠損・重複・孤立）は `audit`

## 注意事項

- update は破壊的編集を伴う。実行前に作業ツリーが clean であること
- `--staleness-group` 以外は 1 PR にまとめない（カテゴリ単位 / 関連記事単位で分ける）
- リサーチに確信が持てない場合は記事更新せず fail 扱い issue 起票
- .env や機密情報は絶対に追記しない
- 本スキルは AskUserQuestion を呼ばない（Routines 想定の完全自律フロー）。`--dry-run` で side-effect を抑制
