---
name: update
description: knowledge ベース内の既存記事を最新情報で再検証・更新する。記事パス単体、カテゴリ、`--stale`、または `--staleness-group` で指定可能。Routines などの非対話実行にも対応する。
---

# update - knowledge 記事の再検証・最新化

指定した記事（または古い記事すべて）について、外部情報源で現状を再確認し、ずれている箇所を書き換えて `reviewed` 日付を更新する。Routines 等のクラウド非対話実行にも対応する。

## 入力

引数は以下のいずれか:

- **単一記事**: `ai/agents/gemini-cli.md` のようなパス、または `ai/agents/gemini-cli` / `gemini-cli` の省略形
- **カテゴリ**: `tools`, `standards`, `languages`, `platforms`（配下の全記事が対象）
- **`--stale [days]`**: `reviewed` が `days` 日以上前の記事すべて（デフォルト 90）
- **`--staleness-group <daily|weekly|monthly>`**: `scripts/staleness/sources.yaml` の `group: <name>` に該当する記事すべて（`skip: true` の記事は除外）
- **`--all`**: 全記事（慎重に使う）

引数がなければ `--stale 90` として扱う。

### モディファイア（位置に依存しない）

- **`--non-interactive`**: 確認 (`AskUserQuestion` 等) を呼ばず、判断をすべて skill 側で行う。Routines / CI からの呼び出し用。
- **`--auto-ship`**: 完了時に `ship` 相当の処理（lint → commit → PR 作成）を自動で行う。`--non-interactive` と併用前提。

## 手順

### 1. 対象記事の特定

1. 引数を解析し、対象記事の配列を決定する
2. `--staleness-group <name>` の場合:
   - `scripts/staleness/sources.yaml` を `yq -o json` で JSON に変換し、`group == <name>` かつ `skip != true` のキーを抽出する
   - 抽出したキー（`ai/agents/claude-code` 等）に `.md` を付け、`knowledge/` 配下の実ファイルにマッピングする
   - 該当ファイルが存在しない場合はエラーで中断（sources.yaml と記事の整合性問題）
3. `knowledge/**/*.md` から frontmatter `reviewed` を読み取り、スキップ可能か判定
   - 単一指定 / `--staleness-group`: 必ず実行（`reviewed` の値に関わらず）
   - `--stale`: 閾値より古いもののみ
4. 対象が 0 件なら「更新不要」と報告して終了
5. 単一指定したパスが存在しない場合はエラーを出し、`create` スキルの使用を案内する
6. 既存の open PR が `claude/staleness/{path}/*` ブランチで立っている記事は衝突回避のためスキップ（`gh pr list --state open --search "head:claude/staleness"`）

### 2. リサーチ

各記事について:

1. 記事本文を読み、主題と検証すべき事実を抽出する
   - モデル名・バージョン番号・URL・API 署名・コマンドフラグなど
2. **sources.yaml ベースのフェッチ（`--staleness-group` または該当エントリがある場合）:**
   - `sources.<method>` を method 別に並列 fetch する
     - `docs[]` / `rss[]` → `WebFetch`（オーバーレイで指定された Web 取得手段でも可）
     - `github_releases[]` → `gh release list -R <owner/repo> --limit 5` + `gh release view`
     - `raw_files[]` → `curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>`
     - `npm[]` → `curl -fsSL https://registry.npmjs.org/<pkg>/latest | jq '{version, time}'`
     - `pypi[]` → `curl -fsSL https://pypi.org/pypi/<pkg>/json | jq '{info: {version: .info.version, requires_python: .info.requires_python}}'`
     - `eol` → `curl -fsSL https://endoflife.date/api/<product>.json`
     - `web_search[]` → 実行エージェントの Web 検索手段（オーバーレイで指定）
     - `related_internal[]` → `knowledge/<path>.md` を読み、依存記事の現状把握に使う
3. **sources.yaml にエントリがない記事（手動指定の場合）:**
   - 公式ドキュメント、ソースリポジトリ、リリースノート、Web 検索を用いて現状を再確認する
4. 複数記事が対象で、実行エージェントが並列委譲をサポートする場合は活用してよい（具体的な並列化手段はオーバーレイ側で指示する）

### 3. 検証 → confidence 判定

各記事につき、リサーチ結果と既存本文の差分から confidence を 4 段階で判定する:

