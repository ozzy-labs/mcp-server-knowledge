---
reviewed: 2026-05-02
---

# npm Trusted Publishers (OIDC publishing)

CI から npm レジストリへ **長寿命 secret (`NPM_TOKEN`) を持たずに publish する** 仕組み。GitHub Actions の OIDC token を npm が信頼することで、トークン管理コストとローテーション運用を消す。2024 年に GA、現在は GitHub Actions / GitLab CI で利用可能。

公式: [docs.npmjs.com — Trusted Publishers](https://docs.npmjs.com/trusted-publishers)

## なぜ `NPM_TOKEN` を避けるか

| 項目 | `NPM_TOKEN` (legacy) | Trusted Publishers (OIDC) |
| --- | --- | --- |
| 認証方式 | repo secret に長寿命トークン | OIDC token を都度発行 |
| 漏洩リスク | secret 抽出されると 90 日 ~ 無期限で publish 可 | token は数分で失効 |
| ローテーション | 定期更新が運用負担 | 不要 |
| provenance attestation | 別途 OIDC 必要 | 同一フローで自動付与 |
| 推奨度 | 既存 repo の互換維持のみ | **新規・既存とも推奨** |

`NPM_TOKEN` 自体は廃止されていないが、新規プロジェクトで導入する積極的理由は無い。

## 設定手順 (GitHub Actions)

### 1. npmjs.com 側で Trusted Publisher を登録

1. パッケージページ → Settings → Publishing
2. Add Trusted Publisher → GitHub Actions を選択
3. 以下を入力:
   - Organization or User: `ozzy-labs`
   - Repository: `road`
   - Workflow filename: `release.yaml`
   - Environment name (任意): `npm-publish`

組織 (`@scope/`) の各パッケージごとに設定が必要。scoped package が複数あるなら全部に紐付ける。

### 2. GitHub Actions 側 — workflow YAML

```yaml
name: Release

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  id-token: write   # OIDC token を取得するために必須

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-publish   # npmjs.com 側の environment 設定と一致させる
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile

      - run: pnpm -r build

      # --provenance で attestation を発行 + OIDC で認証
      - run: pnpm -r publish --access public --provenance --no-git-checks
```

### 3. 必須: `permissions: id-token: write`

これが無いと OIDC token が取れず Trusted Publisher が動かない。`actions/checkout` 等で書き込みが必要なら `contents: write` も別途付ける。

## provenance attestation

`--provenance` を付けると、npm は publish 時に以下を**改ざん不可な形で記録**:

- どの commit から build されたか (`source.commit`)
- どの workflow run が publish したか (`buildConfig.runId`)
- build 環境 (runner OS / commit hash)

ユーザーは `npm view <pkg> dist.attestations` で確認可能。Sigstore + GitHub OIDC の組み合わせで supply chain attack 検知の標準になっている。

## pnpm / yarn での publish

pnpm は `--provenance` flag を v9 から正式サポート (`pnpm publish --provenance`)。yarn berry は `yarn npm publish --provenance`。npm CLI は v9.5+ で対応 (`npm publish --provenance`)。

## 既存 `NPM_TOKEN` プロジェクトの移行

1. npmjs.com で Trusted Publisher を登録 (上記手順 1)
2. workflow YAML を更新 — `permissions: id-token: write` を追加
3. `npm publish` の `--//registry.npmjs.org/:_authToken=${NPM_TOKEN}` 系の認証行を削除 (setup-node が registry-url で URL を設定すれば不要)
4. 1 回 dry-run で動作確認 (`--dry-run`)
5. `NPM_TOKEN` を repo secret から削除
6. organization 全体 secret から外す場合は監査時間を取って慎重に

最初の publish 時に「Trusted Publisher の設定が見つからない」エラーが出たら、npmjs.com の設定とワークフローパスが一致していない (workflow filename / environment name のタイポが多い)。

## release-please / changesets との組合せ

両ツールとも publish 自体は触らないので、Release PR がマージされた後 `release-please --publish` / `changesets/action` の `publish` step に上記 YAML を組み込めば共存できる。例:

```yaml
- uses: changesets/action@v1
  with:
    publish: pnpm -r publish --access public --provenance --no-git-checks
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # NPM_TOKEN は不要 — OIDC で認証される
```

## トラブルシューティング

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `403 Forbidden — you don't have permission` | Trusted Publisher 未登録 | npmjs.com 側で repository / workflow filename を確認 |
| `OIDC token not available` | `permissions: id-token: write` 不足 | workflow / job スコープに追加 |
| `cannot find environment 'X'` | environment 名が npm 側と不一致 | npmjs.com 設定とジョブ env 名を一致させる |
| 1 つの monorepo で複数 scoped package | 全パッケージ別々に Trusted Publisher 登録 | `pnpm -r publish` は通る、登録漏れだけ要注意 |

## 関連

- [`tools/release-please.md`](../tools/release-please.md) — Conventional Commits 駆動のリリース PR 自動化
- [`standards/semver.md`](./semver.md) — バージョン番号の決定ルール
- [`standards/conventional-commits.md`](./conventional-commits.md) — コミットメッセージから version bump を導出
- [`platforms/github-actions.md`](../platforms/github-actions.md) — workflow / OIDC の基盤
