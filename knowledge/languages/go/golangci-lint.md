---
reviewed: 2026-05-04
tags: [go, lint, ci]
---

# golangci-lint

Go 用の **linter オーケストレータ**。100 以上の linter を 1 コマンドで並列実行し、Go build cache と独自の解析結果キャッシュを再利用するため、大規模リポでも高速に動く。事実上の Go 標準 linter。

公式: [golangci-lint.run](https://golangci-lint.run/) / [GitHub](https://github.com/golangci/golangci-lint)

最新版は v2 系（v1 は 2025 年以降メンテのみ）。**新規導入は v2 を選ぶ**。

## インストール

```bash
# 公式インストールスクリプト（バージョン固定推奨）
curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/HEAD/install.sh \
  | sh -s -- -b $(go env GOPATH)/bin v2.12.1

# go install（v2 系のモジュールパスは /v2 が入る）
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest

# パッケージマネージャ
brew install golangci-lint                 # macOS
scoop install main/golangci-lint           # Windows
mise use -g golangci-lint@v2.12.1
```

公式は **`go install` を「動作保証なし」と明記**しており、CI はインストールスクリプトまたはバイナリ配布を推奨。

## v2 移行

v2 は 2025-03 にリリース。v1 設定からは自動移行コマンドがある:

```bash
golangci-lint migrate              # .golangci.yml を v2 形式に変換
golangci-lint migrate --format yaml --skip-validation
```

`<config>.bck.<ext>` でバックアップを生成。**コメントは移行されない**ので手動で復元する。

主な破壊的変更:

- 設定ファイルに `version: "2"` が必須
- `linters-settings:` → `linters.settings:` / `formatters.settings:`
- `linters.disable-all` → `linters.default: none`、`linters.enable-all` → `linters.default: all`
- `issues.exclude-dirs/files` → `linters.exclusions.paths`
- `issues.exclude-rules` → `linters.exclusions.rules`
- フォーマッタ（`gci` / `gofmt` / `gofumpt` / `goimports`）が **`formatters:` セクションへ分離**
- 削除された linter: `deadcode`, `golint`, `interfacer`, `maligned`, `scopelint`, `structcheck`, `varcheck` 他
- `gosimple` / `stylecheck` は `staticcheck` に統合
- エイリアス削除: `gas` → `gosec`, `gomnd` → `mnd`, `vet` → `govet`
- CLI: `--out-format` → `--output.<fmt>.path=...` に再構成

## 基本コマンド

```bash
golangci-lint run                       # カレントパッケージ
golangci-lint run ./...                 # リポ全体
golangci-lint run --fix                 # 自動修正
golangci-lint run --timeout 5m

# 差分実行（PR レビューで便利）
golangci-lint run --new-from-rev=HEAD~1
golangci-lint run --new-from-merge-base=main
golangci-lint run --whole-files         # 変更ファイル全体を表示

# 出力（v2 はサブキー形式）
golangci-lint run --output.json.path=stdout
golangci-lint run --output.sarif.path=report.sarif
golangci-lint run --output.checkstyle.path=cs.xml
golangci-lint run --output.junit-xml.path=junit.xml

# サブコマンド
golangci-lint linters         # 利用可能な linter 一覧
golangci-lint formatters      # フォーマッタ一覧（v2 新設）
golangci-lint config verify   # JSON Schema で設定検証
golangci-lint config path     # 使用される設定パス
golangci-lint cache status / cache clean
golangci-lint fmt             # フォーマッタのみ実行（v2 新設）
golangci-lint completion {bash|zsh|fish|powershell}
```

設定ファイル検索順: `.golangci.yml` → `.golangci.yaml` → `.golangci.toml` → `.golangci.json`（CWD から root へ、最後に home）。

## 設定ファイル（v2 スキーマ）

```yaml
version: "2"

run:
  timeout: 5m
  build-tags:
    - integration
  modules-download-mode: readonly

linters:
  default: standard       # standard | all | none | fast
  enable:
    - gosec
    - revive
    - bodyclose
    - errorlint
  disable:
    - gocyclo
  settings:
    revive:
      rules:
        - name: var-naming
    gosec:
      excludes:
        - G104
  exclusions:
    generated: strict     # strict | lax | disable
    warn-unused: true
    presets:
      - comments
      - common-false-positives
      - legacy
      - std-error-handling
    rules:
      - path: _test\.go
        linters: [errcheck, gosec]
    paths:
      - third_party
      - vendor

formatters:
  enable:
    - gofumpt
    - goimports
    - gci
  settings:
    gci:
      sections:
        - standard
        - default
        - prefix(github.com/your-org)
    gofumpt:
      extra-rules: true
    goimports:
      local-prefixes: github.com/your-org

issues:
  max-issues-per-linter: 50
  max-same-issues: 3

output:
  formats:
    text:
      path: stdout
      colors: true
```

## 主要 linter

### デフォルト有効（`default: standard`）

`errcheck` / `govet` / `ineffassign` / `staticcheck` / `unused` の 5 つ。

### よく追加するもの

| linter | 用途 |
|---|---|
| `revive` | `golint` 後継のスタイルチェック |
| `gocritic` | コードレビュー型の包括的チェック |
| `gosec` | セキュリティ（G101 ハードコード資格情報など） |
| `bodyclose` / `sqlclosecheck` | リソースリーク防止 |
| `errorlint` | `%w` ラップ漏れ・`==` 比較を検出 |
| `wrapcheck` | 外部 error をラップしているか |
| `exhaustive` | switch / map の網羅性 |
| `depguard` | import 制限（特定パッケージ禁止） |
| `testifylint` | testify のアサーション誤用 |
| `paralleltest` / `tparallel` | `t.Parallel()` 漏れ |
| `mnd` | magic number 検出 |

### フォーマッタ（v2 で `formatters:` セクション）

- `gofmt`（標準）
- `goimports`（gofmt + import 整理）
- `gofumpt`（gofmt より厳格、`gofmt` 上位互換）
- `gci`（import グループ化、ローカル prefix サポート）
- `golines`（行長制限）

## CI 統合（GitHub Actions）

公式 action: `golangci/golangci-lint-action`。**v2 を使うなら action は v7 以上**（v8 は `--working-directory` 絶対パス対応、v9 は Node.js 24）。

```yaml
name: golangci-lint
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  golangci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: stable
      - uses: golangci/golangci-lint-action@v8
        with:
          version: v2.12
          args: --timeout 5m --new-from-merge-base=origin/main
          only-new-issues: true
```

主要 input: `version`, `args`, `working-directory`, `only-new-issues`, `skip-cache`, `install-mode`（`binary` / `goinstall` / `none`）, `problem-matchers`, `github-token`。`~/.cache/golangci-lint` を自動キャッシュ。

### SARIF → Code Scanning 連携

```yaml
- uses: golangci/golangci-lint-action@v8
  with:
    args: --output.sarif.path=results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

## パフォーマンスチューニング

- `--concurrency N` / `-j N`: 使用 CPU 数
- `--allow-parallel-runners`: 複数同時起動を許可
- `--allow-serial-runners`: ロック直列化（CI で複数 step が同時実行する場合）
- `--max-issues-per-linter` / `--max-same-issues`: 出力量制御
- 大規模リポ: `linters.exclusions.paths` で `vendor`、生成コードを除外

## AI エージェントがよくやるミス

1. **v1 形式の `.golangci.yml` を v2 環境で使う** — `version: "2"` が無いと起動失敗。`golangci-lint migrate` で変換する
2. **フォーマッタを `linters.enable` に書く** — v2 では `formatters.enable` に分離。`gofumpt` / `goimports` / `gci` / `gofmt` / `golines` がフォーマッタ扱い
3. **`gosimple` / `stylecheck` を個別有効化** — v2 で `staticcheck` に統合済み。指定すると未知の linter エラー
4. **`--out-format json` で実行** — v2 では削除。`--output.json.path=stdout` を使う
5. **`go install` で本番投入** — 公式が動作保証していない。CI では install スクリプトかバイナリ配布
6. **`golangci-lint-action@v3` で v2 設定を使う** — action v6 以下は v1 のみ対応。v2 設定なら action v7+ が必須

## 参考

- [Install (Local)](https://golangci-lint.run/docs/welcome/install/local/)
- [Install (CI)](https://golangci-lint.run/docs/welcome/install/ci/)
- [Configuration File](https://golangci-lint.run/docs/configuration/file/)
- [Linters](https://golangci-lint.run/docs/linters/)
- [Formatters](https://golangci-lint.run/docs/formatters/)
- [Migration Guide v1 → v2](https://golangci-lint.run/docs/product/migration-guide/)
- [golangci-lint-action](https://github.com/golangci/golangci-lint-action)
