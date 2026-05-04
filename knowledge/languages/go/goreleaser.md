---
reviewed: 2026-05-04
tags: [go, release, ci]
---

# GoReleaser

Go バイナリの **クロスコンパイル + マルチチャネル配布** を 1 コマンドで完結させる OSS。`.goreleaser.yaml` 1 つ書いて SemVer タグを push すれば、各 OS / Arch のバイナリビルド・チェックサム・SBOM・署名・GitHub Release・Homebrew tap・Docker push・apt/rpm パッケージ等を自動実行する。

公式: [goreleaser.com](https://goreleaser.com/) / [GitHub](https://github.com/goreleaser/goreleaser)

最新は v2 系（v2.15+）。**v2 では設定に `version: 2` ヘッダが必須**。

## エディション

OSS で十分にフル機能。**Pro 専用**は以下:

- macOS `.pkg` / `.dmg` / `.app` のネイティブ署名・notarize
- Windows MSI / NSIS インストーラ
- prepare / publish 二段階リリース、changelog プレビュー
- monorepo の path フィルタ、AI changelog 強化
- npm publish、Cloudsmith / Gemfury 連携
- Podman 対応、設定の include / templating
- ライセンスは `GORELEASER_KEY` で渡す

## インストール

| 方法 | OSS | Pro |
|---|---|---|
| Homebrew | `brew install --cask goreleaser/tap/goreleaser` | `goreleaser/tap/goreleaser-pro` |
| go install | `go install github.com/goreleaser/goreleaser/v2@latest` | （不可） |
| Docker | `goreleaser/goreleaser` | `goreleaser/goreleaser-pro` |
| Snap | `sudo snap install --classic goreleaser` | — |
| apt / yum | 公式 repo（鍵設定が必要） | 同左 |
| script | `curl -sfL https://goreleaser.com/static/run \| VERSION=v2.15.4 bash -s -- check` | 同 |

## 設定ファイル `.goreleaser.yaml`

```yaml
version: 2

before:
  hooks:
    - go mod tidy
    - go generate ./...

builds:
  - id: myapp
    main: ./cmd/myapp
    binary: myapp
    env:
      - CGO_ENABLED=0
    flags:
      - -trimpath
    ldflags:
      - -s -w -X main.version={{.Version}} -X main.commit={{.Commit}} -X main.date={{.Date}}
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]

archives:
  - id: default
    formats: [tar.gz]
    format_overrides:
      - goos: windows
        formats: [zip]
    name_template: >-
      {{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}
    files:
      - LICENSE
      - README.md

checksum:
  name_template: checksums.txt

signs:
  - cmd: cosign
    artifacts: checksum
    args:
      - sign-blob
      - --bundle=${signature}
      - ${artifact}
      - --yes

sboms:
  - artifacts: archive

snapshot:
  version_template: "{{ .Version }}-SNAPSHOT-{{.ShortCommit}}"

changelog:
  use: github
  sort: asc
  groups:
    - title: Features
      regexp: '^.*?feat(\([[:word:]]+\))??!?:.+$'
      order: 0
    - title: Bug fixes
      regexp: '^.*?fix(\([[:word:]]+\))??!?:.+$'
      order: 1
  filters:
    exclude:
      - "^docs:"
      - "^chore:"

release:
  github:
    owner: your-org
    name: myapp
  prerelease: auto      # vX.Y.Z-rc.N を自動で prerelease 扱い
  draft: false
```

## 主要セクション

| セクション | 役割 |
|---|---|
| `version: 2` | v2 必須 |
| `before:` | リリース前フック（`go mod tidy` 等） |
| `builds:` | クロスコンパイル定義 |
| `archives:` | tar.gz / zip 生成、`name_template` で命名 |
| `checksum:` | SHA256 チェックサム（既定） |
| `signs:` | cosign / GPG 署名 |
| `sboms:` | SBOM 生成（既定 syft / SPDX-JSON） |
| `snapshot:` | タグ無し時のバージョン |
| `changelog:` | 自動生成 changelog（github / gitlab / git ベース） |
| `release:` | GitHub / GitLab / Gitea Release |

## 配布チャネル

| キー | 配布先 |
|---|---|
| `brews:` | Homebrew tap への自動 PR |
| `homebrew_casks:` | macOS GUI アプリ向け cask（v2.10+） |
| `nfpms:` | deb / rpm / apk / ipk / Archlinux |
| `dockers:` | Docker image（要 Dockerfile） |
| `docker_manifests:` | マルチアーキ manifest list |
| `kos:` | ko 連携、Dockerfile レス |
| `winget:` | winget-pkgs への自動 PR（OSS） |
| `aurs:` / `scoops:` / `chocolateys:` | AUR / Scoop / Chocolatey |
| `snapcrafts:` / `flatpaks:` | Snap / Flatpak |
| `npms:` | Pro のみ |

## 主要コマンド

```bash
goreleaser init                              # 雛形生成
goreleaser check                             # 設定検証 + 非推奨警告
goreleaser healthcheck                       # 必要外部ツール（cosign, syft, docker 等）の確認

# ローカルテスト
goreleaser build --snapshot --clean          # タグ無しでビルドのみ
goreleaser release --snapshot --clean        # 全工程ドライラン
goreleaser release --skip=publish,sign       # 一部スキップ

# 本番
goreleaser release --clean                   # タグ push 時のフルリリース
```

v2 で削除されたフラグ: `--rm-dist`（→ `--clean`）, `--skip-*`（→ `--skip=...`）, `--debug`（→ `--verbose`）。

## CI 統合（GitHub Actions）

```yaml
name: release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write       # release / archive upload
  packages: write       # GHCR push 時
  id-token: write       # cosign keyless (OIDC) 用
jobs:
  goreleaser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # 必須: 履歴全取得（タグ検出のため）
      - uses: actions/setup-go@v5
      - uses: sigstore/cosign-installer@v3   # 署名する場合
      - uses: anchore/sbom-action/download-syft@v0   # SBOM 生成する場合
      - uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: "~> v2"
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # GORELEASER_KEY: ${{ secrets.GORELEASER_KEY }}  # Pro 用
```

`goreleaser-action` 自体は Docker / GPG / Cosign を **インストールしない**ので別途 setup が必要。

### 別リポへの commit が必要なチャネル

`brews:` の Homebrew tap や `scoops:` の Scoop bucket は別リポへの commit を伴う。`GITHUB_TOKEN` は実行リポへの権限しか持たないため、**別途 PAT を `HOMEBREW_TAP_GITHUB_TOKEN` 等で渡す**:

```yaml
env:
  HOMEBREW_TAP_GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
```

## 署名 / SBOM / 再現性

### cosign keyless（推奨）

GitHub OIDC を使った鍵レス署名。`id-token: write` 権限が必要:

```yaml
signs:
  - cmd: cosign
    artifacts: checksum
    args:
      - sign-blob
      - --bundle=${signature}
      - ${artifact}
      - --yes
```

検証側: `cosign verify-blob --bundle file.tar.gz.sigstore.json file.tar.gz`。

### SBOM

```yaml
sboms:
  - artifacts: archive
```

既定で syft が SPDX-JSON を生成。コンテナイメージは未対応（イメージ側は `cosign attest` を別途使う）。

### 再現性

`-trimpath` + 固定 `ldflags` でほぼ再現可能。`CGO_ENABLED=0` がさらに安定。

## AI エージェントがよくやるミス

1. **`fetch-depth: 0` 忘れ** — checkout 既定の shallow clone だと過去タグが見えず、`goreleaser` が「no tag」エラー
2. **タグの形式ミス** — `vX.Y.Z` の **leading `v` 必須**。`1.0.0` だと SemVer として認識されず失敗
3. **`version: 2` 行を書き忘れる** — v2 環境で v1 形式の設定だと警告（将来エラー化）。`goreleaser check` で検証
4. **Homebrew tap 用 token に `GITHUB_TOKEN` を使う** — 別リポへ commit できない。専用 PAT を発行して別 secret に登録
5. **`--rm-dist` を使う** — v2 で削除。`--clean` を使う
6. **cosign keyless で `id-token: write` 忘れ** — OIDC token が取れず署名失敗
7. **macOS バイナリの notarize を OSS でやろうとする** — 未対応。Pro が必要

## 参考

- [Install](https://goreleaser.com/install/)
- [Customization](https://goreleaser.com/customization/)
- [GitHub Actions](https://goreleaser.com/ci/actions/)
- [v1 → v2 Migration](https://goreleaser.com/blog/goreleaser-v2/)
- [goreleaser-action](https://github.com/goreleaser/goreleaser-action)
