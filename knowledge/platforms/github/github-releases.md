---
reviewed: 2026-05-05
tags: [github, release]
---

# GitHub Releases

Git タグに紐付くリリースアーティファクトと release notes を提供する GitHub の機能。タグを切るだけでなく、ZIP / tarball の自動生成、バイナリ asset の添付、自動生成 release notes、draft / pre-release 管理ができる。

公式: [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

関連記事:

- [`tools/release-please.md`](../../tools/release-please.md)（release notes と PR 駆動の自動化）
- [`standards/semver.md`](../../standards/semver.md)
- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md)（npm publish と組み合わせるパターン）
- [`platforms/github/gh-cli.md`](gh-cli.md#release)

## モデル

```text
Git tag (v1.2.3)  ──紐付け──▶  GitHub Release
                                 ├─ Title / body（release notes）
                                 ├─ Source archive (zip / tarball, 自動生成)
                                 ├─ Assets (binary 等を手動 / CI で添付)
                                 ├─ State: draft / pre-release / latest
                                 └─ Discussion（任意）
```

- 1 タグ = 1 release
- タグが存在しない名前を指定すると、release 公開時にタグが新規作成される
- アーカイブ（`v1.2.3.zip` / `v1.2.3.tar.gz`）はタグから自動生成（手動添付不要）

## 状態（State）

| 状態 | 用途 | 挙動 |
|---|---|---|
| **Draft** | 内部レビュー中 | 公開前。書き込み権限者のみ閲覧可 |
| **Pre-release** | RC / beta | 公開されるが `latest` 扱いにならない |
| **Latest** | 通常リリース | デフォルトで最新表示。1 つのみ |

`/releases/latest` URL は `Latest` フラグが立った release を返す。pre-release は `latest` にならないため、安定版リンクを壊さずに RC を公開できる。

## 自動生成 release notes

`Generate release notes` ボタン、または `gh release create --generate-notes` で、前回タグ以降の merged PR を集約した release notes が生成される。

### `.github/release.yaml` で分類カスタマイズ

```yaml
# .github/release.yaml
changelog:
  exclude:
    labels: [ignore-for-release, dependencies]
    authors: [dependabot, renovate]
  categories:
    - title: Breaking Changes
      labels: [breaking, semver-major]
    - title: New Features
      labels: [feat, feature]
    - title: Bug Fixes
      labels: [fix, bug]
    - title: Documentation
      labels: [docs]
    - title: Other Changes
      labels: ["*"]                  # 残り全部のキャッチオール
```

- ラベルは PR に付いている前提（Conventional Commits の type をラベルに mirror する CI を組むのが定石）
- `*` を含むカテゴリは最後に置く（先に書くと他カテゴリにマッチした PR まで吸収する）

## CLI から作成

```bash
# 自動生成 notes 付き
gh release create v1.2.3 --generate-notes

# notes ファイル + asset 添付
gh release create v1.2.3 \
  --title "v1.2.3" \
  --notes-file CHANGELOG.md \
  dist/*.tar.gz dist/*.zip

# pre-release / draft
gh release create v1.2.3-rc.1 --prerelease
gh release create v1.2.3 --draft

# draft の公開
gh release edit v1.2.3 --draft=false

# asset の追加
gh release upload v1.2.3 dist/extra.tar.gz

# ダウンロード
gh release download v1.2.3 --pattern "*.tar.gz"
```

## GitHub Actions での自動化

タグ push をトリガーに release を作成:

```yaml
# .github/workflows/release.yaml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: write       # release 作成に必須

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0      # 自動 release notes に履歴必須
      - run: |
          gh release create "${GITHUB_REF_NAME}" \
            --generate-notes \
            ./dist/*.tar.gz
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`softprops/action-gh-release@v2` を使う形式もあるが、`gh release create` で十分なケースが多い。

## release-please との関係

[`tools/release-please.md`](../../tools/release-please.md) は **Conventional Commits → release PR → タグ + GitHub Release** を自動化する。

- release-please: 「次に出すべき version の PR」を自動メンテし、merge 時にタグと release を作成
- 手動 / GitHub Actions のみ: 開発者がタグを切るタイミングを完全制御

OSS の継続リリースは release-please、不定期リリースは手動 / Actions のみが向く。

## アセット制限

| 項目 | 制限 |
|---|---|
| 1 release あたりの asset 数 | 最大 1,000 |
| 1 asset のサイズ | 最大 2 GiB |
| 帯域幅制限 | なし |

大型アーティファクトは Container Registry や外部ストレージ（S3 等）への push を併用する。

## ディスカッションリンク

```bash
gh release create v1.2.3 --discussion-category "Announcements"
```

`Settings > General > Features > Discussions` で有効化済みのリポジトリで、release ごとに自動でディスカッションを開ける。

## API（GraphQL / REST）

```bash
# 最新 release 取得
gh api repos/:owner/:repo/releases/latest

# tag 名から取得
gh api repos/:owner/:repo/releases/tags/v1.2.3

# asset ダウンロード URL
gh api repos/:owner/:repo/releases/latest --jq '.assets[].browser_download_url'
```

## AI エージェントがよくやるミス

1. **`fetch-depth: 0` 抜きで release notes 自動生成 → 履歴不足で空になる** — checkout step に `fetch-depth: 0`
2. **`permissions.contents: write` を付け忘れて 403** — release 作成は write 必須
3. **`*` カテゴリを `categories:` の先頭に書いて他カテゴリが死ぬ** — `*` は必ず最後
4. **同じタグ名で 2 度 release を作って失敗** — `gh release edit` で更新するか、削除後に作り直す
5. **pre-release を `latest` URL で配布する** — `--prerelease` を付けないと latest URL が RC を指してしまう
6. **`v1.2.3` と `1.2.3` を混ぜる** — リポジトリで一貫したプレフィックス（推奨は `v` 付き）を選ぶ

## 参考

- [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
