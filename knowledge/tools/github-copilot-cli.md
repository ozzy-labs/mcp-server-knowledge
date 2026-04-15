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
export GH_TOKEN="your_github_token"
# または
export GITHUB_TOKEN="your_github_token"
```

## 基本コマンド

```bash
copilot                  # インタラクティブセッション開始
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示 |
| `/login` | 認証 |
| `/ask` | 会話に影響せずに質問 |
| `/share` | セッション共有 |
| `/context` | 会話コンテキスト表示 |
| `/agent <name>` | カスタムエージェントを起動 |
| `/lsp` | LSP サーバーの状態表示 |
| `/version` | バージョン表示 |
| `/update` | CLI アップデート |
| `/exit` | セッション終了 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.copilot/config.json` | グローバル設定 | - |
| `~/.copilot/mcp-config.json` | グローバル MCP サーバー設定 | - |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |
| `.agents/` | カスタムエージェント・スキル | Yes |
| `copilot-instructions.md` | カスタム指示（レガシー） | Yes |

`COPILOT_HOME` 環境変数または `--config-dir` フラグで設定ディレクトリを変更可能。

### 環境変数

| 変数 | 用途 |
|---|---|
| `GH_TOKEN` / `GITHUB_TOKEN` | GitHub 認証トークン |
| `GH_HOST` | カスタム GitHub ホスト（GHES） |
| `HTTPS_PROXY` / `HTTP_PROXY` | プロキシ設定 |
| `NO_PROXY` | プロキシ除外リスト |
| `NO_COLOR` | カラー出力無効化 |
| `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` | カスタム指示ディレクトリ |

## 主要機能

- **Autopilot モード**: 計画・実行・テスト・修正を自律的に繰り返す
- **ファイル編集**: コードの読み取り・編集・新規作成
- **コマンド実行**: テスト・ビルド・Git 操作を自動実行
- **リモートコントロール**: GitHub Web / モバイルアプリからセッションを監視・操作
- **コンテキストヒント**: `@files` や `#issues` でコンテキストを指定
- **カスタムエージェント**: Markdown で専門エージェントを定義
- **LSP 統合**: TypeScript Language Server と連携して型情報を活用
- **MCP 統合**: Model Context Protocol サーバーとの連携

## カスタムエージェント

`.agents/` に Markdown ファイルとして定義:

```markdown
---
name: db-specialist
description: データベース操作の専門エージェント
tools:
  - shell
  - view
  - edit
---

SQL クエリの最適化とスキーマ設計を支援します。
```

```bash
# 起動方法
copilot --agent db-specialist
# または セッション内で
/agent db-specialist
```

## エージェント統合

### 指示ファイル

`AGENTS.md` をプロジェクトルートに配置。Copilot CLI が自動で読み込む。

### MCP サーバー登録

`~/.copilot/mcp-config.json`（グローバル）に追加:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

CLI フラグで一時的に追加することも可能:

```bash
copilot --additional-mcp-config @/path/to/config.json
```

## 料金プラン

すべての GitHub Copilot プランで利用可能:

- Free（基本機能）
- Pro / Pro+
- Business / Enterprise

## 制限事項

- GitHub アカウントが必須
- GHES（GitHub Enterprise Server）利用時は `GH_HOST` の設定が必要

## システム要件

- macOS, Linux, Windows
- GitHub アカウント + Copilot プラン
