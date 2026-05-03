---
description: knowledge ベースの健全性を監査し、問題を検出してレポートする
argument-hint: "[--category <name> | <article-path>] [--stale <days>]"
allowed-tools: Read, Bash, Grep, Glob, WebFetch, AskUserQuestion
---

# audit

`.agents/skills/audit/SKILL.md` を Read し、ワークフロー手順に従う。

## Claude Code 固有の追加事項

### 入力解析

引数からフィルタ範囲と `--stale` 閾値を決定する。省略時は全記事・90 日。

### 検査の並列化

手順 2（検査）の各項目（frontmatter・INDEX 整合・Stale・リンク・重複・孤立）は独立しているため、`Agent` ツールに `subagent_type: general-purpose` を指定して並列実行してよい。リンク検査は特に外部アクセスが必要なため積極的に並列化する。

### 完了報告後

audit で問題が検出された場合、AskUserQuestion を呼び出す（`answers` パラメータは設定しない）:

- **「update で stale 記事を一括更新」** → `.claude/skills/update/SKILL.md` を Read して該当記事の再検証に移行
- **「個別に修正する」** → レポートのみ残して終了
- **「終了する」** → そのまま終了

問題が検出されなかった場合は AskUserQuestion を呼ばず、そのまま終了する。
