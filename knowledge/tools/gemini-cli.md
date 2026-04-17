---
reviewed: 2026-04-18
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

# リリースチャンネル
npm install -g @google/gemini-cli@latest     # 安定版
npm install -g @google/gemini-cli@preview    # プレビュー版
npm install -g @google/gemini-cli@nightly    # ナイトリー
```

Google Cloud Shell にはプリインストール済み。

## 認証

3 つの認証方式:

```bash
# 1. Google アカウント OAuth（デフォルト、個人利用）
gemini                   # 初回起動時にブラウザ認証
gemini --reauth          # 再認証

# 2. API キー（https://aistudio.google.com/apikey で取得）
export GEMINI_API_KEY="YOUR_API_KEY"

# 3. Vertex AI（エンタープライズ）
export GOOGLE_GENAI_USE_VERTEXAI=true
export GOOGLE_CLOUD_PROJECT=your-project-id
```

## 基本コマンド

```bash
gemini                   # インタラクティブセッション開始
gemini --version         # バージョン表示
gemini --help            # ヘルプ表示
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/about` | バージョン情報表示 |
| `/agents` | サブエージェントの管理（list, reload, enable, disable） |
| `/auth` | 認証方式の変更ダイアログ |
| `/chat list` | 保存済みチェックポイント一覧 |
| `/chat save <tag>` | 現在の会話を保存 |
| `/chat resume <tag>` | 保存した会話を再開 |
| `/chat share [file]` | 会話を Markdown/JSON にエクスポート |
| `/clear` | ターミナルクリア（Ctrl+L） |
| `/commands reload` | カスタムコマンドの再読み込み |
| `/bug` | Issue の報告 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.gemini/settings.json` | グローバル設定 | - |
| `.gemini/settings.json` | プロジェクト固有の設定 | Yes |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |
| `GEMINI.md` / `CONTEXT.md` | 追加コンテキスト指示 | Yes |

### settings.json の主要セクション

```json
{
  "general": {
    "defaultApprovalMode": "default",
    "checkpointing": { "enabled": true }
  },
  "model": {
    "name": "auto"
  },
  "context": {
    "fileName": ["GEMINI.md", "CONTEXT.md"],
    "includeDirectoryTree": true
  },
  "tools": {
    "sandbox": "docker",
    "useRipgrep": true,
    "shell": {
      "enableInteractiveShell": true,
      "inactivityTimeout": 300
    }
  },
  "security": {
    "disableYoloMode": false,
    "folderTrust": { "enabled": true }
  },
  "experimental": {
    "enableAgents": true,
    "plan": true
  }
}
```

### 選択可能なモデル（2026-04 時点）

| モデル | 位置付け |
|---|---|
| `auto` | **新デフォルト**。タスク複雑度に応じてルーティング |
| `gemini-3.1-pro` | フラグシップ（2026-02 リリース） |
| `gemini-3-pro` | v0.25.0（2026-01）で正式に preview 解除されデフォルト昇格した経緯あり |
| `gemini-3.1-flash-lite` | 軽量・高速（2026-03 API 公開） |
| `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-2.5-flash-lite` | 旧世代、継続提供 |
| `gemma`（ローカル） | 実験的 |

旧資料の `gemini-2.5-pro` デフォルトは陳腐化。**モデル解決の優先度**: `--model` フラグ → `GEMINI_MODEL` 環境変数 → `settings.json` の `model.name` → ローカル Gemma ルータ。

> **注意**: 既知の Issue [#5373](https://github.com/google-gemini/gemini-cli/issues/5373) — 一部コードパスでハードコードされた `DEFAULT_GEMINI_MODEL = "gemini-2.5-pro"` が `settings.json` の指定を上書きするケースがある。期待モデルで起動していないと感じたら `--model` フラグまたは `GEMINI_MODEL` 環境変数で強制指定する。

## ビルトインツール

| ツール | 説明 |
|---|---|
| ReadFile | ファイル読み取り |
| WriteFile | ファイル書き込み |
| EditFile | ファイル編集（差分適用） |
| FindFiles | ファイル検索（glob / regex） |
| SearchText | テキスト検索（grep） |
| Shell | シェルコマンド実行 |
| GoogleSearch | Google 検索 |
| WebFetch | Web ページ取得 |

## 主要機能

- **ReAct ループ**: 推論と行動を交互に繰り返す自律型アーキテクチャ
- **サブエージェント**: `/agents` で専門エージェントを有効化・管理
- **セッション管理**: チェックポイントで会話を保存・再開
- **サンドボックス**: Docker / Podman / macOS Seatbelt / Windows ネイティブ対応
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **カスタムコマンド**: `.toml` ファイルでスラッシュコマンドを定義
- **コンテキストファイル**: `GEMINI.md` / `CONTEXT.md` で追加指示

## 承認モード

| モード | 説明 |
|---|---|
| `default` | ファイル変更・コマンド実行を確認 |
| `auto_edit` | ファイル編集は自動、コマンドは確認 |
| `plan` | 計画のみ作成、実行は手動 |

`settings.json` の `general.defaultApprovalMode` で設定。

## サンドボックス

| モード | 説明 |
|---|---|
| `docker` | Docker コンテナ内で実行 |
| `podman` | Podman コンテナ内で実行 |
| `true` | OS ネイティブサンドボックス（macOS Seatbelt / Windows） |
| `false` | サンドボックスなし |

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
