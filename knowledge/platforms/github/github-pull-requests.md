---
reviewed: 2026-05-05
tags: [github, methodology]
---

# GitHub Pull Requests

GitHub の Pull Request（PR）はブランチ間の差分を提案・レビュー・取り込みするための単位。コードレビュー、自動チェック、議論、マージ戦略を 1 つの UI に集約する。

公式: [GitHub Pull Requests docs](https://docs.github.com/en/pull-requests)

関連記事:

- ワークフロー全体: [`standards/github-flow.md`](../../standards/github-flow.md)
- コミット規約: [`standards/conventional-commits.md`](../../standards/conventional-commits.md)
- Issue 側のプラクティス: [`platforms/github/github-issues.md`](github-issues.md)
- CLI 操作: [`platforms/github/gh-cli.md`](gh-cli.md)

## PR の基本ライフサイクル

```text
feature branch ──push──▶ open PR ──review──▶ approve ──checks pass──▶ merge ──delete branch
                              │
                              └─ Draft（作業中・レビュー要請しない）
```

1. ブランチ作成（`<type>/<short-description>`）
2. コミット（Conventional Commits）
3. push
4. PR open（タイトルは `<type>[scope]: <description>`）
5. CI 通過 + レビュー approve
6. **squash merge** + ブランチ削除

## PR タイトルと本文

PR タイトルは squash merge 後の commit message になるため、Conventional Commits 形式で書く:

```text
feat(api): add pagination to /users
fix: handle empty response from upstream
docs: clarify MCP registration scope
```

本文に必ず含めたい情報:

| セクション | 内容 |
|---|---|
| Summary | 何を変えたか・なぜ変えたか（差分の WHAT より WHY） |
| Linked issue | `Fixes #123` などの closing keyword |
| Test plan | 動作確認手順（手動 / 自動）。レビュアーが追試できる粒度 |
| Screenshots | UI 変更がある場合（before/after） |
| Notes | 後続 Issue・関連 PR・既知の制約 |

## Draft PR

作業途中で push しておきたい時は **Draft** で open する:

- レビュー要請が飛ばない
- CODEOWNERS が自動アサインされない
- マージ不可（マージボタンが無効化）
- CI は走る

```bash
gh pr create --draft --title "feat: WIP add pagination"
gh pr ready    # Draft → Ready for review
```

レビューを受ける準備ができたら **Ready for review** に切り替える。

## Issue とのリンク

PR 本文に closing keyword を書くと、デフォルトブランチへのマージ時に Issue が自動 close される:

```text
Closes #123
Fixes ozzy-labs/other-repo#45
```

詳細は [`github-issues.md`](github-issues.md#closing-keywordspr-から-issue-を閉じる) を参照。

## 適切な PR サイズ

| サイズ目安 | 評価 |
|---|---|
| 〜200 行 | レビュー容易・推奨 |
| 200〜500 行 | 上限。レビュー時間が線形以上に増える |
| 500 行〜 | 分割を検討（refactor と機能追加を混ぜていないか） |

巨大 PR は:

- 機能追加と無関係な refactor を別 PR に分離
- スタック PR（base ブランチに別 PR をぶら下げる）で段階的にレビュー
- Sub-issue で実装単位に分割

## レビュー操作

レビュアーが取れる 3 つの状態:

| 状態 | 用途 |
|---|---|
| Comment | フィードバックのみ。承認も差し戻しもしない |
| Approve | マージ承認 |
| Request changes | 修正必須。同じレビュアーの再 review が必要 |

その他の機能:

- **Suggested changes**: コメント欄に ` ```suggestion ` ブロックを書くと、作者が 1 クリックで適用できるパッチになる
- **Re-request review**: 修正後にレビュアーへ再依頼
- **Resolve conversation**: スレッドを解決済みにマーク。`Require conversation resolution` 保護でマージ条件にできる

## 自動チェックと CI

PR の `Checks` タブに GitHub Actions などの workflow 結果が並ぶ。Branch protection で **Required status checks** に登録すると、green でない限りマージできない。

- ステータスは `success` / `skipped` / `neutral` のいずれかで通過扱い
- ジョブ名（matrix 込み）の完全一致で指定する。matrix 名が変わると required check 設定の更新が必要

## マージ戦略

| 方式 | 動作 | 推奨用途 |
|---|---|---|
| **Squash and merge** | feature の全コミットを 1 コミットに圧縮 | デフォルト推奨。履歴が直線的になる |
| Rebase and merge | 各コミットを base に replay（新 SHA） | 線形履歴が必要かつ各コミットが意味を持つ場合のみ |
| Merge commit | merge commit を作成し履歴を保持 | hot-fix の経緯を残したい等の例外 |

詳細トレードオフは [`standards/github-flow.md`](../../standards/github-flow.md#merge-戦略) を参照。

リポジトリ設定で許可する merge 方式を絞れる（Settings → General → Pull Requests）。Squash のみ許可するのが最もシンプル。

### Squash merge のコミットメッセージ

GitHub のデフォルトでは PR タイトルがメッセージになる。Conventional Commits 準拠の PR タイトルにしておけば、`main` の commit log もそのまま規約に沿う。

`gh pr merge --squash --subject "..." --body "..."` で明示指定も可能。

## Auto-merge

CI 完了を待ってから自動でマージしたい時は Auto-merge:

```bash
gh pr merge --auto --squash --delete-branch
```

要件:

- リポジトリ設定で Auto-merge が有効化されていること（Settings → General → Pull Requests → Allow auto-merge）
- マージ条件（reviews / required checks）が即座に満たせない状況であること（満たしていれば即マージ）
- 書き込み権限を持つユーザーが有効化

挙動:

- 条件が揃った瞬間にマージ実行
- 条件不一致の push があれば自動的にキャンセル
- fork からの PR で外部コントリビューターが push すると Auto-merge は解除される（セキュリティ）

## CODEOWNERS

`.github/CODEOWNERS`（または リポジトリルート / `docs/`）でパスごとの自動レビュアーを定義する:

```text
# .github/CODEOWNERS

# 全体のフォールバック
*           @ozzy-labs/maintainers

# 領域別
/src/api/   @ozzy-labs/backend
/src/web/   @ozzy-labs/frontend
*.md        @ozzy-labs/docs

# CODEOWNERS 自体の改変保護
/.github/CODEOWNERS  @ozzy-labs/maintainers
```

- パスにマッチした owner が自動的に reviewer に追加される
- Branch protection で **Require review from Code Owners** を有効化すれば、CODEOWNERS の approve 必須化
- ファイルサイズ上限 3 MB

## Branch Protection / Rulesets

`main` に対して最低限設定すべき項目:

| 設定 | 効果 |
|---|---|
| Require a pull request before merging | 直接 push を禁止 |
| Require approvals: 1 以上 | レビュー必須 |
| Dismiss stale approvals when new commits are pushed | 修正後に再 approve を要求 |
| Require review from Code Owners | CODEOWNERS の approve を必須化 |
| Require status checks to pass | CI green を要求 |
| Require branches to be up to date before merging | base の最新化を要求 |
| Require conversation resolution | 未解決スレッドのマージを禁止 |
| Restrict force pushes | 履歴改変を禁止 |
| Restrict deletions | 保護ブランチの削除を禁止 |
| Require linear history | merge commit を禁止（squash / rebase のみ） |
| Require signed commits | GPG / SSH 署名を要求 |

GitHub の **Rulesets** は branch protection の上位互換で、組織横断適用や bypass 設定が可能。新規リポジトリは Rulesets を推奨。

## レビュー依頼のマナー

- **小さく出す**: 200 行以内を目指す
- **目的を本文に書く**: なぜこの変更が必要か（コードからは読めない）
- **動作確認方法を明記**: レビュアーが追試できる
- **自分でも先に diff を読む**: 機械的なミス（不要 import、デバッグ print）はセルフレビューで除く
- **WIP は Draft で**: ready なものだけレビュー要請する

## AI エージェントがよくやるミス

1. **PR タイトルが Conventional Commits 形式でない** — `Update files` のような曖昧タイトル。squash merge 後の commit log が壊れる
2. **本文に Test plan を書かない** — レビュアーが動作確認の入口を失う。少なくとも「どのコマンドを叩けば検証できるか」を 1 行書く
3. **無関係な refactor を機能追加 PR に混ぜる** — 差分が読みにくくなり、レビュー時間が爆発する。別 PR に分ける
4. **`Closes #123` を default 以外のブランチへの PR に書く** — Issue が自動 close されない
5. **`gh pr merge --auto` をリポジトリ設定未対応のまま叩く** — エラーになる。事前に Allow auto-merge を確認
6. **Required status check の名前が変わったのに保護設定を更新しない** — 古い check が永遠に pending のままマージ不能になる

## 参考

- [GitHub Pull Requests docs](https://docs.github.com/en/pull-requests)
- [About pull request merges](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/about-pull-request-merges)
- [Automatically merging a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request)
- [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
