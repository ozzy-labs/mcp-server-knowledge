---
reviewed: 2026-05-02
tags: [ai-workflow, commercial, github]
aliases: [copilot]
---

# GitHub Copilot CLI

GitHub が提供する AI コーディングエージェント CLI。GitHub アカウントと深く統合され、コードの編集・テスト実行・Git ワークフローをエージェントが自律的に行う。2026-02-25 に GA。拡張機構の横断比較は `ai/platform/agent-extensions.md` を参照。

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
| `~/.copilot/copilot-instructions.md` | 個人グローバル指示（全プロジェクト共通） | - |
| `~/.copilot/agents/<name>.agent.md` | ユーザー custom agent | - |
| `~/.copilot/skills/<name>/SKILL.md` | ユーザー skill | - |
| `AGENTS.md` | プロジェクト固有の指示（repo root / CWD / `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` で指定したディレクトリで読まれる） | Yes |
| `.github/instructions/**/*.instructions.md` | プロジェクト追加指示（自動読み込み） | Yes |
| `.github/agents/<name>.agent.md` | プロジェクト custom agent | Yes |
| `.github/skills/<name>/SKILL.md` | プロジェクト skill（`.claude/skills/` / `.agents/skills/` も読む） | Yes |
| `.github/hooks/hooks.json` | プロジェクト hooks | Yes |
| `.github/mcp.json` | プロジェクト MCP | Yes |
| `.github/copilot-instructions.md` | カスタム指示（レガシー） | Yes |

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
| Personal | `~/.copilot/skills/` / `~/.claude/skills/` / `~/.agents/skills/` |

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

**対応イベント（6 種類）**:

| イベント | 説明 |
|---|---|
| `sessionStart` | セッション開始 |
| `sessionEnd` | セッション終了 |
| `userPromptSubmitted` | ユーザー発話直前 |
| `preToolUse` | ツール実行前。`permissionDecision: allow\|deny\|ask` を返せる |
| `postToolUse` | ツール実行後 |
| `errorOccurred` | エラー発生時 |

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
      "args": ["/path/to/knowledge-mcp-server/dist/index.js"]
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
