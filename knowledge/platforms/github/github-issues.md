---
reviewed: 2026-05-05
tags: [github, methodology]
---

# GitHub Issues

GitHub Issues はリポジトリの作業項目（バグ・タスク・要望・調査）を追跡するためのトラッカー。コメント・ラベル・マイルストーン・PR とのリンクを通じて、議論と実装を 1 つのスレッドに集約する。

公式: [GitHub Issues docs](https://docs.github.com/en/issues)

関連記事:

- ワークフロー全体: [`standards/github-flow.md`](../../standards/github-flow.md)
- CLI 操作: [`platforms/github/gh-cli.md`](gh-cli.md)
- PR 側のプラクティス: [`platforms/github/github-pull-requests.md`](github-pull-requests.md)

## Issue を立てる前に確認する

1. **重複の検索**: `is:issue <keyword>` で open/closed の両方を確認する
2. **再現条件**: バグなら最小再現手順を準備する
3. **スコープ**: 1 Issue = 1 トピック。複数の問題が混ざるならサブ Issue または別 Issue に分割する

## 良い Issue の構成

| セクション | 役割 |
|---|---|
| タイトル | 検索可能な要約。`<scope>: <subject>` のように prefix を付けると一覧が読みやすい |
| 概要 | 何が起きているか・何を達成したいか |
| 再現手順 / 期待結果 | バグの場合は必須。期待と実際を分離する |
| 環境 | バージョン・OS・ブラウザ・依存ライブラリ |
| 補足 | スクリーンショット、ログ、関連 Issue/PR へのリンク |

タイトルは「動詞 + 対象」が読みやすい（`Add pagination to /users` / `Fix login redirect on Safari`）。

## ラベル運用

ラベルは検索・自動化・優先度判断のキー。最低限の分類で過剰命名を避ける。

| カテゴリ | 例 |
|---|---|
| Type | `bug`, `feature`, `docs`, `chore` |
| Priority | `priority/high`, `priority/medium`, `priority/low` |
| Status | `needs-triage`, `in-progress`, `blocked`, `wontfix` |
| Area | `area/api`, `area/frontend`, `area/ci` |

`/` 区切りで名前空間化すると一覧でグループ化しやすい。色は同名前空間内で揃える。

## マイルストーン・アサイン・タイプ

- **Milestone**: リリース単位 / スプリント単位の集約に。期日を付ければ進捗がバーで可視化される
- **Assignee**: 1 人を主担当に（複数アサインは責任の分散を招く）
- **Type**（Organization 機能）: `Bug` / `Feature` / `Task` の組織横断分類。リポジトリ間で集計できる

## サブ Issue

GitHub の **Sub-issues** で親 Issue → 子 Issue のツリー構造を作れる（旧来の `- [ ]` task list の発展形）。親で全体スコープ、子で実装単位を持たせると、進捗が自動集計される。

```text
#100  RFC: Auth refactor                ← Parent
 ├─ #101 Implement token rotation
 ├─ #102 Migrate session storage
 └─ #103 Update docs
```

## Issue Template / Issue Forms

`.github/ISSUE_TEMPLATE/` に置く。Markdown テンプレート（`*.md`）と Forms（`*.yaml`）の 2 形式。Forms は構造化入力ができ、必須フィールドの強制やドロップダウン選択が可能。

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yaml
name: Bug report
description: Report a defect
labels: [bug, needs-triage]
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What happened?
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Steps to reproduce
      render: bash
    validations:
      required: true
  - type: input
    id: version
    attributes:
      label: Version
      placeholder: e.g. 1.4.2
    validations:
      required: true
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options: [low, medium, high, critical]
```

`config.yaml` で Blank issue を無効化したり、外部リンク（Discussions・サポート窓口）に誘導できる:

```yaml
# .github/ISSUE_TEMPLATE/config.yaml
blank_issues_enabled: false
contact_links:
  - name: Question
    url: https://github.com/ozzy-labs/repo/discussions
    about: 質問は Discussions へ
```

## Closing keywords（PR から Issue を閉じる）

PR の本文または commit メッセージに以下のキーワードを書くと、PR がデフォルトブランチへマージされた時点で対象 Issue が自動 close される:

```text
close / closes / closed
fix / fixes / fixed
resolve / resolves / resolved
```

```text
Fixes #123
Closes ozzy-labs/other-repo#45
Fixes #100, fixes #101
```

注意点:

- **デフォルトブランチへの PR でのみ動作**する（`develop` などにマージしても閉じない）
- 複数 Issue を閉じるには各 Issue にキーワードを付ける（`Fixes #1, #2` は `#1` のみ閉じる）
- クロスリポジトリは `OWNER/REPO#N` 形式

## クローズ理由

Issue を閉じる時に **Completed** / **Not planned** / **Duplicate** を選べる。

- **Completed**: 解決した
- **Not planned**: 対応しない方針が決まった（仕様外・スコープ外）
- **Duplicate**: 別 Issue で追跡する（重複先 URL を本文に記す）

検索時に `reason:not-planned` で絞り込めるため、必ず適切な理由を選ぶ。

## トリアージ運用

毎日〜週次で `is:issue is:open label:needs-triage` を捌く:

1. ラベル付け（type, priority, area）
2. 担当（assignee）または保留（`needs-info`）
3. マイルストーンへの組み入れ
4. 重複は `Duplicate` で close

## AI エージェントがよくやるミス

1. **Issue 本文に再現手順を書かない** — バグ修正系 Issue は再現できない時点で停滞する。最小再現を必ず添付
2. **`Fixes #1, #2` のように複数 Issue を 1 キーワードで閉じようとする** — 動作しない。各 Issue 個別に `Fixes #1` `Fixes #2` を書く
3. **Closing keyword をデフォルト以外のブランチへの PR で書く** — 自動 close されない
4. **巨大な Issue をそのまま実装に持ち込む** — サブ Issue に分解して PR との 1:1 対応を保つ
5. **`Not planned` を選ばずに本文だけで「対応しません」と書いて close する** — 検索フィルタが効かなくなる

## 参考

- [GitHub Issues docs](https://docs.github.com/en/issues)
- [Issue templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [Linking a pull request to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
