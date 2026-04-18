---
description: トピック指定で新規の knowledge 記事を作成する
argument-hint: "<topic> [--category <tools|standards|languages|platforms>]"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, AskUserQuestion
---

# create

`.agents/skills/create/SKILL.md` を Read し、ワークフロー手順に従う。

## Claude Code 固有の追加事項

### 入力解析

引数をトピックとして扱う。`--category` がある場合はカテゴリヒントとして利用。引数がなければ何の記事を作るかユーザーに確認する。

### リサーチエージェントの活用

手順 4（リサーチ）では `Agent` ツールに `subagent_type: general-purpose` を指定して調査を委譲してよい。情報源は公式ドキュメント・ソースリポジトリ・リリースノートを優先する。

### 重複検出時の確認

手順 1 で類似記事が見つかった場合、AskUserQuestion で以下を確認（`answers` パラメータは設定しない）:

- **「既存記事を update で最新化」** → `.claude/skills/update/SKILL.md` を Read して既存記事の再検証に移行
- **「別記事として新規作成」** → そのまま手順 2 へ進む
- **「中止する」** → 終了

### 完了報告後

create で記事を追加した場合、AskUserQuestion を呼び出す（`answers` パラメータは設定しない）:

- **「ship まで進める」** → `.claude/skills/ship/SKILL.md` を Read して lint → commit → PR 作成
- **「終了する」** → 変更はワーキングツリーに残したまま終了
