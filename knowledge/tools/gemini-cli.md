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

3 つの認証方式:

```bash
# 1. OAuth（デフォルト、個人利用）
gemini                   # 初回起動時にブラウザ認証

# 2. API キー
export GOOGLE_API_KEY="YOUR_API_KEY"

# 3. Vertex AI（エンタープライズ）
export GOOGLE_GENAI_USE_VERTEXAI=true
```

再認証: `gemini --reauth`

## 基本コマンド

```bash
gemini                   # インタラクティブセッション開始
gemini --help            # ヘルプ表示
```

## 設定

| パス | 用途 |
|---|---|
| `~/.gemini/settings.json` | グローバル設定 |
| `.gemini/settings.json` | プロジェクト固有の設定 |
| `AGENTS.md` | プロジェクト固有の指示 |

### プロキシ設定

```bash
npm config set proxy http://your-proxy:port
export HTTPS_PROXY="http://your-proxy:port"
```

## 主要機能

- **ReAct ループ**: 推論と行動を交互に繰り返す自律型アーキテクチャ
- **ビルトインツール**: ファイル操作、シェルコマンド、Google 検索、Web フェッチ
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **サンドボックス**: macOS Seatbelt / Windows ネイティブサンドボックス対応
- **カスタムスキル**: 独自のスキルを定義可能
- **ブラウザエージェント**: Web ページとのインタラクション（実験的機能）

### ビルトインツール一覧

| ツール | 説明 |
|---|---|
| ReadFile | ファイル読み取り |
| WriteFile | ファイル書き込み |
| EditFile | ファイル編集 |
| FindFiles | ファイル検索 |
| SearchText | テキスト検索 |
| Shell | シェルコマンド実行 |
| GoogleSearch | Google 検索 |
| WebFetch | Web ページ取得 |

## エージェント向け設定ファイル

```text
AGENTS.md                  # Gemini CLI が読む指示ファイル
.gemini/settings.json      # プロジェクト設定・MCP サーバー登録
```

### MCP サーバー登録

```json
// .gemini/settings.json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"]
    }
  }
}
```

## 無料枠

個人 Google アカウントで利用可能:

- 60 リクエスト/分
- 1,000 リクエスト/日

## システム要件

- macOS, Linux, Windows
- Node.js 20+
- RAM: 4 GB 以上推奨
