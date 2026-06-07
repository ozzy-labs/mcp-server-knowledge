---
reviewed: 2026-06-07
tags: [release, security, npm, github]
---

# npm Trusted Publishers (OIDC publishing)

CI から npm レジストリへ **長寿命 secret (`NPM_TOKEN`) を持たずに publish する** 仕組み。CI 側で発行された OIDC token を npm が信頼することで、トークン管理コストとローテーション運用を消す。2024 年に GA。2026-05 時点で対応している CI は **GitHub Actions / GitLab CI/CD / CircleCI**（いずれもクラウドホスト ランナー）。**self-hosted runner は未対応**（将来対応予定）。

要件 (publisher 別):

| Publisher | 最低バージョン | provenance support |
|---|---|---|
| `npm publish` | npm CLI **v11.5.1+** / Node.js **v22.14.0+** | v11.5.1+ で `--provenance` |
| `pnpm publish` (推奨) | pnpm **v9.5+** / Node.js v22.14.0+ | v9.5+ で `--provenance` 正式サポート (v9.0-v9.4 は silent fail のリスクあり、必ず v9.5 以上に固定すること) |
| `yarn npm publish` | yarn berry **v4.0+** / Node.js v22.14.0+ | v4.0+ で `--provenance` |

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
   - Organization or User: `your-org`
   - Repository: `my-repo`
   - Workflow filename: `release.yaml`
   - Environment name (任意): `npm-publish`

組織 (`@scope/`) の各パッケージごとに設定が必要。scoped package が複数あるなら全部に紐付ける。**1 パッケージにつき設定できる Trusted Publisher は 1 つ**（複数の workflow / repo を同時登録は不可）。

### 2. trigger パターンの選び方

publish workflow の trigger には大別して 2 パターンある。どちらも妥当で、リポの運用粒度で選ぶ。

#### パターン A: `on: push: tags: ['v*']` (publish 単独 workflow)

publish job を独立 workflow (`publish.yaml`) に置き、tag push で発火させる。release-please / changesets 等の release ツールは別 workflow (`release-please.yaml`) に分離。

```yaml
# .github/workflows/publish.yaml
name: Publish

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r publish --access public --provenance --no-git-checks
```

**利点**: publish 単独でリトライ可能 (release-please ジョブを空回りさせない)、手動 `workflow_dispatch` で再 publish しやすい。
**欠点**: 手動 tag push (`git push origin v1.2.3` 等) でも publish が走るため、release ツール経由でない tag 発行に対する事故余地。

#### パターン B: `on: push: branches: [main]` + `needs: release-please` (統合 workflow)

`release-please` ジョブと `publish` ジョブを同一 workflow (`release.yaml`) に置き、`needs: release-please` + `if: needs.release-please.outputs.release_created` で release-please がリリースを作成したときのみ publish を発火させる。

```yaml
# .github/workflows/release.yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write
  id-token: write   # OIDC token を取得するために必須

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r publish --access public --provenance --no-git-checks
```

**利点**: release-please がアトミックにゲートする (手動 tag push では publish しない)、single workflow ファイルで保守容易。
**欠点**: publish だけのリトライ不可 (再実行すると release-please ジョブも再実行される)。

#### どちらを選ぶか

| 重視する観点 | 推奨 |
|---|---|
| publish 単独リトライ (npm 側 transient 失敗の救出) | **A** (tags trigger) |
| 手動 tag push 事故の防止 / single workflow 保守 | **B** (branches + needs) |

ozzy-labs では **パターン B (統合)** が多数派 (例: `skills` / `create-agentic-app` / `create-agentic-aws` / `starlight-theme`)。リトライ重視のリポは **パターン A (分離)** を選ぶ (例: `feedradar`)。

### 3. 必須: `permissions: id-token: write`

これが無いと OIDC token が取れず Trusted Publisher が動かない。`actions/checkout` 等で書き込みが必要なら `contents: write` も別途付ける。

### 4. `environment:` は **オプション** (条件付き推奨)

旧版の本 standard は `environment: npm-publish` を無条件で例示していたが、空のまま auto-create された environment で実際に得られるのは限定的:

- ✅ OIDC token に `"environment": "npm-publish"` claim が乗る (npm 側 TP 設定で environment を必須化した場合のみ defense-in-depth として機能)
- ✅ GitHub Deployments タブにエントリ追加 (可視性のみ)

つまり **保護ルールを設定しない `environment:` は "OIDC ラベル + UI 装飾" 止まり**。npm 公式も Environment 欄は **optional** と明記している。

`environment:` を宣言する **正当な理由** は次の 4 つ:

- (a) **Required reviewers**: publish 前に approval ゲートを挟む (`security-team` チームが approve しないと publish させない、等)
- (b) **Wait timer**: publish を一定時間遅延させる (緊急 rollback の余地)
- (c) **Deployment branches/tags 制限**: `main` ブランチや `v*` タグからしか publish できないように strict 制限
- (d) **Environment-scoped secrets**: publish 専用の secret を environment scope で分離 (TP 経路では secret 不要なので通常使わない)

これらのうち 1 つ以上を設定する **意図がある場合のみ** `environment:` を宣言し、対応する保護ルールを npmjs.com 側 TP 設定とセットで構成すること。

