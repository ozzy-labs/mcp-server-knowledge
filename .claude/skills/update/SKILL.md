---
description: knowledge ベース内の既存記事を最新情報で再検証・更新する（Routines 想定の非対話実行）
argument-hint: "<article-path | category | --stale [days] | --staleness-group <name> | --all> [--parallel N] [--dry-run] [--force-research]"
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch
---

# update

`.agents/skills/update/SKILL.md` を Read し、ワークフロー手順に従う。本スキルは Routines および手動実行いずれからも呼び出される非対話・自律実行型ワークフロー。AskUserQuestion は使わない。

## Claude Code 固有の追加事項

### sub-agent 起動

手順 2（リサーチ）では `Agent` ツールに `subagent_type: staleness-researcher` を指定して並列起動する（定義は `.claude/agents/staleness-researcher.md`）。同 agent は `allowed-tools` で Edit / Write / curl が物理的に禁止されている。

並列度は `--parallel <N>`（デフォルト 4、上限 16）。例:

- `/update --staleness-group daily` → 並列 4（デフォルト）
- `/update --staleness-group monthly --parallel 8` → 並列 8
- `/update --all --parallel 16` → 並列 16（上限）

各 sub-agent には sources.yaml の該当エントリと記事パスを渡し、`scripts/staleness/agent-output.schema.json` 準拠の JSON で confidence + 差分提案を返させる。Edit / Write は agent 定義で禁止されているため、main セッションが `edits[]` を Edit ツールで適用する。

### sub-agent JSON validation + 自動正規化

main セッションは各 sub-agent の出力に対し以下を順に適用する:

```bash
# 1. Schema validation（不適合は fail 扱い）
echo "$AGENT_JSON" | node scripts/staleness/validate-output.mjs

# 2. Confidence auto-downgrade（edits 空 / frontmatter only → low）
echo "$AGENT_JSON" | node scripts/staleness/normalize-output.mjs
```

正規化済み JSON を各記事の処理に使用する。

### fast-path 振り分け

手順 1.3 の fast-path 判定は以下の Bash で行う:

```bash
threshold=$(case "$ROUTINE" in daily) echo 1 ;; weekly) echo 7 ;; monthly) echo 30 ;; esac)
half=$((threshold / 2))
days_old=$(( ( $(date -u +%s) - $(date -u -d "$reviewed" +%s) ) / 86400 ))
if [ "$days_old" -lt "$half" ] && [ -z "$FORCE_RESEARCH" ]; then
  # fast-path: skip sub-agent, bump reviewed only
fi
```

### 既存 PR との衝突回避

```bash
gh pr list --state open --search "head:staleness/" --json headRefName --jq '.[].headRefName'
```

`staleness/<article-slug>-*` または `staleness/<routine>-*` ブランチで open PR がある記事はスキップ。同日の同 routine バッチは旧ブランチに追記する形に切り替える。

### 完了後

`--dry-run` 未指定時は PR 作成 + auto-merge まで実施し、完了報告して終了する。`AskUserQuestion` は呼ばない。

`--dry-run` 指定時は research 結果のサマリのみを stdout に出力し、ファイル変更は破棄する。
