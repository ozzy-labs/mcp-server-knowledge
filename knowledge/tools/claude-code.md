# Claude Code

Anthropic が提供する AI コーディングエージェント CLI。ターミナル上でコードベースの理解・編集・Git 操作・コマンド実行をエージェントが自律的に行う。

## インストール

```bash
# ネイティブインストーラー（推奨・自動アップデート対応・Node.js 不要）
curl -fsSL https://claude.ai/install.sh | bash    # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex           # Windows PowerShell

# Homebrew（自動アップデートなし）
brew install --cask claude-code

# WinGet
winget install Anthropic.ClaudeCode

# npm（非推奨）
npm install -g @anthropic-ai/claude-code
```

## 認証

初回起動時にブラウザで OAuth 認証。以下のいずれかのプランが必要（無料プランでは利用不可）:

- Claude Pro / Max / Team / Enterprise
- API Console（API キー課金）

## 基本コマンド

```bash
claude                    # インタラクティブセッション開始
claude "プロンプト"        # ワンショット実行
claude --help             # ヘルプ表示
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示 |
| `/clear` | コンテキストクリア |
| `/compact` | コンテキスト圧縮 |
| `/model` | モデル切り替え |
| `/cost` | トークン使用量表示 |

カスタムコマンドは `.claude/commands/` に Markdown ファイルとして定義可能。

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.claude/settings.json` | グローバル設定（権限等） | - |
| `~/.claude/settings.local.json` | ローカルオーバーライド | - |
| `CLAUDE.md` | プロジェクト固有の指示 | Yes |
| `.claude/settings.json` | プロジェクト固有の設定 | Yes |
| `.claude/settings.local.json` | ユーザーローカル設定 | No |
| `.claude/rules/` | 追加ルールファイル | Yes |
| `.claude/commands/` | カスタムスラッシュコマンド | Yes |
| `.mcp.json` | MCP サーバー設定 | Yes |

## 主要機能

- **ファイル編集**: コードの読み取り・編集・新規作成
- **コマンド実行**: シェルコマンドの実行と結果の解釈
- **Git 操作**: コミット・ブランチ・PR 作成を自然言語で
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **スキルシステム**: `.claude/skills/` にドメイン知識をエンコード
- **フック**: ツール実行前後にシェルコマンドや LLM 検証を自動実行
- **マルチモデル**: Haiku（高速）/ Sonnet / Opus（高精度）を切り替え
- **スケジュール実行**: Anthropic インフラ上で定期実行

## 権限モード

| モード | 説明 |
|---|---|
| Ask | すべてのツール呼び出しを確認 |
| Auto-edit | ファイル編集は自動、コマンド実行は確認 |
| Full auto | すべて自動実行（allowlist で制御可能） |

`settings.json` の `permissions` で詳細制御:

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "ask": ["Bash"],
    "deny": ["WebSearch"]
  }
}
```

## フックシステム

ツール実行の前後に自動処理を挟む仕組み。`command`（シェル実行）と `prompt`（LLM 評価）の 2 種類。

| イベント | タイミング |
|---|---|
| `PreToolUse` | ツール実行前（許可/拒否/入力変更が可能） |
| `PostToolUse` | ツール実行後（結果の検証・フィードバック） |

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash ./scripts/validate.sh",
          "timeout": 5
        }
      ]
    }
  ]
}
```

フック応答: exit 0 = 許可、exit 2 = 拒否（stderr がエラーメッセージとしてフィードバック）。

## エージェント統合

### 指示ファイル

`CLAUDE.md` をプロジェクトルートに配置。Claude Code が自動で読み込む。

### MCP サーバー登録

`.mcp.json`（プロジェクト単位）または `~/.claude/settings.json`（グローバル）:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### カスタムコマンド

`.claude/commands/` に Markdown ファイルを配置:

```markdown
---
description: コードレビュー実行
allowed-tools: Read, Grep, Glob
---

以下のファイルをレビューしてください: $ARGUMENTS
```

## 制限事項

- 無料プランでは利用不可
- レート制限到達時はプロンプト送信が一時停止
- ネイティブインストーラー以外（npm）は非推奨

## システム要件

- macOS 10.15+, Ubuntu 20.04+ / Debian 10+, Windows 10+（WSL / Git Bash）
- RAM: 4 GB 以上（8 GB 推奨）
- シェル: Bash, Zsh, Fish