| Confidence | 条件 | アクション |
|---|---|---|
| **high** | 明確な事実誤り（バージョン・URL・API 署名等）を検出し、複数ソースで裏付けられている | 個別 PR を起票して書き換え |
| **medium** | パターンシフト（推奨手順の変化、deprecation 通知等）が示唆されるが、表現に判断の余地がある | 個別 PR を起票し、`staleness:needs-review` ラベルを付与 |
| **low** | 既存本文と矛盾なし。`reviewed` のみ更新 | バッチ PR に集約 |
| **fail** | 必要なソースの取得に全失敗（404 / 403 / network error）。検証不能 | 記事は変更せず、`staleness:fetch-failed` ラベル付き issue を起票 |

`scripts/staleness/sources.yaml` の `verification.confidence_threshold` は「下回ったら fail 扱いに格上げする最低基準」として参照する（high / medium / low の指定）。

### 4. 書き換え

confidence 別の挙動:

- **high / medium**: 記事を編集 + `reviewed` を今日に更新
- **low**: 本文は変更せず `reviewed` のみ今日に更新
- **fail**: 何も変更しない

更新ルール:

- 事実の訂正を優先。スタイルの微調整は別 PR で
- `2026-04 時点` のような時点表記があれば日付を更新
- 情報源の URL 切れもその場で直す

### 5. 検証

1. `pnpm run generate-index` で INDEX.md を更新
2. `pnpm run test` でテスト通過を確認
3. `markdownlint-cli2 --fix` で書式を整える

### 6. PR / issue 起票（`--auto-ship` 指定時）

`--auto-ship` または `--non-interactive --auto-ship` の場合のみ自動で実行する。手動モードでは完了報告のみ。

#### 個別 PR（high / medium）

記事ごとに 1 PR:

- **ブランチ**: `claude/staleness/<article-path>/<YYYYMMDD>`（例: `claude/staleness/ai/agents/gemini-cli/20260504`）
- **コミット**: `docs(knowledge): refresh <article-path> (<YYYY-MM-DD>)`
- **PR タイトル**: `docs(knowledge): refresh <article-path> (<YYYY-MM-DD>)`
- **PR 本文**: 検出された差分の要約と参照ソース URL のリストを含める
- **medium のみ**: `gh pr edit <N> --add-label staleness:needs-review`

#### バッチ PR（low）

`--staleness-group <name>` 指定時は routine 名でひとまとめにする:

- **ブランチ**: `claude/staleness/batch/<routine>/<YYYYMMDD>`（例: `claude/staleness/batch/daily/20260504`）
- **コミット**: `chore(knowledge): verified N <routine> articles (<YYYY-MM-DD>)`
- **PR タイトル**: 同上
- **PR 本文**: 検証済み記事のリスト（`reviewed` 更新のみ）

`--staleness-group` 以外で low のみのケース（単一指定など）はバッチ PR を作らず終了する。

#### Issue（fail）

- **タイトル**: `staleness: fetch failed for <article-path>`
- **本文**: 失敗した sources の URL とエラー内容
- **ラベル**: `staleness:fetch-failed`
- 同名の open issue が既にある場合は新規起票せずコメント追記

#### ship lint/test 失敗時

`pnpm run typecheck` / `pnpm run test` / `markdownlint-cli2` 等が失敗した場合、in-session で 1〜2 回まで自動修正を試みる。それでも解決しない場合はその記事だけスキップして fail 扱い issue を起票し、他の記事の処理は続行する。

### 7. 完了報告

```text
update 完了:
  対象:        <path>（N 件）
  内訳:        high X / medium Y / low Z / fail W
  PR 起票:     個別 X+Y 件 + バッチ 1 件
  issue 起票:  W 件
  reviewed:    YYYY-MM-DD に更新
```

## frontmatter の扱い

各記事の冒頭に以下の形式でメタデータが入っている:

```markdown
---
reviewed: YYYY-MM-DD
---

# 記事タイトル

...
```

- `reviewed` は「事実が検証された最終日」を表す
- YAML でのパースを想定するが、現在は `key: value` のフラット形のみ使用
- 新規記事作成時のルールは `create` スキルを参照

## 責務の範囲

- 本スキルは**既存記事の再検証と最新化のみ**を扱う
- 新規記事の作成は `create` スキル
- リンク切れ・frontmatter 欠損・重複・孤立記事などの健全性検査は `audit` スキル

## 注意事項

- update は**破壊的な編集**を伴う。実行前に作業ツリーが clean であること
- 複数記事の一括更新でも `--staleness-group` 以外は 1 PR にまとめない（レビュー困難）。カテゴリ単位、または関連記事ごとに PR を分ける
- リサーチ結果に確信が持てない場合は記事更新せず、`staleness:fetch-failed` issue で報告する
- `--non-interactive` モードでも user 確認が必要な判断（破壊的なファイル削除等）は安全側に倒し、skip して fail 扱い issue を起票する
- .env や機密情報は絶対に追記しない
