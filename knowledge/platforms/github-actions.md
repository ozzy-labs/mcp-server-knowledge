---
reviewed: 2026-04-18
---

# GitHub Actions

GitHub ネイティブの CI/CD プラットフォーム。ワークフローを YAML で定義し、リポジトリへのイベント（push, PR, schedule 等）に応じて実行する。`gh` CLI と並んで GitHub 運用の中核。

公式: [docs.github.com/actions](https://docs.github.com/en/actions)

## ワークフローの最小形

`.github/workflows/ci.yaml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
```

ファイルは必ず `.github/workflows/` 配下。ブランチごとの workflow も可能だが、`main` にある状態がデフォルトの定義として使われる。

## トリガー（`on`）

| イベント | 説明 |
|---|---|
| `push` | ブランチ・タグへの push |
| `pull_request` | PR の open / sync / labeled 等 |
| `schedule` | cron 形式（UTC） |
| `workflow_dispatch` | 手動実行（UI や API から） |
| `workflow_call` | 他 workflow から呼び出し（再利用） |
| `repository_dispatch` | 外部 API からの呼び出し |
| `release` | リリース作成時 |
| `issues` / `issue_comment` / `pull_request_review` | 会話系イベント |

```yaml
on:
  push:
    branches: [main]
    paths: ["src/**", "package.json"]    # 特定パス変更時のみ
  schedule:
    - cron: "0 6 * * 1"                  # 毎週月曜 06:00 UTC
  workflow_dispatch:
    inputs:
      environment:
        description: "Target env"
        required: true
        default: "staging"
```

## Job と Step

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm biome ci

  test:
    runs-on: ubuntu-latest
    needs: lint                       # lint 成功後に実行
    strategy:
      matrix:
        node: [20, 22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm run test
```

| 概念 | 説明 |
|---|---|
| `jobs.<id>.runs-on` | ランナー種別（`ubuntu-latest` / `macos-latest` / `windows-latest` / self-hosted） |
| `needs` | 依存（完了後に実行） |
| `strategy.matrix` | 組み合わせ並列実行 |
| `steps` | `uses`（action 呼び出し） or `run`（シェル実行） |
| `if` | 条件実行（`${{ github.event_name == 'push' }}` 等） |

## 主要な公式 / 準公式 Action

| Action | 用途 |
|---|---|
| `actions/checkout@v4` | リポジトリ取得（必須） |
| `actions/setup-node@v4` | Node セットアップ + キャッシュ |
| `pnpm/action-setup@v4` | pnpm インストール |
| `actions/setup-python@v5` | Python |
| `actions/setup-go@v5` | Go |
| `actions/cache@v4` | 汎用キャッシュ |
| `actions/upload-artifact@v4` / `download-artifact@v4` | Job 間のファイル受け渡し |
| `actions/github-script@v7` | GitHub API を Node で叩く |
| `softprops/action-gh-release@v2` | リリース作成 |
| `jdx/mise-action@v2` | mise 経由でツールインストール |

バージョンは**メジャー固定 + パッチ追従**（`@v4`）が一般的。完全固定（SHA）が最もセキュアだが更新負荷が高い。

## シークレットと変数

### Secrets

```yaml
steps:
  - run: ./deploy.sh
    env:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

`Settings > Secrets and variables > Actions` で登録。**ログに出ると自動マスクされる**が、意図的な出力でも一部漏れ得るので `echo "$TOKEN"` は避ける。

### Variables

非機密の設定値は Variables に（`${{ vars.ENV_NAME }}`）。

### Environment

```yaml
jobs:
  deploy:
    environment: production
    steps: [...]
```

Environment ごとに secrets/vars を分離 + approve ゲートを設置できる（production デプロイで必須）。

## GITHUB_TOKEN

各 job で自動発行される一時トークン。リポジトリへの limited な権限を持つ。デフォルトは read-only（組織設定による）。

```yaml
permissions:
  contents: write     # コミット・タグ作成
  pull-requests: write
  issues: write
```

**最小権限原則**: 必要なスコープだけ明示的に付与する。

## 並列実行とキャッシュ

### キャッシュ

```yaml
- uses: actions/setup-node@v4
  with:
    cache: pnpm                       # 組み込みキャッシュ

# 汎用キャッシュ
- uses: actions/cache@v4
  with:
    path: ~/.cache/pnpm
    key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

`setup-node` の `cache: pnpm` を使えば多くの場合 `actions/cache` は不要。

### Concurrency

同じ PR に複数 push した際、古い実行をキャンセル:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## 再利用可能 workflow

```yaml
# .github/workflows/reusable-test.yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "24"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: pnpm run test

# 呼び出し側
jobs:
  test-20:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "20"
  test-24:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "24"
```

組織共通の workflow は `org/.github` リポジトリに置いて `uses: org/.github/.github/workflows/foo.yaml@main` で参照できる。

## Composite Action

複数ステップを 1 action にまとめて再利用:

```yaml
# .github/actions/setup/action.yaml
name: setup
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v4
      with: { version: 10 }
    - uses: actions/setup-node@v4
      with:
        node-version: 24
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash

# 呼び出し
- uses: ./.github/actions/setup
```

## gh CLI との連携

```yaml
- run: gh pr comment ${{ github.event.pull_request.number }} --body "CI completed"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

gh は `GH_TOKEN` で認証可能。ローカル開発と同じコマンドが CI でも動く。

## セキュリティベストプラクティス

1. **`permissions:` を明示**: デフォルト権限に頼らず最小権限
2. **サードパーティ action は SHA 固定**: `uses: some/action@e83ad4c...`（タグは書き換え可能）
3. **`pull_request_target` の取り扱い注意**: フォーク PR の内容が write 権限で動く危険イベント
4. **secrets を echo しない**: ログに漏らさない
5. **依存を Renovate / Dependabot で追随**: 脆弱な古い action を放置しない
6. **`gitleaks` / `trivy` を CI に組み込む**: コミット前のシークレット・脆弱性チェック

## よく使う context 変数

| 変数 | 意味 |
|---|---|
| `${{ github.event_name }}` | トリガー名 |
| `${{ github.ref }}` | `refs/heads/<branch>` or `refs/tags/<tag>` |
| `${{ github.ref_name }}` | ブランチ/タグ名のみ |
| `${{ github.sha }}` | コミット SHA |
| `${{ github.actor }}` | 実行者 |
| `${{ github.workspace }}` | チェックアウトディレクトリ |
| `${{ runner.os }}` | `Linux` / `macOS` / `Windows` |
| `${{ secrets.<NAME> }}` | secret 参照 |
| `${{ vars.<NAME> }}` | variable 参照 |
| `${{ steps.<id>.outputs.<name> }}` | 前ステップの出力 |

## ステップ間データ受け渡し

```yaml
steps:
  - id: meta
    run: echo "version=$(cat VERSION)" >> "$GITHUB_OUTPUT"

  - run: echo "Version is ${{ steps.meta.outputs.version }}"
```

`$GITHUB_OUTPUT` ファイルに `name=value` 形式で追記。

## トラブルシュート

### `Resource not accessible by integration`

`permissions:` が足りない。エラーメッセージが要求する scope を追加。

### ビルドが毎回遅い

キャッシュが効いていない。`setup-node` の `cache: pnpm` を確認。`actions/cache` の `key` がロックファイルの hash を含んでいるか。

### 外部 action が非推奨になった

Renovate で自動更新するか、`actions/*` シリーズの公式版に移行（例: `actions/setup-node@v4` は cache 機能も内蔵）。

### `pull_request` でチェックが走らない

マージ元が初心者の PR だとワークフローが「承認」されるまで走らない（org 設定次第）。`Settings > Actions > Fork pull request workflows` を確認。

### matrix で特定組み合わせだけ除外

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node: [20, 22, 24]
    exclude:
      - os: windows-latest
        node: 20
```

## 他 CI との比較

| 観点 | GitHub Actions | GitLab CI | CircleCI |
|---|---|---|---|
| 設定 | YAML（多ファイル可） | YAML（基本 1 ファイル） | YAML |
| GitHub 連携 | ネイティブ | GitHub app | GitHub app |
| 無料枠 | 2,000 分/月（public 無制限） | 400 分/月 | 6,000 クレジット/月 |
| self-hosted | あり | あり | あり |
| 再利用 | reusable / composite | include | orbs |
| OIDC | あり（AWS/GCP/Azure） | あり | あり |

GitHub に閉じた運用では Actions がデフォルト選択。
