# mcp-server-knowledge

検証済みの最新ナレッジを MCP サーバーとして AI エージェントに提供するローカルサーバー。

## 解決する課題

AI エージェントの学習データは急速に陳腐化する。セッションごとに最新情報を調査すると時間とコンテキストウィンドウを浪費する。mcp-server-knowledge は検証済みのナレッジを MCP ツールで即時提供し、この問題を解消する。

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

### Claude Code

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

### Gemini CLI

```json
// ~/.gemini/settings.json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

## ナレッジ構成

```text
knowledge/
├── tools/          ← AI CLI ツールの使い方・設定リファレンス
├── standards/      ← 規約・プラクティス
├── languages/      ← 言語固有の知識
└── platforms/      ← プラットフォーム・サービス
```

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
