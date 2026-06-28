---
reviewed: 2026-06-28
tags: [ai-workflow, methodology]
---

# Model Context Protocol (MCP)

Anthropic が 2024 年に発表したオープン規格。AI エージェント（クライアント）と外部コンテキスト・ツール（サーバー）を標準化されたプロトコルで接続する。USB-C のように「1 本のインタフェースで多様な周辺機器につなぐ」イメージ。

公式: [modelcontextprotocol.io](https://modelcontextprotocol.io/)

最新仕様は **2025-11-25** リビジョン（前版: 2025-06-18 / 2025-03-26）。本記事は 2025-11-25 基準。2025年12月9日、Anthropic は MCP を **Agentic AI Foundation**（Linux Foundation 傘下のディレクテッドファンド）に寄贈し、OpenAI・Block 等と共同でベンダー中立のコミュニティガバナンスに移行した。仕様の技術的意思決定は引き続き既存のメンテナーと SEP プロセスが担う。

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

Sampling / Elicitation はクライアント（Claude Code 等）が capability として宣言した場合のみ使える。2025-11-25 で **Tasks**（experimental、durable request の polling / deferred 取得）が追加され、Sampling は `tools` / `toolChoice` パラメータによる tool calling に拡張、Elicitation は URL mode と single/multi-select enum に対応した。

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
  - `openWorldHint: true` — 外部世界へのアクセス（Web 等）。2025-11-25 ではツール / リソース / プロンプトに `icons` メタデータも付与可能。spec はクライアントに「サーバー側 annotations は untrusted として扱え」と明記
- **エラーは `isError: true` + 人間可読な text で返す**: LLM がリカバリ戦略を選べる
- **返り値は text / image / resource**: 構造化データでも text として JSON を返すのが一般的

## リソース vs ツール

同じデータを提供する場合、どちらで実装するか:

- **ツール**: エージェントが能動的に選択して呼び出す。引数でクエリ可能
- **リソース**: セッション開始時や `@mention` でコンテキストに追加。静的・準静的データに向く

DB の行検索 → ツール。プロジェクトの README → リソース。

## 認証・セキュリティ

- **ローカル stdio**: プロセス起動時の環境変数で API キーを渡す（`env` フィールド）
- **リモート HTTP**: OAuth 2.0 + PKCE が **2025-06-18 で正式採用**。2025-11-25 では OpenID Connect Discovery 1.0、`WWW-Authenticate` 経由のインクリメンタル scope 同意、OAuth Client ID Metadata Documents（動的登録代替）に対応
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

## MCP 拡張（Extensions）

2026年1月、**MCP Apps** が最初の公式 MCP 拡張として発表された。コアプロトコルを変更せず、ツールが `_meta.ui.resourceUri` フィールドで `ui://` スキームの UI リソースを指すことで、インタラクティブな React ベースの UI（ダッシュボード・フォーム・可視化等）をレスポンスとして返せる。Claude・ChatGPT・VS Code・Goose 等が対応済み。

## 次リビジョン（2026-07-28 RC）

2026-05-29 に **2025-11-25 以来最大の改訂**となる 2026-07-28 リビジョンの RC（release candidate）が公開された。RC は 2026-05-21 にロックされ、最終リリースは **2026-07-28** 予定（SDK の追従はバージョンごとに任意ペース）。RC に確定取り込みされた主要 SEP:

- **SEP-2577 (Final, 2026-05-15 merge)**: Roots / Sampling / Logging を **deprecation 入り**。既存実装は migration window 中は引き続き動作するが、新規実装は非推奨。
- **SEP-2663**: Tasks をコアプロトコルから公式 extension `io.modelcontextprotocol/tasks` に切り出し。blocking `tasks/result` を polling `tasks/get` に置換、`tasks/update` 追加、`tasks/list` 削除。
- **SEP-2575**: `initialize` / `notifications/initialized` を削除して **stateless 化**。各リクエストが `_meta.io.modelcontextprotocol/protocolVersion` でプロトコル情報を運び、新設の `server/discover` RPC が必須化。
- **SEP-2567**: Streamable HTTP の protocol-level セッションと `Mcp-Session-Id` ヘッダを廃止。state が必要なサーバーは tool 引数経由で handle を渡す。
- **SEP-2322**: **MRTR (Multi Round-Trip Requests)** パターンを導入。サーバーが `inputRequests`（新 resultType）を返し、クライアントが次リクエストで `inputResponses` を返す形で、従来の server-initiated `roots/list` / `sampling/createMessage` / `elicitation/create` を置き換える。
- **SEP-2549**: `tools/list` 等に `ttlMs` と `cacheScope`（public/private）を追加してクライアントキャッシュをヒント化。
- **SEP-2243**: Streamable HTTP POST に `Mcp-Method` / `Mcp-Name` ヘッダを必須化、`x-mcp-header` で tool パラメータからのカスタムヘッダ対応。

あわせて **feature lifecycle / deprecation policy**（SEP-2596）が正式採択され、Active / Deprecated / Removed の 3 状態と最低 **12 か月の deprecation window** が定義された。HTTP+SSE トランスポートもこのポリシー下で正式に Deprecated へ再分類。Extensions は reverse-DNS 識別子と独立バージョニングの正式プロセス（SEP-2133）を獲得し、MCP Apps（SEP-1865）と Tasks（SEP-2663）が公式 extension として同梱される。

詳細は [modelcontextprotocol.io/specification/draft/changelog](https://modelcontextprotocol.io/specification/draft/changelog)、[2026-07-28 RC blog](https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/)、[SEP リポジトリ](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/seps) を参照。

## 参考実装

- **reference servers**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)（filesystem、GitHub、Slack 等）
- **SDK**: TypeScript / Python / C# / Go（Tier 1）/ Java / Rust（Tier 2）/ Swift / Ruby / PHP（Tier 3）/ Kotlin（TBD）
- **Inspector**: `npx @modelcontextprotocol/inspector <command>` でサーバーを対話デバッグ
