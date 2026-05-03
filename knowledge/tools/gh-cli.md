---
reviewed: 2026-05-04
tags: [github, go]
aliases: [gh]
---

# gh (GitHub CLI)

GitHub 公式の CLI。PR・Issue・Actions・Releases・Secrets などブラウザの UI で行う操作をターミナルから実行できる。AI エージェント運用の基盤ツール（Claude Code / Codex CLI も Git/GitHub 操作で多用）。

公式: [cli.github.com](https://cli.github.com/) / [docs.github.com/cli](https://cli.github.com/manual/)

## インストール

```bash
# Homebrew
brew install gh

# apt
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] \
  https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# WinGet
winget install --id GitHub.cli

# mise (aqua 経由)
mise use aqua:cli/cli@latest
```

## 認証

```bash
# 対話（ブラウザ OAuth）
gh auth login

# 非対話（Personal Access Token）
echo "ghp_xxx" | gh auth login --with-token

# GitHub Enterprise Server
gh auth login --hostname ghes.example.com

# 状態確認
gh auth status

# 切り替え
gh auth switch
```

環境変数でも認証可能:

- `GH_TOKEN` / `GITHUB_TOKEN` — 優先順は `GH_TOKEN` > `GITHUB_TOKEN`
- `GH_HOST` — デフォルトホスト（GHES 用）
- `GH_ENTERPRISE_TOKEN` — GHES 用トークン

CI では `GITHUB_TOKEN` が自動的にセットされるため、ほぼ追加設定なしで動く（`GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` を env に渡す）。

## 主要サブコマンド

| コマンド | 用途 |
|---|---|
| `gh auth` | 認証 |
| `gh repo` | リポジトリ操作（create / clone / fork / view） |
| `gh issue` | Issue |
| `gh pr` | Pull Request |
| `gh run` | Actions workflow 実行 |
| `gh workflow` | Actions workflow 管理 |
| `gh release` | リリース |
| `gh gist` | Gist |
| `gh secret` | Actions secrets |
| `gh variable` | Actions variables |
| `gh label` | ラベル |
| `gh project` | GitHub Projects |
| `gh api` | 任意の REST / GraphQL API 呼び出し |
| `gh search` | 横断検索 |

## PR 操作（最頻出）

```bash
# 作成
gh pr create --title "feat: add foo" --body "..."
gh pr create --fill                      # コミットメッセージから自動補完
gh pr create --web                       # ブラウザで編集

# 一覧
gh pr list
gh pr list --state open --author @me
gh pr list --label bug

# 詳細表示
gh pr view 123
gh pr view 123 --comments
gh pr view 123 --json state,title,files  # 機械可読

# 差分
gh pr diff 123

# マージ
gh pr merge 123 --squash --delete-branch
gh pr merge --auto --squash              # 条件満たした時点で自動マージ

# レビュー・承認
gh pr review 123 --approve
gh pr review 123 --request-changes --body "..."

# チェックアウト
gh pr checkout 123

# コメント
gh pr comment 123 --body "..."

# 閉じる / 再開
gh pr close 123
gh pr reopen 123
```

### よく使うフラグ

| フラグ | 意味 |
|---|---|
| `--json <fields>` | JSON 出力（`jq` と組み合わせ必須） |
| `--template <tpl>` | Go template で出力整形 |
| `--web` | ブラウザで開く |
| `-R owner/repo` | 別リポジトリを対象 |

## Issue 操作

```bash
gh issue create --title "bug: ..." --body "..." --label bug
gh issue list --state open --assignee @me
gh issue view 456
gh issue close 456 --reason "not planned"
gh issue comment 456 --body "..."
gh issue develop 456 --branch fix/456    # Issue からブランチ作成
```

## Actions

```bash
# workflow 一覧
gh workflow list

# 手動実行（workflow_dispatch 対応 workflow）
gh workflow run ci.yaml
gh workflow run deploy.yaml -f environment=staging

# 実行履歴
gh run list
gh run list --workflow ci.yaml --branch main
gh run view 123456 --log                 # ログ表示
gh run view 123456 --log-failed          # 失敗ステップのログ

# 再実行
gh run rerun 123456
gh run rerun 123456 --failed             # 失敗ジョブのみ
```

## Release

```bash
# 作成
gh release create v1.0.0 \
  --title "v1.0.0" \
  --notes-file CHANGELOG.md \
  dist/*.tar.gz                          # アセット添付

# 一覧
gh release list

# ダウンロード
gh release download v1.0.0 --pattern "*.tar.gz"

# ドラフト
gh release create v1.1.0 --draft
gh release edit v1.1.0 --draft=false
```

## Secrets / Variables

```bash
# 登録
gh secret set NPM_TOKEN              # 対話で値入力
gh secret set NPM_TOKEN --body "xxx"
echo "xxx" | gh secret set NPM_TOKEN

# Environment 単位
gh secret set DEPLOY_KEY --env production

# Variables（非機密）
gh variable set LOG_LEVEL --body "info"

# 一覧
gh secret list
gh variable list
```

**gh secret set の値はローカル履歴（シェル history）に残らないよう `--body` ではなく stdin 経由推奨**。

## 任意 API 呼び出し

```bash
# REST
gh api repos/org/repo/pulls/123/comments

# GraphQL
gh api graphql -f query='
  query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 10, states: OPEN) {
        nodes { number title }
      }
    }
  }
' -F owner=ozzy-labs -F repo=knowledge-mcp-server

# ページング
gh api --paginate repos/org/repo/issues

# メソッド指定
gh api -X POST repos/org/repo/issues -f title="..." -f body="..."
```

`gh api` は認証・ホスト・ページング・エラーハンドリングを自動で処理するため、直接 `curl` を叩くより格段に便利。

## JSON 出力と jq

```bash
# 直接フィールド指定
gh pr list --json number,title,author --jq '.[] | "\(.number) \(.title)"'

# jq で整形
gh pr list --json number,title | jq -r '.[] | "#\(.number) \(.title)"'

# 条件絞り込み
gh pr list --json number,title,labels \
  | jq '.[] | select(.labels | map(.name) | contains(["bug"]))'
```

`gh` は内蔵 `--jq` フィルタを持つので、単純な抽出なら `jq` コマンド呼び出し不要。

## エイリアス

```bash
# PR の自分用ショートカット
gh alias set prs 'pr list --author @me'
gh alias set prv 'pr view --web'

# シェル展開も可能
gh alias set bugs 'issue list --label "bug"'

# shell 経由の複雑なもの
gh alias set --shell pr-stats 'gh pr list --json state | jq "group_by(.state) | map({state: .[0].state, count: length})"'

gh alias list
```

## CI での使い方

```yaml
# GitHub Actions 内で gh を直接使う
- run: gh pr comment ${{ github.event.pull_request.number }} --body "Build passed"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_TOKEN` が自動で使える（Actions ランナーに gh プリインストール）。

## 拡張

`gh extension` で外部拡張を追加できる:

```bash
gh extension install dlvhdr/gh-dash    # PR/Issue ダッシュボード TUI
gh extension install github/gh-copilot # Copilot in CLI
gh extension list
gh extension upgrade --all
```

## Claude Code / MCP との連携

Claude Code 等のエージェントは `gh` 経由で GitHub 操作を行うよう設計されているものが多い。理由:

- 認証・レート制御を gh が担保
- 直接 API 叩くより誤設定が少ない
- `--json` で機械可読出力が取れる

特に PR 作成・レビュー・マージは gh 経由が安定。

## トラブルシュート

### `GH_TOKEN` と `GITHUB_TOKEN` が混在して期待と違う挙動

`GH_TOKEN` が優先される。片方だけに絞るか、`gh auth status` で有効トークンを確認。

### `gh api` で 403 が出る

- Token のスコープ不足（`repo` / `write:packages` 等）
- PR のチェック要件を満たしていない（merge 系）
- GHES で `GH_HOST` 未設定

### CI で `resource not accessible by integration`

`permissions:` が足りない。workflow の先頭で:

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

### HTTPS vs SSH 認証の混在

`gh auth login` で HTTPS を選ぶと `git push` も HTTPS で `GH_TOKEN` 経由になる。SSH 鍵運用を崩したくない場合は `gh auth login --git-protocol ssh` を選ぶ。

## 他ツールとの比較

| 観点 | gh | hub | curl + API |
|---|---|---|---|
| メンテ | GitHub 公式・活発 | 非推奨（hub は後継 gh に一本化） | — |
| 認証 | 対話 + env + SSH 統合 | token ベース | 手動 |
| GraphQL | 対応 | なし | 手動 |
| Actions 操作 | あり | なし | 手動 |
| ページング | `--paginate` | 手動 | 手動 |
| JSON 出力 | `--json` + `--jq` | なし | 手動 |

gh 一択。hub は 2020 年から非推奨、保守終了。
