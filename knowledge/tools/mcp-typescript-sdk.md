---
reviewed: 2026-04-18
---

# MCP TypeScript SDK

`@modelcontextprotocol/sdk` — Model Context Protocol のサーバー・クライアント両方を実装する公式 TypeScript SDK。本リポジトリもこれを利用している。

公式: [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) / [npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

## インストールとプロジェクト構成

```bash
pnpm add @modelcontextprotocol/sdk zod
```

- **パッケージ**: `@modelcontextprotocol/sdk`（単一パッケージ。用途別にサブパスインポート）
- **Peer deps**: `zod ^3.25 || ^4.0`（必須。スキーマ層として使われる）
- **Node.js**: `>= 18`（20 LTS 推奨）
- **ESM 専用**: `package.json` に `"type": "module"`、`tsconfig.json` は `"module": "Node16"`（または `NodeNext`）+ `"moduleResolution": "Node16"`
- **サブパスインポートは `.js` 拡張子**: TS ソースからでも `from "@modelcontextprotocol/sdk/server/mcp.js"` と書く

## サーバーのセットアップ

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  { name: "my-server", version: "1.0.0" },
  { capabilities: { logging: {} }, instructions: "..." }
);
```

| 第1引数 `Implementation` | 説明 |
|---|---|
| `name` | サーバー識別名 |
| `version` | サーバーの semver（SDK やプロトコルのバージョンではない）。`initialize` 時にクライアントに渡る |

| 第2引数 `ServerOptions`（任意） | 説明 |
|---|---|
| `capabilities` | 登録だけでは伝わらない追加ケイパビリティを宣言 |
| `instructions` | クライアントがシステムプロンプトに差し込める自由記述。ツール横断の指針（「A を呼ぶ前に B を呼ぶ」等）に使う。個別ツール説明の複製には使わない |

**ライフサイクル**: コンストラクタ → ツール/リソース/プロンプト登録 → `await server.connect(transport)`。`connect` 後はケイパビリティ確定。終了は `server.close()`。

## トランスポート

| トランスポート | サブパス | 用途 |
|---|---|---|
| `StdioServerTransport` | `server/stdio.js` | ローカル子プロセス（Claude Desktop、Claude Code、Codex CLI が起動） |
| `StreamableHTTPServerTransport` | `server/streamableHttp.js` | リモート/ホスト型（HTTP 経由） |
| `SSEServerTransport`（非推奨） | `server/sse.js` | 旧来の SSE。Streamable HTTP に置き換え |

### stdio の注意

stdout には **JSON-RPC フレーム以外を書き込まない**。`console.log()` や debug 出力は必ず `console.error()`（stderr）へ。stdout を汚すとプロトコルが破綻してクライアントが切断する。

### Streamable HTTP

```ts
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
  enableJsonResponse: true,   // SSE ではなく通常 JSON レスポンス
});
```

主なオプション:

| オプション | 説明 |
|---|---|
| `sessionIdGenerator` | ステートフルセッション ID 生成器。`undefined` でステートレス |
| `onsessioninitialized` | セッション初期化時のフック |
| `enableJsonResponse` | `true` で SSE ではなく同期 JSON レスポンス |
| `enableDnsRebindingProtection` | DNS rebinding 対策 |
| `allowedHosts` / `allowedOrigins` | 許可する Host/Origin |

Express/Node HTTP ルート内では `await transport.handleRequest(req, res, req.body)` を呼ぶ。セッションは `mcp-session-id` ヘッダ単位で `Map` 管理し、`initialize` リクエスト（`isInitializeRequest(req.body)`）のときだけ新規 transport を作る。

## ツール登録

```ts
server.registerTool(
  "search",
  {
    title: "Search",
    description: "Search the knowledge base by keyword.",
    inputSchema: { query: z.string() },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => ({
    content: [{ type: "text", text: `results for ${query}` }],
  }),
);
```

### `inputSchema` は **Zod raw shape**

v1 系では `z.object({...})` でラップせず、`{ x: z.number() }` のような**シェイプオブジェクト**を渡す。SDK が内部で `z.object` 相当にラップし、`zod-to-json-schema` で JSON Schema に変換する。

> `z.object(...)` を渡すと二重ラップで JSON Schema が壊れる。v2 では逆に object を期待する API 変更が計画されている点に注意。

### `outputSchema`

宣言した場合、ハンドラは `structuredContent` も併せて返す必要がある。

### `annotations`

**クライアントへのヒント**。サーバーの挙動は変わらず、自動承認の判断やウォーニング表示に使われる。**認可には絶対に使わない**。

| フィールド | 意味 |
|---|---|
| `readOnlyHint` | 状態を変更しない。クライアントは auto-approve 可能 |
| `destructiveHint` | 不可逆な破壊操作（削除・DROP）。ユーザー確認が期待される。`readOnlyHint=false` のときのみ意味を持つ |
| `idempotentHint` | 同じ引数で同じ効果（再試行安全） |
| `openWorldHint` | 外部世界（Web、サードパーティ API）にアクセス。非決定性・副作用の示唆 |

## リソース登録

```ts
// 静的
server.registerResource(
  "config",
  "config://app",
  { title: "App Config", mimeType: "application/json" },
  async (uri) => ({ contents: [{ uri: uri.href, text: await readConfig() }] }),
);

// テンプレート（URI パラメータ）
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

server.registerResource(
  "user-profile",
  new ResourceTemplate("user://{userId}/profile", { list: undefined }),
  { title: "User Profile" },
  async (uri, { userId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(await getUser(userId)) }],
  }),
);
```

`ResourceTemplate` に `list` を渡すと `resources/list` で具体インスタンスを露出。`complete` で引数補完を提供できる。

## プロンプト登録

```ts
server.registerPrompt(
  "code-review",
  {
    title: "Code Review",
    argsSchema: { file: z.string() },
  },
  async ({ file }) => ({
    messages: [
      { role: "user", content: { type: "text", text: `Review ${file}` } },
    ],
  }),
);
```

`argsSchema` もツールと同じく Zod raw shape。補完サポートは `@modelcontextprotocol/sdk/server/completable.js` の `completable(z.string(), (value) => [...])` でラップする。

## 返り値（CallToolResult）

```ts
{
  content: [
    { type: "text", text: "..." }
    | { type: "image", data: "<base64>", mimeType: "image/png" }
    | { type: "audio", data: "<base64>", mimeType: "audio/wav" }
    | { type: "resource", resource: { uri, text?, blob?, mimeType? } }
    | { type: "resource_link", uri, name?, description?, mimeType? }
  ],
  structuredContent?: {},  // outputSchema 宣言時は必須
  isError?: boolean,
  _meta?: Record<string, unknown>,
}
```

`content` は順序付き配列。LLM は全要素を読む。**大きな blob は inline せず `resource_link` で参照させる**のがベストプラクティス。

## エラーハンドリング

2 つの表現を使い分ける:

| ケース | 方法 | クライアント/LLM の体験 |
|---|---|---|
| **ツール実行失敗**（想定内エラー: 不正入力、上流 4xx/5xx、ファイル不在） | `{ content: [{ type: "text", text: "error message" }], isError: true }` を返す | 成功応答 + `isError: true`。LLM はメッセージを読んでリトライ/リカバリ判断できる |
| **プロトコル/プログラマエラー**（バリデーション、不変条件違反、致命） | ハンドラ内で `throw` | SDK が JSON-RPC エラー応答に変換。LLM には自然言語が渡らない |

**原則**: モデルに反応させたい → `isError: true`。クライアントに hard fail として扱わせたい → `throw`。Zod による入力バリデーション失敗は SDK がハンドラ実行前に自動で throw する。

## LLM がよくやる 3 大ミス

1. **`z.object({...})` を `inputSchema` に渡す**
   - v1 系は raw shape（`{ x: z.number() }`）を期待。ラップすると JSON Schema が壊れる
2. **stdio サーバーで stdout に書き込む**（`console.log`、print 等）
   - JSON-RPC フレーミングを破壊してクライアントが切断。ログは必ず `console.error`
3. **ESM 構成ミス**（`.js` 拡張子忘れ、CJS のまま）
   - SDK は ESM 専用。`"type": "module"`、サブパスは `.js` 付きで書く

その他: ユーザー向けエラーで throw して LLM がコンテキストを失う、リクエスト毎に新 transport を作ってしまい Streamable HTTP のセッション継続が切れる、安全なツールに `readOnlyHint` を付け忘れて auto-approve が効かない。

## テスト

### InMemoryTransport による in-process 結合テスト（推奨デフォルト）

```ts
import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";

