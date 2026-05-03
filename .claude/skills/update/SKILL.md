---
description: knowledge ベース内の既存記事を最新情報で再検証・更新する
argument-hint: "<article-path | category | --stale [days] | --staleness-group <name> | --all> [--non-interactive] [--auto-ship]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---

# update

`.agents/skills/update/SKILL.md` を Read し、ワークフロー手順に従う。

## Claude Code 固有の追加事項

### 入力解析

引数を解析し、対象記事と実行モードを決定する:

- 位置引数省略時は `--stale 90` として扱う
- `--non-interactive` 指定時は `AskUserQuestion` を一切呼ばず、すべての判断を本スキルが行う
- `--auto-ship` 指定時は完了時に自動で `ship` 相当の処理（lint → commit → push → PR 作成）を行う
- `--staleness-group <name>` 指定時は `scripts/staleness/sources.yaml` を `yq -o json scripts/staleness/sources.yaml | jq` でパースする

### sources.yaml ベースのフェッチ

手順 2-3 の各 method は以下のツール / Agent に対応させる:

- `docs[]`、`rss[]` → `WebFetch`
- `github_releases[]` → `Bash` で `gh release list -R <owner/repo> --limit 5` および `gh release view`
- `raw_files[]` → `Bash` で `curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/HEAD/<path>`
- `npm[]` → `Bash` で `curl -fsSL https://registry.npmjs.org/<pkg>/latest | jq '{version, time}'`
- `pypi[]` → `Bash` で `curl -fsSL https://pypi.org/pypi/<pkg>/json | jq '{info: {version: .info.version, requires_python: .info.requires_python}}'`
- `eol` → `Bash` で `curl -fsSL https://endoflife.date/api/<product>.json`
- `web_search[]` → `WebSearch`
- `related_internal[]` → `Read` で `knowledge/<path>.md` を取得

### リサーチエージェントの活用

手順 2（リサーチ）では `Agent` ツールに `subagent_type: general-purpose` を指定して並列起動する:

- 単一記事更新: 並列度 1（本セッションで処理）
- 複数記事（カテゴリ / `--staleness-group` / `--stale`）: 3〜4 並列まで
- `--staleness-group monthly` のように 30 件超の場合: 4 並列を維持し、ウェーブ単位で処理

各 sub-agent には sources.yaml の該当エントリと記事パスを渡し、confidence 判定（high / medium / low / fail）と差分要約を返させる。判定結果を本セッションが集約し、PR / issue 起票を行う。

### 完了報告後

#### 対話モード（`--non-interactive` なし）

update で記事を書き換えた場合、AskUserQuestion を呼び出す（`answers` パラメータは設定しない）:

- **「ship まで進める」** → `.claude/skills/ship/SKILL.md` を Read して lint → commit → PR 作成
- **「終了する」** → 変更はワーキングツリーに残したまま終了

update で変更がなかった場合は AskUserQuestion を呼ばず、そのまま終了する。

#### 非対話モード（`--non-interactive`）

`AskUserQuestion` を一切呼ばない:

- `--auto-ship` あり: 個別 PR / バッチ PR / fail issue を自動起票し、完了報告して終了
- `--auto-ship` なし: 変更内容をワーキングツリーに残したまま完了報告して終了（後続フローに任せる）

### 既存 PR との衝突回避

- `gh pr list --state open --search "head:claude/staleness"` を呼び、`claude/staleness/<article-path>/*` ブランチで open PR がある記事はスキップ
- バッチ PR `claude/staleness/batch/<routine>/<YYYYMMDD>` の同日重複は新規 commit を旧ブランチに追記する形に切り替える