**設定しないなら宣言不要**。空 environment の cargo cult 宣言は混乱の元なので避ける。

```yaml
# environment を宣言する例 (Required reviewers + tag 制限を併用)
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-publish   # GitHub 側で Required reviewers + Tags='v*' を別途設定
    # npmjs.com 側 TP 設定でも environment='npm-publish' を Required にする
    steps: ...
```

## provenance attestation

`--provenance` を付けると、npm は publish 時に以下を**改ざん不可な形で記録**:

- どの commit から build されたか (`source.commit`)
- どの workflow run が publish したか (`buildConfig.runId`)
- build 環境 (runner OS / commit hash)

ユーザーは `npm view <pkg> dist.attestations` で確認可能。Sigstore + GitHub OIDC の組み合わせで supply chain attack 検知の標準になっている。

注意点:

- **private repository から publish する場合、パッケージが public でも provenance は付かない**（source link を露出させないため）
- **CircleCI は provenance 未対応**（OIDC 認証は通るが attestation は発行されない）
- OIDC 認証が効くのは `npm publish` のみ。`npm token` 等の他コマンドは従来どおりトークン認証が必要

## pnpm / yarn での publish

冒頭の「要件」表を参照。バージョン pin が重要 (pnpm v9.0-v9.4 では `--provenance` が silent fail するリスクあり)。`actions/setup-node@v5` で Node を指定し、`actions/setup-node` の `pnpm-version` input または事前 `corepack enable && corepack prepare pnpm@9.5.0 --activate` で pnpm バージョンも明示する。

## monorepo / org 運用

### 1 monorepo / 複数 scoped package

`pnpm -r publish` は monorepo 内の全 publishable workspaces を一斉に publish するが、Trusted Publishers の設定は **パッケージ単位** で必要。例えば `@scope/foo` と `@scope/bar` を同一 repo で publish するなら、npmjs.com の Settings → Publishing で **両パッケージそれぞれに同じ TP 設定 (org/repo/workflow filename)** を登録する。

新規 package を monorepo に追加するときは:

1. npmjs.com で対象 package の Settings → Publishing → Add Trusted Publisher
2. Organization / Repository / Workflow filename を既存 package と同じ値で登録
3. (任意) `environment:` を運用する場合は同じ environment 名で登録
4. 初回 publish 前に `pnpm -r publish --dry-run --access public --provenance` で動作確認

### ozzy-labs 運用 (新規 scoped package 追加チェックリスト)

ozzy-labs 配下の新規 `@ozzylabs/*` package を立ち上げるときの順序:

- [ ] **ADR / handbook で公開判断**: そもそも npm publish する必要があるか (内部運用なら publish 不要、`pnpm` workspace 内のみで参照する手もある)
- [ ] **npmjs.com で package を予約 / scope 登録**: `@ozzylabs/<name>` が既に存在しないか確認 (org 全体 settings → Members に publish 権限を確認)
- [ ] **npmjs.com で Trusted Publisher 登録**:
  - Organization: `ozzy-labs`
  - Repository: `ozzy-labs/<repo-name>`
  - Workflow filename: 既存パッケージと同じ (`release.yaml` または `publish.yaml`)
  - Environment: 既存パッケージと同じ運用 (なし、または `npm-publish`)
- [ ] **workflow 配置**: 既存パッケージの release/publish workflow をテンプレートとして配置 (パターン A か B を選ぶ)
- [ ] **dry-run 確認**: 初回 publish 前に `--dry-run` で動作確認
- [ ] **release-please 連携**: `release-please-config.json` / `.release-please-manifest.json` に新 package を登録 (monorepo の場合)
- [ ] **package.json `publishConfig`**: `{ "access": "public", "provenance": true, "registry": "https://registry.npmjs.org/" }` を設定
- [ ] **handbook / README へ追記**: 新 package の存在を ozzy-labs index に反映

### org 全体での publisher 経路統一

ozzy-labs は **pnpm 採用が多数派** (`feedradar` / `create-agentic-app` / `create-agentic-aws` / `skills` / `starlight-theme` 等)。新規パッケージは原則 `pnpm publish --provenance --access public` を使う。`npm publish` は legacy 経路で、新規導入は避ける (npm CLI 経路は `npm install -g npm@latest` の前段が必要で workflow が複雑化する)。

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
| self-hosted runner で `403` | self-hosted runner は Trusted Publisher 未対応 | GitHub-hosted runner で publish job だけ実行する |
| npm CLI が古くて OIDC 認証されない | npm CLI v11.5.1 未満 / Node 22.14.0 未満 | `actions/setup-node@v5` で Node 22.14 以上を指定し `npm i -g npm@latest` |
| 1 つの monorepo で複数 scoped package | 全パッケージ別々に Trusted Publisher 登録 | `pnpm -r publish` は通る、登録漏れだけ要注意 |

## 関連

- [`tools/release-please.md`](../tools/release-please.md) — Conventional Commits 駆動のリリース PR 自動化
- [`standards/semver.md`](./semver.md) — バージョン番号の決定ルール
- [`standards/conventional-commits.md`](./conventional-commits.md) — コミットメッセージから version bump を導出
- [`platforms/github/github-actions.md`](../platforms/github/github-actions.md) — workflow / OIDC の基盤