it("calls greet", async () => {
  const server = new McpServer({ name: "t", version: "0.0.0" });
  server.registerTool(
    "greet",
    { inputSchema: { name: z.string() } },
    async ({ name }) => ({ content: [{ type: "text", text: `hi ${name}` }] }),
  );

  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "c", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);

  const res = await client.callTool({ name: "greet", arguments: { name: "Ada" } });
  expect(res.content[0]).toMatchObject({ type: "text", text: "hi Ada" });
});
```

ソケットやサブプロセスを使わず、スキーマ検証・ケイパビリティネゴシエーション・シリアライズをすべて通す。vitest のデフォルトとして妥当。

### ハンドラ単体テスト

純粋なロジックは、ハンドラを名前付き関数として切り出してテストできる。高速だが SDK のバリデーションを迂回するため、**サーバー単位で最低 1 本は in-process 結合テスト**を併用すること。

## v1 / v2 の注意

v2 系（開発中）ではパッケージが分割（`@modelcontextprotocol/server` / `/client` / `/core`）され、`inputSchema` は完全な Zod object を受け取る形に変わる予定。`InMemoryTransport` は `@modelcontextprotocol/core` へ移動。stable は当面 v1 系（本記事は v1.12+ 基準、現行 npm latest は 1.29.0 ラインを想定）。
