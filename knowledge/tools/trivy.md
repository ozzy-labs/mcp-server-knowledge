# Trivy

Aqua Security が提供する包括的なセキュリティスキャナ。コンテナイメージ・ファイルシステム・IaC・Kubernetes マニフェストに対して、脆弱性 (CVE)・シークレット・設定ミス・ライセンスの問題を検出する。Go 製の単一バイナリ。

公式: [trivy.dev](https://trivy.dev/)

## インストール

```bash
# mise
mise use trivy@0.69

# Homebrew
brew install trivy

# スクリプト
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# Docker
docker run --rm -v "$PWD":/workdir aquasec/trivy:latest fs /workdir
```

## スキャナ

Trivy は複数の検査器を切り替えて実行する:

| スキャナ | 検出対象 |
|---|---|
| `vuln` | CVE（OS パッケージ、言語の lockfile: npm, pnpm, Gemfile, go.sum, etc.） |
| `secret` | API キー、トークン、秘密鍵のパターン検出 |
| `misconfig` | Dockerfile / Kubernetes / Terraform / CloudFormation の設定ミス |
| `license` | 使用ライブラリのライセンス |

## 主要サブコマンド

| サブコマンド | 対象 | 例 |
|---|---|---|
| `trivy fs` | ファイルシステム | `trivy fs .` |
| `trivy image` | コンテナイメージ | `trivy image alpine:3.19` |
| `trivy repo` | Git リポジトリ（URL） | `trivy repo https://github.com/org/repo` |
| `trivy config` | IaC 設定ファイル | `trivy config .` |
| `trivy k8s` | K8s クラスタ | `trivy k8s cluster` |
| `trivy sbom` | SBOM (CycloneDX, SPDX) | `trivy sbom bom.json` |

## 基本的な使い方

```bash
# ファイルシステム全体
trivy fs --scanners vuln,secret --exit-code 1 --no-progress .

# 特定ディレクトリ
trivy fs --scanners vuln packages/web

# イメージ（認証付き）
trivy image --username $REG_USER --password $REG_PASS ghcr.io/org/app:latest
```

### 主要フラグ

| フラグ | 用途 |
|---|---|
| `--scanners <list>` | 有効化するスキャナ（`vuln,secret,misconfig,license`） |
| `--severity <levels>` | 出力する深刻度（`CRITICAL,HIGH`） |
| `--exit-code 1` | 検出時に非 0 終了（CI で失敗させる） |
| `--ignore-unfixed` | 修正リリース済みでない CVE を無視 |
| `--skip-dirs <pattern>` | ディレクトリ除外 |
| `--format json` / `--format sarif` | 機械可読出力 |
| `--output <file>` | ファイルに書き出し |
| `--cache-dir <path>` | キャッシュディレクトリ |

## 設定ファイル `trivy.yaml`

```yaml
scan:
  scanners:
    - vuln
    - secret
  skip-dirs:
    - node_modules
    - .pnpm-store
    - .venv

severity:
  - CRITICAL
  - HIGH

vulnerability:
  ignore-unfixed: true
```

プロジェクトルートに置けば `trivy fs .` 実行時に自動適用される。

## `.trivyignore`

個別の CVE ID を無視する:

```text
# format: <CVE-ID> <optional expiration: YYYY-MM-DD>
CVE-2023-12345
CVE-2024-11111 2026-06-30 comment about why
```

期限付き ignore を推奨（無期限放置を防ぐ）。

## シークレット検出

内蔵パターンで数十種の API キー・トークン・秘密鍵を検出する:

- AWS / GCP / Azure の access key
- GitHub / GitLab の PAT
- Slack / Stripe / SendGrid などの API キー
- RSA / PGP 秘密鍵

### カスタムパターン

```yaml
# trivy-secret.yaml
rules:
  - id: my-api-key
    severity: CRITICAL
    description: "My org API key"
    regex: 'MYAPI_[A-Z0-9]{32}'
```

```bash
trivy fs --secret-config trivy-secret.yaml .
```

## CI での使い方

### GitHub Actions

```yaml
- name: Trivy scan
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: fs
    scanners: vuln,secret
    severity: CRITICAL,HIGH
    exit-code: 1
    ignore-unfixed: true
```

### lefthook pre-commit

```yaml
pre-commit:
  commands:
    trivy:
      run: trivy fs --scanners vuln,secret --exit-code 1 --no-progress .
```

## データベース更新

Trivy は脆弱性 DB を OCI アーティファクトとして取得する:

```bash
trivy fs --db-repository ghcr.io/aquasecurity/trivy-db .
```

デフォルトで 6 時間 TTL のローカルキャッシュ。CI では `--cache-dir` を永続化するとスキャン時間が短縮される。

## 出力フォーマット

```bash
# コンソール（デフォルト）
trivy fs .

# JSON
trivy fs --format json --output report.json .

# SARIF（GitHub Security タブ統合用）
trivy fs --format sarif --output trivy.sarif .

# CycloneDX SBOM
trivy fs --format cyclonedx --output bom.json .
```

GitHub Actions では SARIF を `github/codeql-action/upload-sarif@v3` にアップロードすると Security タブに表示される。

## トラブルシュート

### DB 更新が遅い

初回のみ数十 MB のダウンロード。CI キャッシュ必須。

### False positive

既知 CVE でも実際に影響を受けない場合は `.trivyignore` に期限付きで追加する。

### `--severity` で絞っても CRITICAL しか出ない

`--severity` は OR 条件。`CRITICAL,HIGH` とカンマ区切り（スペース NG）。

### シークレット検出でテストフィクスチャが引っかかる

`--skip-files` または `--skip-dirs` で除外。`.trivyignore` は CVE 専用で、シークレットには使えない。

### コンテナイメージのスキャンで permission エラー

`docker run` 経由で使う場合、Docker デーモンソケットへのアクセス権が必要。

## 他ツールとの比較

| 観点 | Trivy | Snyk | Grype | Dependabot |
|---|---|---|---|---|
| OSS | 完全 OSS | 商用 + 無料枠 | OSS | 無料（GitHub） |
| スキャン対象 | fs / image / IaC / K8s | fs / image / IaC | image 中心 | 依存ファイル |
| シークレット検出 | あり | 別機能 | なし | なし |
| ライセンス | あり | あり | なし | なし |
| SBOM | 生成・読み取り | あり | 読み取り | なし |

Trivy は single-binary で幅広いカバレッジを持つため、OSS 運用では第一候補。
