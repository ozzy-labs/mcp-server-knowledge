---
reviewed: 2026-05-05
tags: [github, package, security]
---

# Dependabot

GitHub ネイティブの依存追随ツール。`dependabot.yaml` を置くだけで脆弱性アラートとバージョン更新 PR を自動化する。zero-config・GitHub 統合が強み。Renovate と比べ表現力では劣るが、設定の手軽さで選ばれる。

公式: [About Dependabot](https://docs.github.com/en/code-security/dependabot)

関連記事:

- [`tools/renovate.md`](../../tools/renovate.md)（高機能な代替）
- [`platforms/github/github-actions.md`](github-actions.md)（GitHub Actions の依存も Dependabot で更新できる）

## 3 種類の Dependabot

| 名称 | 何をする | 設定 |
|---|---|---|
| **Dependabot alerts** | 既知脆弱性のあるパッケージを検知して通知 | リポジトリ設定で有効化（無料） |
| **Dependabot security updates** | alerts に基づき脆弱性修正 PR を自動作成 | 同上 |
| **Dependabot version updates** | 通常のバージョン追随 PR を作成 | `.github/dependabot.yaml` が必要 |

最初の 2 つは設定ファイル不要（`Settings > Code security` でスイッチ ON）。3 つ目（version updates）が `dependabot.yaml` のスコープ。

## 最小設定

```yaml
# .github/dependabot.yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

`github-actions` ecosystem を**必ず追加する**。workflow の `uses:` ピンを追随しないと、3 で言及したセキュリティ運用が崩れる。

## サポート ecosystem（抜粋）

| `package-ecosystem` | 対象 |
|---|---|
| `npm` | npm / pnpm / yarn |
| `pip` | Python（requirements.txt, pyproject.toml） |
| `uv` | uv の lock |
| `cargo` | Rust |
| `gomod` | Go |
| `gradle` / `maven` | JVM |
| `composer` | PHP |
| `bundler` | Ruby |
| `docker` | Dockerfile |
| `github-actions` | `.github/workflows/*.yaml`、composite action |
| `terraform` | Terraform |
| `devcontainers` | dev container |
| `mix` | Elixir |
| `nuget` | .NET |
| `swift` | Swift |

## 主要オプション

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
      timezone: Asia/Tokyo
    open-pull-requests-limit: 10        # 同時 PR 数（デフォルト 5）
    target-branch: develop              # マージ先（デフォルト: default branch）
    versioning-strategy: increase       # 制約の更新方法
    labels: [dependencies]
    reviewers: [your-org/maintainers]
    assignees: [your-username]
    commit-message:
      prefix: chore                     # Conventional Commits prefix
      include: scope                    # scope に依存名を含める
    cooldown:
      default-days: 7                   # 公開後 7 日経過まで待つ
    ignore:
      - dependency-name: react
        versions: ["19.x"]              # 19 系を無視
      - dependency-name: "@types/*"
        update-types: [version-update:semver-major]    # 型定義は major 更新を無視
    allow:
      - dependency-type: production     # production のみ
    groups:                             # 関連 dep をまとめて 1 PR に
      types:
        patterns: ["@types/*"]
        update-types: [minor, patch]
      eslint:
        patterns: ["eslint", "eslint-*", "@typescript-eslint/*"]
```

## グループ化（複数 dep を 1 PR にまとめる）

PR ノイズが多すぎる場合の主要対策。`groups:` で論理グループ単位の PR にまとめる:

```yaml
groups:
  minor-and-patch:
    update-types: [minor, patch]      # major は個別 PR、minor/patch はまとめて
  testing:
    patterns: ["vitest", "@vitest/*", "playwright*"]
```

## `cooldown`（公開直後の更新を遅らせる）

新リリース直後は隠れた regression が混入しがち。`cooldown` で N 日置く:

```yaml
cooldown:
  default-days: 7
  semver-major-days: 14
  semver-minor-days: 7
  semver-patch-days: 3
```

## Conventional Commits 連携

```yaml
commit-message:
  prefix: chore
  prefix-development: chore           # devDependencies は別 prefix も可
  include: scope                      # → "chore(deps): bump react from 19.0.0 to 19.0.1"
```

`commitlint` と組み合わせる場合、prefix が type と一致するように設定する（[`tools/commitlint.md`](../../tools/commitlint.md)）。

## Renovate との比較

| 観点 | Dependabot | Renovate |
|---|---|---|
| 設定 | `dependabot.yaml`（GitHub native） | `renovate.json`（self-hosted or GitHub App） |
| 設定表現力 | 中 | **高**（regex manager, packageRules, presets） |
| グループ化 | あり（`groups:`） | あり（より柔軟） |
| 自動マージ | なし（GitHub Auto-merge と組み合わせ） | あり（`automerge: true`） |
| Lock file maintenance | 限定的 | あり |
| 利用料 | 無料 | 無料（OSS）/ 有料 SaaS |
| 適性 | GitHub に閉じた小〜中規模 | マルチエコシステム・複雑な戦略 |

両方走らせない（PR が二重になる）。一般的には:

- **シンプル運用 / GitHub native 嗜好** → Dependabot
- **モノレポ / 高度な戦略 / 自動マージ** → Renovate

## Auto-merge と組み合わせる

Dependabot 自体は auto-merge 機能を持たない。GitHub の Auto-merge + workflow で実現する:

```yaml
# .github/workflows/dependabot-automerge.yaml
name: Dependabot auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  automerge:
    if: github.actor == 'dependabot[bot]'
    runs-on: ubuntu-latest
    steps:
      - id: meta
        uses: dependabot/fetch-metadata@v2
      - if: steps.meta.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`update-type` で patch のみ自動マージするのが安全な落としどころ。

## AI エージェントがよくやるミス

1. **`github-actions` ecosystem を入れ忘れる** — workflow の SHA pin が古いまま放置される
2. **`open-pull-requests-limit` を上げすぎて PR 爆発させる** — レビュー追従不能。デフォルト 5 か `groups:` で集約
3. **`ignore:` で major 全体を無視するつもりが書式ミスで効かない** — `versions: [">=19"]` のように semver 範囲で書く
4. **Dependabot の commit が commitlint で reject される** — `commit-message.prefix` を Conventional Commits の type に合わせる
5. **Renovate と Dependabot を同時に走らせる** — 同一 dep に対して 2 つの PR が立つ。片方を必ず無効化

## 参考

- [About Dependabot](https://docs.github.com/en/code-security/dependabot)
- [Configuration options for the dependabot.yml file](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuration-options-for-the-dependabot.yml-file)
- [Automating Dependabot with GitHub Actions](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/automating-dependabot-with-github-actions)
