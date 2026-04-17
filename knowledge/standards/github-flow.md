# GitHub Flow

GitHub が提唱するシンプルな Git ワークフロー。`main` を常にデプロイ可能に保ち、新しい変更は短命な feature branch で行う。Git Flow より軽量で、継続的デリバリーに適している。

## 核となる原則

1. **`main` は常にデプロイ可能**
2. **新しい作業はブランチで**（`main` への直接 push 禁止）
3. **ブランチは短命**（数日〜1 週間で merge）
4. **PR でレビュー・議論**（ここで CI・ペアレビューを通す）
5. **merge 後すぐデプロイ**（可能ならば自動）

## ワークフロー

```text
main
 │
 ├─ feat/add-search         ← ブランチ作成
 │   │ commit commit commit
 │   └─→ PR open → review → approve → squash merge → feat/add-search 削除
 │
 ├─ fix/login-regression
 │   │ commit
 │   └─→ PR open → review → squash merge → fix/login-regression 削除
 │
 └─ main (deploy)
```

## ブランチ命名

- `<type>/<short-description>` 形式
- type は Conventional Commits と揃える: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`
- description は英語、ケバブケース、簡潔に

```text
feat/add-blog-pagination
fix/nav-overflow-on-mobile
docs/update-mcp-setup
chore/bump-zod-3-25
```

## Merge 戦略

### Squash merge を推奨

- PR 中の複数コミットを 1 つに圧縮して `main` に取り込む
- 履歴が直線的になり、`git log main` が読みやすい
- revert が 1 コミットで済む
- PR タイトル = Conventional Commits の形式にしておけば、`main` のコミットログも規約準拠になる

### Rebase merge は避ける

- レビュー途中で force-push が発生しやすく、レビュー UX が悪い
- 共有ブランチの履歴改変リスク

### Merge commit は避ける

- 履歴に merge commit が多数残り、`git log` が読みづらい
- bisect が困難になる

## PR のライフサイクル

1. **ブランチ作成**: `git switch -c feat/xxx`
2. **コミット**: Conventional Commits 形式
3. **push**: `git push -u origin <branch>`
4. **PR open**: タイトルは `<type>[scope]: <description>` 形式
5. **CI 通過 + レビュー**: 最低 1 名の approve（プロジェクトによる）
6. **squash merge**: GitHub UI または `gh pr merge --squash --delete-branch`
7. **ブランチ削除**: GitHub 側 + ローカル (`git branch -d <branch>`)

## PR タイトル規約

PR タイトルそのものが squash merge 後のコミットメッセージになるため、Conventional Commits の形式で書く:

```text
feat(api): add pagination to /users
fix: handle empty response from upstream
docs: clarify MCP registration scope
```

## 禁止事項

- **`main` への直接 push**: 常にブランチ + PR を経由
- **`--force` push**: 共有ブランチでは絶対禁止。feature branch でも極力避ける。必要なら `--force-with-lease`
- **未マージ feature branch の削除**: 作業喪失のリスク
- **`--no-verify` でのフックスキップ**: 品質チェックを迂回しない
- **merge 後のブランチ放置**: 認知負荷と混乱の元

## 保護ルール（推奨）

GitHub の branch protection で `main` に対し:

- Require PR before merging
- Require approvals: 1+
- Require status checks to pass
- Require branches to be up to date
- Restrict force pushes
- Restrict deletions

## Git Flow との違い

| 観点 | GitHub Flow | Git Flow |
|---|---|---|
| 中心ブランチ | `main` のみ | `main` + `develop` |
| リリースブランチ | なし | `release/*` を切る |
| hotfix | 通常の fix ブランチ | `hotfix/*` を切る |
| 適性 | 継続的デリバリー | 厳格なバージョンリリース |
| 複雑さ | 低 | 高 |

## エージェント運用への影響

AI エージェントに自動で作業させる場合、GitHub Flow は相性が良い:

- ブランチ1 つに対して 1 タスク、明確なスコープ
- PR が作業の単位になり、レビュー可能な粒度に揃う
- squash merge なら途中コミットの汚さは気にせず細かくコミットできる（エージェントが試行錯誤した痕跡が `main` に残らない）
