---
reviewed: 2026-05-10
tags: [ai-workflow, commercial, github]
aliases: [copilot]
---

# GitHub Copilot CLI

GitHub が提供する AI コーディングエージェント CLI。GitHub アカウントと深く統合され、計画・実行・テスト・レビューを自律的に行う。2026-02-25 に GA。

## インストール

```bash
# シェルスクリプト（推奨）
curl -fsSL https://gh.io/copilot-install | bash

# Homebrew
brew install copilot-cli

# npm
npm install -g @github/copilot

# WinGet
winget install GitHub.Copilot
```

## 認証

OAuth デバイスフローまたは GitHub Personal Access Token (PAT) で認証。

## 基本コマンド

```bash
copilot                  # インタラクティブセッション開始
copilot --name my-fix    # 名前付きセッションの作成 (v1.0.35+)
copilot --resume my-fix  # セッションの再開
copilot update           # CLI を最新版に更新
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示（スラッシュコマンドはタブ補完に対応） |
| `/model` | モデル切り替え（Auto mode はサーバー側で最適モデルを選択） |
| `/experimental` | 実験的機能（ラバーダック・エージェント等）を有効化 |
| `/remote on/off` | GitHub.com やモバイルアプリからのリモート制御を切り替え |
| `/statusline` | ステータスラインの表示（ユーザー名等）をカスタマイズ |
| `/usage` | クォータ使用状況表示 |
| `/clear` | 会話リセット |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.copilot/settings.json` | ユーザー設定 | - |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |
| `.mcp.json` | プロジェクト MCP 設定 | Yes |

`COPILOT_HOME` 環境変数で設定ディレクトリを変更可能。

## 主要機能

- **Autopilot モード**: 計画・実行・テスト・修正の自律ループ
- **サーバーサイド・モデルルーティング**: Auto mode においてリアルタイムで最適なモデルを自動選択
- **リモート制御**: ブラウザやモバイルから CLI セッションを監視・操作可能
- **LSP 統合**: TypeScript Language Server 等と連携した型情報の活用
- **MCP 統合**: Model Context Protocol サーバーとの連携

## カスタムエージェント

`.github/agents/<name>.agent.md`（project）または `~/.copilot/agents/<name>.agent.md`（user）に定義。**拡張子は `.agent.md` 固定**。スコープ優先は repository > organization > enterprise。

```markdown
---
name: db-specialist
description: データベース操作の専門エージェント
tools:
  - shell
  - view
  - edit
model: gpt-5
---

SQL クエリの最適化とスキーマ設計を支援します。
```

**frontmatter**:

| フィールド | 説明 |
|---|---|
| `name` | 識別子（省略時ファイル名） |
| `description` | 用途（必須） |
| `prompt` | システムプロンプト（または Markdown 本文で記述、最大 30,000 字） |
| `tools` | 許可ツール。`["*"]` で全許可、`[]` で全拒否 |
| `model` | 使用モデル |
| `disable-model-invocation` | `true` なら自動呼び出し禁止 |
| `user-invocable` | `false` ならユーザー呼び出し禁止 |
| `mcp-servers` | 利用可能な MCP |
| `target` | `vscode` / `github-copilot` / 両環境 |

**呼び出し**:

```bash
copilot --agent db-specialist --prompt "..."      # CLI フラグ
/agent db-specialist                               # セッション内
```

推論ベースで自動呼び出しされるほか、プロンプト内で名前を明示しても発火する。

## Skills

`Agent Skills` オープン標準準拠。**複数のディレクトリを同時にサポートし、他 CLI の skills を相互運用できる**。

| スコープ | 配置ディレクトリ（いずれも読まれる） |
|---|---|
| Project | `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Personal | `~/.copilot/skills/` / `~/.agents/skills/` |

**SKILL.md frontmatter**:

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | lowercase+hyphens。**ディレクトリ名と一致必須**、不一致だと読み込まれない |
| `description` | Yes | 発見の鍵 |
| `allowed-tools` | - | 許可確認スキップ |
| `license` | - | ライセンス表記 |

**管理コマンド**: `/skills list | info | reload | remove`。2026-04 以降は `gh skill` サブコマンドで GitHub CLI 経由でも管理可能。

## Hooks

`.github/hooks/*.json`（repo）または CWD の `hooks.json`。

**対応イベント**（PascalCase / camelCase 両対応）:

| イベント | 説明 |
|---|---|
| `sessionStart` | セッション開始 |
| `sessionEnd` | セッション終了 |
| `userPromptSubmitted` | ユーザー発話直前 |
| `preToolUse` | ツール実行前。`permissionDecision: allow\|deny\|ask` を返せる |
| `postToolUse` | ツール実行後 |
| `postToolUseFailure` | ツールエラー発生時（v1.0.15 追加） |
| `permissionRequest` | スクリプトから programmatic に承認可能（v1.0.16 追加） |
| `subagentStart` | subagent spawn 時（v1.0.7 追加） |
| `agentStop` / `subagentStop` | エージェント終了制御（v1.0.22 追加） |
| `preCompact` | コンテキスト圧縮直前（v1.0.5 追加） |
| `notification` | 非同期通知（v1.0.18 追加） |
| `errorOccurred` | エラー発生時（汎用） |

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "./scripts/guard.sh", "timeoutSec": 30 }
    ]
  }
}
```

`bash` / `powershell` キー両方対応。`timeoutSec` デフォルト 30 秒。

## プラグイン

`plugin.json` を root に置いてエージェント・スキル・フック・MCP・LSP を束ねて配布。

```text
my-plugin/
├── plugin.json
├── agents/<name>.agent.md
├── skills/<name>/SKILL.md
├── hooks/hooks.json
├── .github/mcp.json
└── lsp.json
```

**インストール**:

```bash
/plugin install owner/repo        # GitHub リポジトリ
copilot plugin install ./path     # ローカル
```

## エージェント統合

### 指示ファイル

読み込み対象:

- **個人グローバル**: `~/.copilot/copilot-instructions.md` — 全プロジェクトに適用
- **プロジェクト**: `AGENTS.md` — リポジトリルート / CWD / `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 環境変数（カンマ区切り）で指定したディレクトリ
- **追加**: `.github/instructions/**/*.instructions.md` — `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 配下も含めて自動読み込み

これらは Copilot CLI が自動で読み込む。

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
