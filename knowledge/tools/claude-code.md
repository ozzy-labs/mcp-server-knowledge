# Claude Code

Anthropic が提供する AI コーディングエージェント CLI。ターミナル上でコードベースの理解・編集・Git 操作・コマンド実行をエージェントが自律的に行う。

## インストール

```bash
# ネイティブインストーラー（推奨）
curl -fsSL https://claude.ai/install.sh | bash    # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex           # Windows PowerShell

# Homebrew
brew install --cask claude-code

# npm（非推奨）
npm install -g @anthropic-ai/claude-code
```

ネイティブインストーラーは自動アップデート対応。Node.js 不要。

## 認証

初回起動時にブラウザで OAuth 認証。Claude Pro / Max / Team / Enterprise / API Console のいずれかが必要（無料プランでは利用不可）。

## 基本コマンド

```bash
claude                    # インタラクティブセッション開始
claude "プロンプト"        # ワンショット実行
claude --help             # ヘルプ表示
```

### セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示 |
| `/clear` | コンテキストクリア |
| `/compact` | コンテキスト圧縮 |
| `/model` | モデル切り替え |
| `/cost` | トークン使用量表示 |

## 設定

| パス | 用途 |
|---|---|
| `~/.claude/settings.json` | グローバル設定（権限、フック等） |
| `~/.claude/settings.local.json` | ローカルオーバーライド |
| `CLAUDE.md` | プロジェクト固有の指示 |
| `.claude/settings.json` | プロジェクト固有の設定 |
| `.claude/rules/` | 追加ルールファイル |

## 主要機能

- **ファイル編集**: コードの読み取り・編集・新規作成
- **コマンド実行**: シェルコマンドの実行と結果の解釈
- **Git 操作**: コミット・ブランチ・PR 作成を自然言語で
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **スキルシステム**: `.claude/skills/` にドメイン知識をエンコード
- **フック**: ツール実行前後にシェルコマンドを自動実行
- **マルチモデル**: Haiku（高速）/ Sonnet / Opus（高精度）を切り替え
- **スケジュール実行**: Anthropic インフラ上で定期実行

## 権限モード

| モード | 説明 |
|---|---|
| Ask | すべてのツール呼び出しを確認 |
| Auto-edit | ファイル編集は自動、コマンド実行は確認 |
| Full auto | すべて自動実行（allowlist 設定可能） |

## エージェント向け設定ファイル

```text
CLAUDE.md              # Claude Code が読む指示ファイル
.claude/settings.json  # 権限・MCP サーバー・フック設定
.claude/skills/        # スラッシュコマンドで呼び出すスキル
.claude/rules/         # 追加の振る舞いルール
```

## MCP サーバー登録

```json
// .mcp.json（プロジェクト単位）または ~/.claude/settings.json（グローバル）
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

## システム要件

- macOS 10.15+, Ubuntu 20.04+ / Debian 10+, Windows 10+（WSL / Git Bash）
- RAM: 4 GB 以上（8 GB 推奨）
- シェル: Bash, Zsh, Fish
