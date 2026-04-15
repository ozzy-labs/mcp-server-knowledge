# Codex CLI

OpenAI が提供するオープンソースのコーディングエージェント CLI。ターミナル上でコードの読み取り・編集・コマンド実行を行い、マルチエージェント並列処理もサポートする。

## インストール

```bash
# npm（Node.js 22+ 必要）
npm install -g @openai/codex

# Homebrew
brew install codex

# バイナリ直接ダウンロード
# https://github.com/openai/codex/releases
```

## 認証

初回起動時に ChatGPT アカウントでブラウザ OAuth 認証。ChatGPT Plus / Pro / Team / Edu / Enterprise のいずれかが必要。

## 基本コマンド

```bash
codex                    # インタラクティブ TUI セッション開始
codex "プロンプト"        # ワンショット実行
```

### セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/model` | モデル切り替え |
| `/help` | ヘルプ表示 |
| `/share` | セッション共有 |
| `/exit` | セッション終了 |

## 設定

| パス | 用途 |
|---|---|
| `~/.codex/config.toml` | グローバル設定 |
| `AGENTS.md` | プロジェクト固有の指示 |
| `.agents/` | スキル・ツール設定 |

## 主要機能

- **フルスクリーン TUI**: インタラクティブなターミナル UI
- **マルチエージェント**: 複数のエージェントが独立した Git worktree で並列実行
- **ミッドターンステアリング**: エージェント作業中にメッセージを送信して方向修正
- **ファイル添付**: スクリーンショットやデザイン仕様を添付可能
- **コードレビュー**: コミット前に別エージェントがレビュー
- **セッション記録**: ローカルに保存され、後から再開可能
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **推論レベル調整**: タスクに応じて推論の深さを調整

## 承認モード

| モード | 説明 |
|---|---|
| Suggest | 提案のみ、実行は手動 |
| Auto-edit | ファイル編集は自動、コマンド実行は確認 |
| Full auto | すべて自動実行 |

## エージェント向け設定ファイル

```text
AGENTS.md              # Codex CLI が読む指示ファイル
.agents/skills/        # カスタムスキル定義
```

## システム要件

- macOS, Linux（フルサポート）、Windows（WSL 経由）
- Node.js 22+
- RAM: 4 GB 以上（8 GB 推奨）
