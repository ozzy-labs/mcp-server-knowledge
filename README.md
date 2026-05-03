# knowledge-mcp-server

検証済みの最新ナレッジを MCP サーバーとして AI エージェントに提供するローカルサーバー。

## 解決する課題

AI エージェントの学習データは急速に陳腐化する。セッションごとに最新情報を調査すると時間とコンテキストウィンドウを浪費する。knowledge-mcp-server は検証済みのナレッジを MCP ツールで即時提供し、この問題を解消する。

## MCP ツール

| ツール | 説明 |
|---|---|
| `list` | カテゴリ一覧、またはカテゴリ内のファイル一覧を取得 |
| `read` | 指定したナレッジの全文を取得 |
| `search` | キーワードでナレッジを検索 |

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm run build
```

## エージェントへの登録

各エージェントのグローバル MCP 設定に一度登録する。

> **旧リポジトリ名からの移行**: 旧名 `mcp-server-knowledge` を参照している既存の MCP 設定は、各エージェントの設定ファイルで `/path/to/knowledge-mcp-server/` にパスを置換してください（`@ozzylabs/mcp-server-knowledge` を npm から入れている場合は `@ozzylabs/knowledge-mcp-server` にパッケージ名も差し替え）。旧 npm パッケージは `npm deprecate` で案内済み。

### Claude Code

```bash
claude mcp add --transport stdio knowledge --scope user -- node /path/to/knowledge-mcp-server/dist/index.js
```

`~/.claude.json` の top-level `mcpServers` に登録される。

### Codex CLI

```toml
# ~/.codex/config.toml
[mcp_servers.knowledge]
command = "node"
args = ["/path/to/knowledge-mcp-server/dist/index.js"]
```

### Gemini CLI

```json
// ~/.gemini/settings.json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/knowledge-mcp-server/dist/index.js"]
    }
  }
}
```

### GitHub Copilot CLI

```json
// ~/.copilot/mcp-config.json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/knowledge-mcp-server/dist/index.js"]
    }
  }
}
```

## ナレッジ構成

```text
knowledge/
├── tools/          ← 一般 CLI / lint / format / build / package / version manager 等
├── standards/      ← 一般的な規約・プラクティス・設計方針
├── languages/      ← プログラミング言語固有の知識
├── platforms/      ← クラウド / プラットフォーム / サービス
└── ai/
    ├── agents/     ← AI コーディングエージェント CLI（Claude Code, Codex, Gemini, Copilot 等）
    ├── platform/   ← AI プラットフォーム・SDK・プロトコル（Anthropic API, MCP 等）
    ├── workflow/   ← AI 駆動開発ワークフロー / SDD ツール
    └── practice/   ← AI 駆動開発の方法論・運用パターン
```

収録記事は MCP `list` ツール経由で取得する（AI エージェントが本リポの主たる利用者）。人間がローカルで一覧を眺めたい場合のみ `pnpm run generate-index` で `knowledge/INDEX.md` を生成できる（`.gitignore` 対象、git にコミットしない）。

## 開発

```bash
pnpm run dev          # ビルド（ウォッチモード）
pnpm run build        # プロダクションビルド
pnpm run typecheck    # 型チェック
pnpm run test         # テスト実行
pnpm run test:watch   # テスト（ウォッチモード）
```

## 運用

- **ナレッジ更新**: `knowledge/` を編集 → commit → 他マシンで pull
- **マルチマシン**: clone するだけで同じ環境を再現

## ライセンス

MIT
