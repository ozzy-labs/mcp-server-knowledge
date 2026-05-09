---
reviewed: 2026-05-05
tags: [github, ci]
---

# GitHub Environments

GitHub Actions の **Environments** は、デプロイ先（`production`, `staging` 等）ごとに secrets / variables / 承認ゲートを分離する仕組み。`environment:` を job に付けることで保護ルールが適用される。

公式: [Managing environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment)

関連記事:

- [`platforms/github/github-actions.md`](github-actions.md)
- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md)（OIDC で `environment:` を必須化する典型例）

## 何が解決できるか

| 課題 | Environments で解決 |
|---|---|
| production 用 secret を全 job から見える状態にしたくない | environment-scoped secret として、対象 job にのみ露出 |
| production デプロイは人間承認を挟みたい | Required reviewers |
| `main` ブランチ以外からの production デプロイを禁じたい | Deployment branch policy |
| 本番デプロイ時に 5 分の猶予を入れたい（ロールバック対応） | Wait timer |
| npm publish の OIDC trust policy を環境名で絞りたい | `sub` claim に `environment:production` が含まれる |

## 作成

`Settings > Environments > New environment` から作成。名前は 255 文字以内、case-insensitive、リポジトリ内でユニーク。

## Workflow からの利用

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production           # シンプル形式
    steps:
      - run: ./deploy.sh
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}    # production の secret が解決される
```

URL を持たせる形式（デプロイ先 URL を Job Summary に表示）:

```yaml
environment:
  name: production
  url: https://app.example.com
```

複数 environment を順に通すデプロイは、job を分けて `needs:` で繋ぐ:

```yaml
jobs:
  deploy-staging:
    environment: staging
    steps: [...]
  deploy-prod:
    needs: deploy-staging
    environment: production
    steps: [...]
```

## 保護ルール

### Required reviewers

最大 6 人（または 6 チーム）まで指定。指定者の少なくとも 1 名（または設定した数）が approve するまで job が waiting 状態になる。

- **Self-review の禁止**: workflow を起動した本人が approve できないよう設定可能
- 承認待ち中も他の job は走る（`needs:` で連鎖していなければ）

### Wait timer

最大 43,200 分（30 日）。job 開始前に必ず指定時間待機する。「approve 後 5 分の猶予でロールバックの最終確認」等。

### Deployment branch / tag policies

```text
- Selected branches and tags
  - main
  - release/*
  - tags: v*
```

ワイルドカード（fnmatch）で指定。`Protected branches only` を選ぶと branch protection で保護されているブランチのみが許可される。

### Custom deployment protection rules

GitHub App ベースの拡張保護（外部承認システム連携、変更管理ツール連携等）。サードパーティ App を install して有効化。

### Admin bypass

リポジトリ管理者が保護ルールをスキップできるかのトグル。production では原則 OFF。

## Environment secrets / variables

| スコープ | 参照 | 用途 |
|---|---|---|
| Repository | `${{ secrets.X }}` / `${{ vars.X }}` | 全 job から見える |
| Environment | `${{ secrets.X }}` / `${{ vars.X }}`（環境内 job のみ） | デプロイ先別 |
| Organization | `${{ secrets.X }}` | 複数リポジトリ共通 |

優先順位: **Environment > Repository > Organization**。同名の場合 environment が勝つ。

## OIDC との組み合わせ

OIDC の `sub` claim に environment 名が含まれる:

```text
repo:your-org/my-app:environment:production
```

クラウド側 trust policy で `environment:production` を含む sub のみ許可することで、staging job が production リソースに触れない設計になる:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:sub":
        "repo:your-org/my-app:environment:production"
    }
  }
}
```

npm の Trusted Publishers でも `environment:` を必須化できる。詳細は [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md)。

## デプロイ履歴

GitHub UI の `Deployments` タブで environment 別の履歴を閲覧可能。各 deployment は Active / Inactive 状態を持ち、API でロールバック相当の操作ができる。

## API

```bash
# environment 一覧
gh api repos/:owner/:repo/environments

# protection rules 取得
gh api repos/:owner/:repo/environments/production

# secrets 設定
gh secret set DEPLOY_KEY --env production
```

## AI エージェントがよくやるミス

1. **`environment:` を付け忘れて environment secret が見えないと混乱する** — secret 名を repository scope と思い込みがち。`Settings > Environments > <name> > Environment secrets` で実体を確認
2. **production deploy を `needs:` 抜きで staging と並列実行する** — 段階デプロイの意味が消える。`needs:` で順序を強制
3. **Required reviewers を「全員」にする** — 1 人でも approve できれば進むため、複数指定 = OR の挙動になる。AND が欲しい場合は app ベースの custom rule
4. **OIDC trust policy で environment 名を絞らない** — staging の workflow から production リソースに到達できてしまう
5. **`environment.url` に secret を含む URL を埋め込む** — Job Summary に出るので情報漏洩のリスク

## 参考

- [About environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment)
- [Configuring OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect)
- [Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
