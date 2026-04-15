# GitHub Copilot CLI

GitHub が提供する AI コーディングエージェント CLI。GitHub アカウントと深く統合され、コードの編集・テスト実行・Git ワークフローをエージェントが自律的に行う。

## インストール

```bash
# シェルスクリプト（推奨）
curl -fsSL https://gh.io/copilot-install | bash

# GitHub CLI から
gh copilot                 # 初回実行時にインストールを促される

# Homebrew
brew install copilot-cli

# npm
npm install -g @github/copilot

# WinGet（Windows）
winget install GitHub.Copilot
```

## 認証

OAuth デバイスフローまたは GitHub Personal Access Token (PAT) で認証。

```bash
# 環境変数で認証
export GH_TOKEN="your_github_token"
# または
export GITHUB_TOKEN="your_github_token"
```

## 基本コマンド

```bash
copilot                  # インタラクティブセッション開始
```

### セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示 |
| `/login` | 認証 |
| `/ask` | 会話に影響せずに質問 |
| `/share` | セッション共有 |
| `/context` | 会話コンテキスト表示 |
| `/version` | バージョン表示 |
| `/update` | CLI アップデート |
| `/exit` | セッション終了 |

## 設定

環境変数による設定:

| 変数 | 用途 |
|---|---|
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub 認証トークン |
| `GH_HOST` | カスタム GitHub ホスト（GHES） |
| `HTTPS_PROXY` | プロキシ設定 |
| `NO_COLOR` | カラー出力無効化 |
| `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` | カスタム指示ディレクトリ |

## 主要機能

- **Autopilot モード**: 計画・実行・テスト・修正を自律的に繰り返す
- **ファイル編集**: コードの読み取り・編集・新規作成
- **コマンド実行**: テスト・ビルド・Git 操作を自動実行
- **リモートコントロール**: GitHub Web / モバイルアプリからセッションを監視・操作
- **コンテキストヒント**: `@files` や `#issues` でコンテキストを指定
- **セッションリンク**: QR コードでリモート制御用リンクを生成

## 承認レベル

- すべてのアクションを確認
- ファイル編集は自動、コマンドは確認
- 完全自律実行（Autopilot）

## エージェント向け設定ファイル

```text
AGENTS.md                              # GitHub Copilot が読む指示ファイル
.agents/skills/                        # カスタムスキル定義
copilot-instructions.md                # カスタム指示（レガシー）
```

## 料金プラン

すべての GitHub Copilot プラン（Free, Pro, Pro+, Business, Enterprise）で利用可能。Free プランでも基本機能にアクセス可能。

## システム要件

- macOS, Linux, Windows
- GitHub アカウント + Copilot プラン
