# Codex CLI

OpenAI が提供するオープンソースのコーディングエージェント CLI。フルスクリーン TUI でコードの読み取り・編集・コマンド実行を行い、マルチエージェント並列処理もサポートする。

## インストール

```bash
# npm（Node.js 22+ 必要）
npm install -g @openai/codex

# Homebrew
brew install codex

# バイナリ直接ダウンロード
# https://github.com/openai/codex/releases
# Apple Silicon, x86_64 Mac, x86_64 Linux, arm64 Linux 対応
```

## 認証

初回起動時に ChatGPT アカウントでブラウザ OAuth 認証。以下のいずれかのプランが必要:

- ChatGPT Plus / Pro / Team / Edu / Enterprise

## 基本コマンド

```bash
codex                    # フルスクリーン TUI セッション開始
codex "プロンプト"        # ワンショット実行
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/model` | モデル切り替え |
| `/help` | ヘルプ表示 |
| `/share` | セッション共有 |
| `/exit` | セッション終了 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.codex/config.toml` | グローバル設定 | - |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |
| `.agents/` | スキル・ツール設定 | Yes |

### config.toml の主要設定

```toml
# デフォルトモデル（例）。省略時は CLI 同梱のモデルカタログから自動選択される
model = "gpt-5.4"

# 推論の深さ（minimal, low, medium, high, xhigh）※ xhigh はモデル依存
model_reasoning_effort = "medium"

# サンドボックス: "macos"（Seatbelt）, "docker", "none"
sandbox = "macos"

# 承認ポリシー: "untrusted", "on-request", "never"
approval_policy = "on-request"

# MCP サーバー
[mcp_servers.my-server]
command = "node"
args = ["/path/to/server.js"]

# MCP ツールごとの承認設定
[mcp_servers.my-server.tools.search]
approval_mode = "approve"

# 通知（エージェント完了時に実行）
[notify]
command = "/path/to/notify-script.sh"
```

### 同梱モデル（rust-v0.121.0 時点、2026-04）

`/model` ピッカーが露出するモデル（優先度順）:

| モデル | 説明 |
|---|---|
| `gpt-5.4` | 最新のフロンティア agentic coding モデル |
| `gpt-5.3-codex` | 一世代前。UI で `gpt-5.4` へのアップグレード案内が出る |
| `gpt-5.2-codex` | 低優先度。明示指定時のみ使用 |

古い資料にある `o4-mini` は同梱カタログから削除済み。`model_presets.rs` のハードコードも撤廃され、`models-manager/models.json` のカタログから動的に列挙される。

## 主要機能

- **フルスクリーン TUI**: インタラクティブなターミナル UI
- **マルチエージェント**: 複数のエージェントが独立した Git worktree で並列実行
- **ミッドターンステアリング**: エージェント作業中にメッセージを送信して方向修正
- **ファイル添付**: スクリーンショットやデザイン仕様を添付可能
- **コードレビュー**: コミット前に別エージェントが自動レビュー
- **セッション記録**: ローカルに保存され、後から再開可能
- **MCP 統合**: Model Context Protocol サーバーとの連携（ツール単位で承認制御）
- **推論レベル調整**: タスクに応じて推論の深さを調整

## 承認ポリシー

| ポリシー | 説明 |
|---|---|
| `untrusted` | すべてのアクションを確認 |
| `on-request` | ファイル編集は自動、コマンド実行は確認 |
| `never` | すべて自動実行 |

`config.toml` の `approval_policy` で設定。

## サンドボックス

| モード | 説明 |
|---|---|
| `macos` | macOS Seatbelt でサンドボックス化 |
| `docker` | Docker コンテナ内で実行 |
| `none` | サンドボックスなし |

## エージェント統合

### 指示ファイル

`AGENTS.md` をプロジェクトルートに配置。Codex CLI が自動で読み込む。

### MCP サーバー登録

`~/.codex/config.toml` に設定:

```toml
[mcp_servers.knowledge]
command = "node"
args = ["/path/to/mcp-server-knowledge/dist/index.js"]
```

## 制限事項

- ChatGPT 有料プランが必要
- Windows は WSL 経由のみ対応

## システム要件

- macOS, Linux（フルサポート）、Windows（WSL 経由）
- Node.js 22+
- RAM: 4 GB 以上（8 GB 推奨）
