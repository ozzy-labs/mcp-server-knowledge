# mcp-server-knowledge

検証済みの最新ナレッジを MCP サーバーとして AI エージェントに提供するローカルサーバー。

## 解決する課題

AI エージェントの学習データは急速に陳腐化する。セッションごとに最新情報を調査すると時間とコンテキストウィンドウを浪費する。mcp-server-knowledge は検証済みのナレッジを MCP ツールで即時提供し、この問題を解消する。

## 主な機能

- **構造化ナレッジ**: 階層的なディレクトリと Frontmatter (YAML) による高度な属性管理。
- **高性能な検索・推薦**: 単純なキーワード検索に加え、タグやディレクトリ構造、エイリアスに基づく関連ドキュメントの推薦機能。
- **堅牢なセキュリティ**: 厳格なパス検証により、AI エージェントによる意図しないファイルアクセス（Path Traversal）を完全に防止。
- **自動バリデーション**: スキーマ検証により、ナレッジの整合性を常に保証。
- **マルチエージェント対応**: Claude Code, Codex, Gemini, GitHub Copilot 等、主要な MCP クライアントをサポート。

## ドキュメント

- [Architecture](./docs/architecture.md) - 技術詳細、セキュリティ設計、テスト戦略。
- [User Guide](./docs/user-guide.md) - ナレッジ記事の書き方、ディレクトリ構成ルール。

## MCP ツール

| ツール | 説明 | 主な引数 |
| :--- | :--- | :--- |
| `list` | ディレクトリ構造の探索。 | `path`: 探索するディレクトリ（オプション） |
| `read` | 記事全文の取得。 | `path`: 記事の相対パス（拡張子なし） |
| `search` | 全記事を対象とした全文検索。 | `query`: キーワード. `tags`: 特定のタグでフィルタ（AND）. `category`: 検索範囲を限定 |
| `related` | 関連ドキュメントの推薦。 | `path`: 基準となる記事のパス. `limit`: 最大取得件数 |

## セットアップ

### ローカルでビルドして利用する場合（現時点の推奨）

```bash
# 依存関係のインストール
pnpm install

# ビルド
pnpm run build

# 各エージェントから dist/index.js を指定（次節を参照）
```

### npm から利用する場合（将来予定）

`@ozzylabs/mcp-server-knowledge` の npm レジストリへの公開は将来対応予定。現時点では未公開のため、上記のローカルビルドで利用する。

## エージェントへの登録（ローカルパス指定の場合）

各エージェントのグローバル MCP 設定に一度登録する。

### Claude Code

```bash
claude mcp add --transport stdio knowledge --scope user -- node /path/to/mcp-server-knowledge/dist/index.js
```

`~/.claude.json` の top-level `mcpServers` に登録される。

### Codex CLI

```toml
# ~/.codex/config.toml
[mcp_servers.knowledge]
command = "node"
args = ["/path/to/mcp-server-knowledge/dist/index.js"]
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

### GitHub Copilot CLI

```json
// ~/.copilot/mcp-config.json
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
├── tools/          ← 言語非依存の汎用 CLI / lint / format / package 等
├── standards/      ← 一般的な規約・プラクティス・設計方針
├── languages/
│   ├── go/         ← Go 言語本体 + Go エコシステム（golangci-lint, gopls, goreleaser, ...）
│   ├── js/         ← Node.js / TypeScript ESM + JS/TS エコシステム（Biome, Vitest, pnpm, ...）
│   ├── python/     ← Python 本体 + uv 等
│   └── bash/       ← Bash 本体 + bats / shellcheck / shfmt
├── platforms/
│   ├── github/     ← GitHub Actions / gh CLI / gh-extensions / actionlint
│   ├── aws/        ← AWS CLI 等
│   └── docker/     ← Docker 本体
└── ai/
    ├── agents/     ← AI コーディングエージェント CLI（Claude Code, Codex, Gemini, Copilot 等）
    ├── platform/   ← AI プラットフォーム・SDK・プロトコル（Anthropic API, MCP 等）
    ├── workflow/   ← AI 駆動開発ワークフロー / SDD ツール
    └── practice/   ← AI 駆動開発の方法論・運用パターン
```

カテゴリ判定ルール:

- **言語専用ツール** → `languages/<lang>/` 配下（例: `golangci-lint` は Go 専用 → `languages/go/`）
- **プラットフォーム専用ツール** → `platforms/<platform>/` 配下（例: `actionlint` は GitHub Actions 専用 → `platforms/github/`）
- **言語非依存の汎用ツール** → `tools/` flat（例: `mise`, `jq`, `lefthook`, `trivy`）

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
