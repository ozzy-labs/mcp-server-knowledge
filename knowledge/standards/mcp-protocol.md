---
reviewed: 2026-04-18
---

# Model Context Protocol (MCP)

Anthropic が 2024 年に発表したオープン規格。AI エージェント（クライアント）と外部コンテキスト・ツール（サーバー）を標準化されたプロトコルで接続する。USB-C のように「1 本のインタフェースで多様な周辺機器につなぐ」イメージ。

公式: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

## アーキテクチャ

```text
┌─────────────────┐         stdio / HTTP        ┌────────────────┐
│   MCP Client    │ ◄──────── JSON-RPC ────────► │   MCP Server   │
│ (Claude Code,   │                              │  (DB, API,     │
│  Codex, Gemini) │                              │  file system)  │
└─────────────────┘                              └────────────────┘
```

- **ホスト**: エージェントアプリそのもの（Claude Code 等）
- **クライアント**: ホスト内で 1 つの MCP サーバーと 1:1 接続を持つ
- **サーバー**: ツール・リソース・プロンプトを提供するプロセス

## プリミティブ

### コア 3 種

| プリミティブ | 用途 | エージェント側の扱い |
|---|---|---|
| **Tools** | 副作用を伴う動作（DB 書き込み、API 呼び出し） | LLM がツール呼び出しを選択 |
| **Resources** | 読み取り専用データ（ファイル、クエリ結果、ドキュメント） | コンテキストに添付 |
| **Prompts** | 再利用可能なプロンプトテンプレート | ユーザーがスラッシュコマンド等で起動 |

それぞれ `list` と `read/call/get` の RPC メソッドペアを持つ。

### 拡張プリミティブ

サーバーがクライアント側に能動的に働きかける仕組み:

| プリミティブ | 用途 |
|---|---|
| **Sampling** | サーバーがクライアント（ホスト LLM）に推論を依頼。サーバー内で LLM を持たずにエージェントの知能を借りる |
| **Elicitation** | サーバーがユーザーに追加情報を要求。フォームやプロンプトで不足パラメータを補う |
| **Logging** | サーバーが構造化ログをクライアントに送る。デバッグ・監査用 |
| **Roots** | クライアントがサーバーにアクセス許可するファイルシステム境界を通知 |

Sampling / Elicitation はクライアント（Claude Code 等）が capability として宣言した場合のみ使える。

## トランスポート

| トランスポート | 用途 |
|---|---|
| **stdio** | ローカルプロセスを子プロセスとして起動。最もシンプル |
| **HTTP with SSE**（レガシー） | リモートサーバー向け。Server-Sent Events |
| **Streamable HTTP**（推奨） | HTTP で双方向ストリーム。認証・マルチテナント向き |

stdio はローカルエージェント、Streamable HTTP はクラウドホスト型サーバー（`mcp.anthropic.com/*` 等）に使う。

## 典型的な RPC フロー

```text
1. Client → Server: initialize
2. Server → Client: capabilities
3. Client → Server: tools/list
4. Server → Client: [{ name, description, inputSchema }, ...]
5. Client → Server: tools/call { name, arguments }
6. Server → Client: { content: [{ type: "text", text: "..." }] }
```

## サーバー実装の最小例（TypeScript SDK）

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer(
  { name: "my-server", version: "0.1.0" },
  { instructions: "Describe how agents should use this server." }
);

server.registerTool(
  "echo",
  {
    title: "Echo",
    description: "Echo back the input string.",
    inputSchema: { message: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ message }) => ({
    content: [{ type: "text", text: message }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## ツール設計のベストプラクティス

- **description はエージェント向け**: LLM がこれを読んで使い方を判断する。使い所・引数の意味・返り値の形を明示
- **inputSchema は Zod / JSON Schema で厳格に**: LLM のハルシネーションを減らす
- **annotations を活用**:
  - `readOnlyHint: true` — 副作用なし（ツール承認を緩める根拠）
  - `destructiveHint: true` — データを削除・変更
  - `idempotentHint: true` — 同一呼び出しで同一結果
- **エラーは `isError: true` + 人間可読な text で返す**: LLM がリカバリ戦略を選べる
- **返り値は text / image / resource**: 構造化データでも text として JSON を返すのが一般的

## リソース vs ツール

同じデータを提供する場合、どちらで実装するか:

- **ツール**: エージェントが能動的に選択して呼び出す。引数でクエリ可能
- **リソース**: セッション開始時や `@mention` でコンテキストに追加。静的・準静的データに向く

DB の行検索 → ツール。プロジェクトの README → リソース。

## 認証・セキュリティ

- **ローカル stdio**: プロセス起動時の環境変数で API キーを渡す（`env` フィールド）
- **リモート HTTP**: OAuth 2.0 + PKCE が標準化されつつある
- **危険ツールの分離**: エージェント側で `destructiveHint` や tool-per-approval で制御
- **プロンプトインジェクション**: サーバーが返す text はユーザー入力と同等に信頼しない

## 主要 MCP クライアント

| クライアント | 登録先 |
|---|---|
| Claude Code | `~/.claude.json` の `mcpServers` / `claude mcp add` |
| Codex CLI | `~/.codex/config.toml` の `[mcp_servers.*]` |
| Gemini CLI | `~/.gemini/settings.json` の `mcpServers` |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` の `mcpServers` |
| Cursor | `.cursor/mcp.json` |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` |

## 参考実装

- **reference servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)（filesystem、GitHub、Slack 等）
- **SDK**: TypeScript / Python / Go / Rust / Kotlin / Swift
- **Inspector**: `npx @modelcontextprotocol/inspector <command>` でサーバーを対話デバッグ
