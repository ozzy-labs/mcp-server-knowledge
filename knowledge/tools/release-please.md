---
reviewed: 2026-04-18
---

# release-please

Google が開発するリリース自動化ツール。Conventional Commits の履歴から次のバージョンを決定し、`CHANGELOG.md` と `package.json` 等を更新した **単一の「Release PR」** を常に最新に保つ。Release PR をマージすると GitHub Release と Git タグが作成される。`standards/conventional-commits.md` + `standards/semver.md` + `tools/commitlint.md` と四点セットで使うのが定番。

公式: [googleapis/release-please](https://github.com/googleapis/release-please) ・ [googleapis/release-please-action](https://github.com/googleapis/release-please-action)

> **注意**: かつての `google-github-actions/release-please-action` はアーカイブ済み。現在は `googleapis/release-please-action` を使う。

## 動作モデル

1. 開発者が `main` に Conventional Commits 形式でマージする
2. Actions が `main` の更新を検知し、前回リリース以降のコミットを解析
3. 次のバージョンを算出し、`CHANGELOG.md` を追記した Release PR を作成／更新（常に 1 本）
4. Release PR をマージすると Git タグと GitHub Release が作られる

**npm publish などレジストリ公開はしない**。公開ジョブは `release_created` 出力で分岐させる。

## 最小ワークフロー

```yaml
# .github/workflows/release-please.yaml
on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

      - if: ${{ steps.release.outputs.release_created }}
        uses: actions/checkout@v5
      - if: ${{ steps.release.outputs.release_created }}
        run: pnpm publish --no-git-checks
```

2026-04 時点の現行 major は `release-please-action@v4`（内部の release-please ライブラリは 17.x 系）。

## `release-please-config.json`

単一パッケージ:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "initial-version": "0.1.0",
      "bump-minor-pre-major": true,
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" }
      ]
    }
  }
}
```

pnpm workspaces のモノレポ:

```json
{
  "packages": {
    "packages/cli": { "release-type": "node" },
    "packages/core": { "release-type": "node" }
  },
  "plugins": ["node-workspace"]
}
```

### 主要フィールド

| フィールド | 説明 |
|---|---|
| `release-type` | `node` / `python` / `go` / `rust` / `simple` など |
| `bump-minor-pre-major` | `0.x` 中に `feat` を MINOR 扱いする（既定は PATCH） |
| `bump-patch-for-minor-pre-major` | `0.x` 中の MINOR を PATCH 扱いする |
| `initial-version` | 最初のリリースバージョン |
| `changelog-sections` | コミット type → CHANGELOG 見出しのマッピング |
| `changelog-path` | CHANGELOG の出力先（既定 `CHANGELOG.md`） |
| `include-commit-authors` | PR 作者を CHANGELOG に含める |
| `draft` / `prerelease` | リリース扱いの調整 |
| `packages` | パッケージごとのパス → 個別設定 |
| `plugins` | `node-workspace` / `cargo-workspace` / `linked-versions` 等 |

全フィールドは [customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md) に記載。

## `.release-please-manifest.json`

パッケージパス → 現在バージョンの JSON。Release PR がマージされるたびに自動更新される。初期化時は空 `{}` でも、既存バージョンを手動で書いてもよい。

```json
{
  ".": "0.2.0"
}
```

## よく使うコミット type と CHANGELOG

既定のセクション分け（設定なしでも）:

| type | SemVer 影響 | CHANGELOG |
|---|---|---|
| `feat` | MINOR（`0.x` 時は PATCH、上記フラグで MINOR） | Features |
| `fix` | PATCH | Bug Fixes |
| `perf` | PATCH | — （`changelog-sections` で明示） |
| `docs` / `chore` / `refactor` / `test` / `ci` / `build` | 無し | 非表示 |
| `feat!` / `BREAKING CHANGE:` | MAJOR（`0.x` は MINOR） | Breaking Changes |

## AI エージェントがよくやるミス

1. **`permissions` を書き忘れて Release PR が作れない** — `contents: write` と `pull-requests: write` が必須。
2. **Release PR のマージで他ワークフローが発火しないのを忘れる** — `GITHUB_TOKEN` で作られたタグは downstream CI をトリガしない。publish を回したい場合は GitHub App トークンまたは PAT を `token:` に渡す。
3. **`bump-minor-pre-major` を未設定で `0.x` が永久 PATCH** — 公開前プロジェクトでは通常 `true` にする。
4. **`node-workspace` プラグイン無しで内部依存が更新されない** — pnpm/yarn workspaces なら必須。Cargo は `cargo-workspace`。
5. **`release-please-config.json` を置いたのに反映されない** — v4 のデフォルトは manifest モード。`config-file` / `manifest-file` 両方の指定を確認する。

## 他ツールとの比較

| ツール | 特徴 |
|---|---|
| release-please | Release PR 方式。**次の**リリース候補が常に 1 本の PR で可視化 |
| semantic-release | タグ即発行。コミット直後にリリース発行、人間レビューは入らない |
| changesets | PR 単位で「変更記録ファイル」を足す。pnpm workspaces で人気 |
| release-it | 手動起動のインタラクティブ CLI |

Release PR モデルは「**リリースの事前レビュー可能性**」が強み。tag-and-publish を自動化しすぎたくないチームに向く。

## 参考

- [release-please リポジトリ](https://github.com/googleapis/release-please)
- [release-please-action](https://github.com/googleapis/release-please-action)
- [Manifest Releaser Docs](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [Customizing Releases](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)
