---
reviewed: 2026-04-18
---

# Gitleaks

Git リポジトリに誤コミットされたシークレット（API キー、トークン、秘密鍵）を検出する CLI。pre-commit や CI で実行する想定。Go 製の単一バイナリ。

公式: [github.com/gitleaks/gitleaks](https://github.com/gitleaks/gitleaks)

## インストール

```bash
# mise
mise use gitleaks@8

# Homebrew
brew install gitleaks

# Go
go install github.com/gitleaks/gitleaks/v8@latest

# Docker
docker run --rm -v "$PWD":/path zricethezav/gitleaks:latest detect --source /path
```

## 主要サブコマンド

| コマンド | 用途 |
|---|---|
| `gitleaks detect` | Git 履歴全体をスキャン |
| `gitleaks protect` | ステージ中またはワーキングツリーの変更のみ（pre-commit 向け） |
| `gitleaks dir` | Git 以外のディレクトリをスキャン |
| `gitleaks stdin` | 標準入力をスキャン |

## 基本的な使い方

```bash
# 履歴全体
gitleaks detect --no-banner

# 現在のコミット以降のみ
gitleaks detect --no-banner --log-opts="HEAD~10..HEAD"

# ステージ中のファイル（pre-commit）
gitleaks protect --staged --no-banner

# 終了コードで CI 判定
gitleaks detect --exit-code 1
```

### 主要フラグ

| フラグ | 意味 |
|---|---|
| `--no-banner` | ロゴ省略 |
| `--verbose` | 詳細出力 |
| `--redact` | 検出値を `***` に置換してログ漏洩防止 |
| `--report-format <json\|csv\|sarif>` | 出力形式 |
| `--report-path <path>` | ファイル出力 |
| `--config <path>` | カスタム設定 |
| `--baseline-path <path>` | 既知の検出を無視（差分のみ報告） |
| `--log-opts "<git-log-args>"` | スキャン範囲を `git log` 構文で指定 |

## 内蔵ルール

[デフォルトルール](https://github.com/gitleaks/gitleaks/blob/master/config/gitleaks.toml) に 150+ パターン:

- AWS / GCP / Azure アクセスキー
- GitHub / GitLab PAT、App Token、OAuth トークン
- Slack / Stripe / SendGrid / Twilio / DigitalOcean 等の主要 SaaS API キー
- RSA / PGP 秘密鍵、SSH 秘密鍵
- JWT、パスワード付き DB URL

## カスタム設定 `.gitleaks.toml`

```toml
[extend]
# デフォルトを継承（推奨）
useDefault = true

[[rules]]
id = "my-org-api-key"
description = "My Org internal API key"
regex = '''MYORG_[A-Z0-9]{32}'''
tags = ["key", "myorg"]

[[rules]]
id = "custom-db-url"
regex = '''postgres://[^\s]+:[^\s]+@[^\s/]+/'''
entropy = 3.5

[allowlist]
# 誤検出の除外
paths = [
  '''(.*?)(jpg|gif|doc|pdf|bin|lock)$''',
  '''tests/fixtures/.*''',
]
regexes = [
  '''AKIA[0-9A-Z]{16}''',  # テスト用ダミー
]
commits = ["abc123def..."]  # 特定コミットを除外
```

## 検出値の取り扱い

**絶対にしてはいけない**:

- 検出された値を GitHub Issue / PR / Slack にそのまま貼る
- CI ログに平文で残す
- 「重要ではない」として放置する

**正しい対応**:

1. その場でキーを**ローテーション**（新キー発行 → 旧キー無効化）
2. Git 履歴から除去（`git filter-repo`、BFG Repo-Cleaner）
3. force push で全ブランチを更新
4. チームに共有（他の人が pull して lost 状態を防ぐ）
5. なぜ検出をすり抜けて commit されたかを振り返る

**Git 履歴から消しても安全ではない**（push 済みならミラー・GitHub の reflog に残る可能性）。ローテーションが最優先。

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    gitleaks:
      run: gitleaks protect --staged --no-banner
```

`gitleaks protect --staged` はステージ中のファイルのみを対象にする高速モード。

## CI での使い方

### GitHub Actions

```yaml
- uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    GITLEAKS_LICENSE: ${{ secrets.GITLEAKS_LICENSE }}  # 組織利用は有償
```

### 生コマンド

```yaml
- run: gitleaks detect --no-banner --redact --report-format sarif --report-path gitleaks.sarif
- if: always()
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: gitleaks.sarif
```

## Git 履歴のクリーンアップ

検出された場合の履歴書き換え:

```bash
# git filter-repo（推奨、BFG より正確）
pip install git-filter-repo
git filter-repo --path <leaked-file> --invert-paths

# BFG Repo-Cleaner
bfg --delete-files <leaked-file>
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# push（全ブランチ force push）
git push --force --all
git push --force --tags
```

これは**破壊的操作**。他のコラボレーターがクローン済みの場合は事前通知が必須。

## false positive の抑制

優先度順:

1. `.gitleaks.toml` の `allowlist.regexes` に追加（パターンで除外）
2. `allowlist.paths` でディレクトリ除外（`tests/fixtures/`）
3. インラインコメント `gitleaks:allow` を該当行末に付与（例: `apiKey := "AKIA0000000000000000" // gitleaks:allow`）
4. 最終手段として `allowlist.commits` で特定コミット除外

## トラブルシュート

### `detect` が遅い

リポジトリが巨大だと Git 履歴全走査で時間がかかる。`--log-opts` で範囲を絞る:

```bash
gitleaks detect --log-opts="--since='1 month ago'"
```

### CI で検出したが個人環境で通る

`pre-commit` と `detect`（履歴全走査）はスコープが異なる。既存のコミット履歴に含まれる漏洩は `detect` のみが拾う。

### `gitleaks-action` が有料エラー

組織アカウントでは `GITLEAKS_LICENSE` が必要（無料枠は個人のみ）。セルフホストランナー + 生コマンドで迂回可能。

### Git 以外のディレクトリをスキャンしたい

`gitleaks dir <path>` を使う（Git 履歴なし）。

## 他ツールとの比較

| 観点 | Gitleaks | TruffleHog | detect-secrets | Trivy (secret) |
|---|---|---|---|---|
| 検出精度 | 高（150+ パターン） | 非常に高（API 検証付き） | 中 | 中 |
| 速度 | 速い（Go） | 中 | 遅い（Python） | 速い |
| history scan | あり | あり | 限定的 | あり |
| pre-commit | あり | あり | 専用 | あり |
| ライセンス | MIT（組織 CI は有償） | AGPL + 有償 | Apache 2.0 | Apache 2.0 |

本リポジトリは Gitleaks + Trivy (secret) の二段構え。Gitleaks が pre-commit で弾き、Trivy が CI で最終チェック。
