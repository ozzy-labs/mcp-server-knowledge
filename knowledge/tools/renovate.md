# Renovate

依存関係を自動で最新に保つボット。PR を作って更新を提案し、CI が通れば自動マージまで可能。Dependabot より設定の自由度と対応エコシステムが広い。Mend が開発・運用。

公式: [docs.renovatebot.com](https://docs.renovatebot.com/)

## 導入方法

### GitHub

1. [Renovate GitHub App](https://github.com/apps/renovate) をインストール
2. 対象リポジトリで有効化
3. 初回は「Configure Renovate」Onboarding PR が作られる。マージすると運用開始
4. リポジトリに `renovate.json` を置いて設定を調整

### セルフホスト

```bash
# GitHub Actions で定期実行
pnpm dlx renovate

# Docker
docker run --rm -e RENOVATE_TOKEN=xxx renovate/renovate
```

CLI / CI 実行モードもあるが、GitHub App モードが最も手軽。

## 設定ファイル `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended"]
}
```

最小構成は 1 行。`config:recommended` が実用的なデフォルトを提供する。

### 組織で共有

```json
{ "extends": ["github>ozzy-labs/.github"] }
```

`.github` リポジトリに `default.json` を置けば、組織全リポジトリで共通設定を共有できる。

## 主要フィールド

| フィールド | 説明 |
|---|---|
| `extends` | プリセット継承（`config:recommended` / `:semanticCommits` 等） |
| `schedule` | 実行時間帯（`["every weekend"]`, `["before 6am"]`） |
| `timezone` | `"Asia/Tokyo"` |
| `labels` | PR に付ける GitHub ラベル |
| `reviewers` / `assignees` | PR 受け持ち |
| `prConcurrentLimit` | 同時オープン PR 数の上限 |
| `prHourlyLimit` | 時間あたり PR 作成上限 |
| `rangeStrategy` | `pin` / `bump` / `replace` / `update-lockfile` |
| `packageRules` | パッケージ別の細かい設定 |
| `automerge` | 条件一致なら自動マージ |
| `dependencyDashboard` | Issue ベースのダッシュボード |

## `packageRules` の例

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["minor", "patch"],
      "matchCurrentVersion": "!/^0/",
      "automerge": true
    },
    {
      "matchDepTypes": ["devDependencies"],
      "groupName": "dev dependencies",
      "schedule": ["before 6am on monday"]
    },
    {
      "matchPackagePatterns": ["^@types/"],
      "groupName": "type definitions",
      "automerge": true
    },
    {
      "matchUpdateTypes": ["major"],
      "dependencyDashboardApproval": true
    }
  ]
}
```

典型パターン:

- **patch / minor は自動マージ**（開発依存・型定義は特に）
- **major は手動承認**（breaking change 可能性）
- **0.x 系は minor も保守的に**（破壊的変更の余地）
- **グルーピング**: 関連パッケージをまとめて 1 PR に

## 対応エコシステム

主要なもの（抜粋）:

| エコシステム | 対応ファイル |
|---|---|
| npm / pnpm / yarn | `package.json`, lock files |
| Go modules | `go.mod` |
| Python | `requirements.txt`, `pyproject.toml`, `Pipfile` |
| Rust | `Cargo.toml` |
| Docker | `Dockerfile`, `docker-compose.yml` |
| GitHub Actions | `.github/workflows/*.yaml` |
| pre-commit | `.pre-commit-config.yaml` |
| mise / asdf | `.mise.toml`, `.tool-versions` |
| Terraform | `*.tf` |
| Kubernetes | `*.yaml` (image 参照) |

100 超のマネージャに対応。詳細は [公式の managers](https://docs.renovatebot.com/modules/manager/)。

## 自動マージの条件設計

```json
{
  "packageRules": [
    {
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr",
      "platformAutomerge": true
    }
  ]
}
```

- `automerge: true`: 自動マージを有効化
- `platformAutomerge: true`: GitHub の auto-merge 機能を使う（CI 完了後に merge）
- `automergeType`: `pr` / `branch` / `merge-commit`

**必須条件**: branch protection で「Required status checks」を設定していること。CI が通らない限り自動マージされない。

## よくあるプリセット

| プリセット | 内容 |
|---|---|
| `config:recommended` | 実用的なデフォルト一式 |
| `config:base` | 旧推奨（最小限、非推奨化） |
| `:semanticCommits` | コミットメッセージを Conventional Commits 形式に |
| `:timezone(Asia/Tokyo)` | タイムゾーン設定 |
| `group:monorepos` | 同じ monorepo 由来のパッケージをまとめる |
| `group:recommended` | 推奨のグループ化セット |
| `schedule:weekly` | 週 1 実行 |

## Dependency Dashboard

`dependencyDashboard: true` を有効にすると、リポジトリに 1 つの Issue が立ち、保留中・失敗・待機中の更新が一覧化される。

```markdown
## Pending Approval
- [ ] [react 18 -> 19](../pull/123)  # major なので承認待ち

## Ignored or Blocked
- [ ] [typescript] Failed to update due to lockfile conflict

## Detected dependencies
<!-- 全検出依存の一覧 -->
```

チェックボックスを触ると Renovate に指示を送れる（再実行、優先度変更等）。

## セキュリティ更新の優先度

`vulnerabilityAlerts.enabled: true` で GitHub Security Advisories と連動。該当 CVE が出ると他の更新より優先して PR を作成する。

```json
{
  "vulnerabilityAlerts": {
    "labels": ["security"],
    "automerge": true
  }
}
```

## トラブルシュート

### PR が大量に来る

- `prConcurrentLimit: 5` で同時 5 件に制限
- `prHourlyLimit: 2` で時間あたり 2 件に制限
- `schedule` で夜間・週末に集中
- `packageRules` の `groupName` でまとめる

### lockfile 更新が含まれない

`rangeStrategy: "update-lockfile"` を設定。pnpm なら `postUpdateOptions: ["pnpmDedupe"]` で重複解消も。

### monorepo で同じパッケージが複数更新される

`:group:monorepos` プリセットを追加、または `packageRules.matchPackagePatterns` + `groupName` で手動グルーピング。

### 自動マージが動かない

1. branch protection の status check 要件を確認
2. `platformAutomerge` が有効か
3. PR 作成者（`renovate[bot]`）に write 権限があるか
4. conflict のある PR は自動マージ不可

### 不要な更新を止める

```json
{
  "packageRules": [
    { "matchPackageNames": ["eslint"], "enabled": false }
  ]
}
```

## 他ツールとの比較

| 観点 | Renovate | Dependabot | RenovateCE (self-host) |
|---|---|---|---|
| 対応エコシステム | 100+ | 30 程度 | 100+ |
| 設定の柔軟性 | 高 | 中 | 高 |
| 自動マージ | あり | あり（GitHub） | あり |
| グルーピング | 自由 | 限定的 | 自由 |
| 運用コスト | GitHub App（無料） | 無料（GitHub 標準） | 自前ホスト |
| PR ダッシュボード | あり | なし | あり |

OSS / SaaS 両方のプロジェクトで Renovate が事実上の標準。Dependabot は GitHub ネイティブだが設定の自由度で劣る。
