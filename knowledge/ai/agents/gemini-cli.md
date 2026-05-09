---
reviewed: 2026-05-07
tags: [ai-workflow, commercial, gcp]
---

# Gemini CLI

Google が提供するオープンソースの AI エージェント CLI。ReAct（Reason and Act）ループにより、複雑なコーディングタスク・デバッグ・自動化をターミナルから実行する。

## インストール

```bash
# npm（Node.js 20+ 必要）
npm install -g @google/gemini-cli

# npx（インストール不要）
npx @google/gemini-cli

# MacPorts
sudo port install gemini-cli
```

Google Cloud Shell にはプリインストール済み。

## 認証

3 つの認証方式（OAuth, API Key, Vertex AI）。`/auth` コマンドで対話的に変更可能。

## 基本コマンド

```bash
gemini                   # インタラクティブセッション開始
gemini --version         # バージョン表示
gemini --help            # ヘルプ表示
gemini update            # CLI を最新版に更新
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/about` | バージョン情報表示 |
| `/memory` | メモリ管理（add, list, inbox, refresh, show） |
| `/model` | 使用モデルの変更（Gemma 4 等の実験的モデルも選択可） |
| `/agents` | サブエージェントの管理 |
| `/plan` | Plan Mode への切替 |
| `/clear` | ターミナルクリア |
| `/resume` | セッションの再開 |

## 主要機能

- **ReAct ループ**: 推論と行動を交互に繰り返す自律型アーキテクチャ
- **リアルタイム音声モード (v0.41.0+)**: 音声による対話が可能（クラウド/ローカル対応）
- **ワークスペース・トラスト**: 自動化スクリプト実行時の信頼済みフォルダ管理
- **オフライン検索**: `ripgrep` がバンドルされ、高速なローカル検索が可能
- **4 層メモリ管理システム**: プロンプト駆動型の高度な記憶保持機能
- **MCP 統合**: Model Context Protocol サーバーとの連携

## 選択可能なモデル（2026-05 時点）

| モデル | 位置付け |
|---|---|
| `auto` | デフォルト。タスク複雑度に応じて動的ルーティング |
| `gemini-3.1-pro` | フラグシップモデル |
| `gemini-3.1-flash-lite` | 超高速・軽量モデル |
| `gemma-4` | **最新オープンモデル**（実験的サポート） |

## 承認モード

`default`（確認あり）/ `auto_edit`（編集自動）/ `plan`（計画のみ）の 3 モード。

## サンドボックス

Docker / Podman / OS ネイティブサンドボックスに対応。`settings.json` で詳細設定可能。

## Skills

2026-03 頃に追加された新機能。`Agent Skills` オープン標準準拠。

**探索ディレクトリ**:

1. Workspace: `.gemini/skills/` または `.agents/skills/`
2. User: `~/.gemini/skills/` または `~/.agents/skills/`
3. Extension bundled

`.agents/skills/` のほうが優先される（他 CLI との相互運用のため）。

**管理**: `/skills list | link | disable | enable | reload` および `gemini skills install`。アクティベーション時は `activate_skill` ツール経由でユーザー確認後、SKILL.md の本文とディレクトリ構造が会話履歴に注入される。

## サブエージェント

`.gemini/agents/`（project）または `~/.gemini/agents/`（user）に定義。

**frontmatter**:

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | slug |
| `description` | Yes | 用途 |
| `kind` | - | `local` / `remote` |
| `tools` | - | ワイルドカード `*`, `mcp_*`, `mcp_server_*` 対応 |
| `mcpServers` | - | inline 定義 |
| `model` | - | `inherit` 可 |
| `temperature` | - | 0.0-2.0 |
| `max_turns` | - | デフォルト 30 |
| `timeout_mins` | - | デフォルト 10 |

**ビルトイン**: `generalist` / `cli_help` / `codebase_investigator` / `browser_agent`（experimental、Chrome 144+ 必要）。

**呼び出し**: 自動委譲、または `@subagent-name` で強制呼び出し。**再帰不可**（subagent から subagent を呼べない）。

## カスタムコマンド

`.gemini/commands/*.toml` に TOML 形式で定義。サブディレクトリでネームスペース: `git/commit.toml` → `/git:commit`。

```toml
prompt = "以下のコミット: {{args}}\n\n!{git diff --staged}\n\n@{README.md}"
description = "ステージ済み変更のコミットメッセージを提案"
```

**プレースホルダ**:

- `{{args}}` — コマンド引数
- `!{shell command}` — シェルコマンドの実行結果を埋め込み
- `@{file}` — ファイル内容を埋め込み

**優先度**: Project `.gemini/commands/` > User `~/.gemini/commands/` > Extensions（同名衝突時に `<extension>.<command>` にプレフィックス）。

## Hooks

2025 年末〜2026 年初頭に追加。`settings.json` の `hooks` セクション。

**対応イベント（11 種類）**:

| カテゴリ | イベント |
|---|---|
| セッション | `SessionStart`, `SessionEnd` |
| エージェント | `BeforeAgent`, `AfterAgent` |
| モデル | `BeforeModel`, `AfterModel` |
| ツール | `BeforeToolSelection`, `BeforeTool`, `AfterTool` |
| コンテキスト | `PreCompress` |
| その他 | `Notification` |

exit 0 = success（ブロック含む全ロジックで推奨）、exit 2 = システムブロック（アクション中断）、その他 = 警告（続行）。環境変数 `GEMINI_PROJECT_DIR`, `GEMINI_PLANS_DIR`, `GEMINI_SESSION_ID`, `GEMINI_CWD`, `CLAUDE_PROJECT_DIR`（互換エイリアス）が渡される。

**管理コマンド**: `/hooks panel`, `/hooks enable-all` など。

**セキュリティ**: プロジェクト hooks はフィンガープリントされ、変更時に警告が出る。

## Extensions

`gemini-extension.json` で定義するパッケージ。含められるもの: `commands/`, `hooks/hooks.json`, `skills/`, `agents/`, `policies/`, `themes/`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`。

```bash
gemini extensions install <github-url>
```

## エージェント統合

### 指示ファイル

`AGENTS.md` をプロジェクトルートに配置。Gemini CLI が自動で読み込む。追加で `GEMINI.md` や `CONTEXT.md` もコンテキストとして読み込み可能。

### MCP サーバー登録

`.gemini/settings.json`（プロジェクト単位）または `~/.gemini/settings.json`（グローバル）:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"],
      "timeout": 15000,
      "trust": false
    }
  }
}
```

MCP サーバー固有の設定:

| フィールド | 説明 |
|---|---|
| `command` | 起動コマンド |
| `args` | コマンド引数 |
| `env` | 環境変数 |
| `cwd` | 作業ディレクトリ |
| `url` | SSE ベースサーバーの URL |
| `timeout` | タイムアウト（ミリ秒） |
| `trust` | true にするとツール呼び出し確認をスキップ |
| `includeTools` | 使用するツールのホワイトリスト |
| `excludeTools` | 除外するツールのブラックリスト |

## 無料枠

個人 Google アカウントで利用可能。無料枠のリクエスト制限あり（認証方式により異なる）。

有料オプション:

- **Google AI Pro / AI Ultra**: 個人向け、固定価格で上限拡大
- **Vertex AI**: エンタープライズ向け、従量課金

## 制限事項

- Node.js 20+ が必須
- Google Cloud アカウントの無料枠有効化に問題がある場合は `GOOGLE_CLOUD_PROJECT` の設定が必要

## システム要件

- macOS, Linux, Windows
- Node.js 20+
- RAM: 4 GB 以上推奨
