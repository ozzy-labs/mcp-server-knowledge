---
description: knowledge ベース内の記事を最新情報で再検証・更新する
argument-hint: "<article-path | category | --stale [days] | --all>"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---

# refresh

`.agents/skills/refresh/SKILL.md` を Read し、ワークフロー手順に従う。

## Claude Code 固有の追加事項

### 入力解析

引数を解析し、対象記事を決定する。省略時は `--stale 90`。

### リサーチエージェントの活用

手順 2（リサーチ）では `Agent` ツールに `subagent_type: general-purpose` を指定して並列起動する。複数記事を一度に更新する場合は 3〜4 並列まで。

### 完了報告後

refresh で記事を書き換えた場合、AskUserQuestion を呼び出す（`answers` パラメータは設定しない）:

- **「ship まで進める」** → `.claude/skills/ship/SKILL.md` を Read して lint → commit → PR 作成
- **「終了する」** → 変更はワーキングツリーに残したまま終了

refresh で変更がなかった場合は AskUserQuestion を呼ばず、そのまま終了する。
