---
reviewed: 2026-05-04
tags: [library, typescript]
---

# Zod

TypeScript ファーストのスキーマ宣言・バリデーションライブラリ。ランタイム検証と型推論を同じスキーマで実現する。MCP SDK のツール入力スキーマなど、本リポジトリでも中心的に使用。

公式: [zod.dev](https://zod.dev/)

## インストール

```bash
pnpm add zod
```

- **Zero dependency**
- **TypeScript 4.5+** 推奨（`strict: true` 前提）

## 基本パターン

```ts
import { z } from "zod";

const User = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().nonnegative().optional(),
});

// 型推論
type User = z.infer<typeof User>;
//   ^? { id: string; name: string; email: string; age?: number }

// バリデーション
const result = User.safeParse(input);
if (!result.success) {
  console.error(result.error.issues);
} else {
  const user: User = result.data;
}
```

## `parse` vs `safeParse`

| メソッド | 挙動 |
|---|---|
| `.parse(data)` | 成功時はパース済み値、失敗時は `ZodError` を throw |
| `.safeParse(data)` | `{ success: true, data } \| { success: false, error }` を返す |
| `.parseAsync` / `.safeParseAsync` | 非同期バリデータを含む場合 |

例外を避けたい境界（API ハンドラ等）では `safeParse`。

## プリミティブ

```ts
z.string()            // string
z.number()            // number
z.bigint()            // bigint
z.boolean()           // boolean
z.date()              // Date
z.null()              // null
z.undefined()         // undefined
z.void()              // undefined
z.any()               // any
z.unknown()           // unknown
z.never()             // never
```

### 文字列の絞り込み

```ts
z.string().min(1).max(100);
z.string().regex(/^[a-z]+$/);
z.string().startsWith("https://");
z.string().trim();            // パース時に trim
z.string().toLowerCase();     // パース時に変換
```

### 文字列フォーマット（v4 から top-level 関数）

v4 では `z.string().email()` などのメソッド形式は **deprecated**。フォーマット系は専用クラスとして top-level 関数に移行した。

```ts
z.email();
z.url();
z.uuid();           // RFC 9562/4122 厳格化（v3 より厳しい）
z.ipv4();
z.ipv6();
z.base64();
z.base64url();      // padding 不可
z.iso.datetime();   // ISO 8601
```

v3 のメソッド形式は当面動くが、新規コードは top-level を使う。

### 数値の絞り込み

```ts
z.number().int().positive().lt(100);
z.number().finite();           // Infinity 除外
z.number().safe();             // Number.MAX_SAFE_INTEGER 範囲
```

## オブジェクト

```ts
const Config = z.object({
  host: z.string(),
  port: z.number().int(),
  tls: z.boolean().default(false),
});

Config.partial();              // すべて optional
Config.required();             // すべて required
Config.pick({ host: true });   // host のみ
Config.omit({ tls: true });    // tls 以外
Config.extend({ token: z.string() });
Config.merge(z.object({ env: z.string() }));
Config.strict();               // 未知キーを拒否
Config.passthrough();          // 未知キーを残す
Config.strip();                // 未知キーを削除（デフォルト）
```

## 配列とタプル

```ts
z.array(z.string());
z.string().array();            // 同上（メソッドチェーン）
z.array(z.string()).min(1).max(10).nonempty();

z.tuple([z.string(), z.number()]);                  // [string, number]
z.tuple([z.string()]).rest(z.number());             // [string, ...number[]]
```

## Union / Discriminated union

```ts
z.union([z.string(), z.number()]);
z.string().or(z.number());     // 同上

// discriminated union（高速、エラーメッセージも明確）
const Event = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("keydown"), key: z.string() }),
]);
```

## Record / Map / Set

```ts
z.record(z.string(), z.number());     // { [k: string]: number }
z.map(z.string(), z.number());        // Map<string, number>
z.set(z.number());                    // Set<number>
```

v4 では `z.record(valueSchema)` の **1 引数形式は廃止**。必ず `z.record(keySchema, valueSchema)` の 2 引数で呼ぶ。enum をキーにすると exhaustiveness が要求されるので、欠落を許す場合は `z.partialRecord(...)` を使う。

## Optional / Nullable / Default

```ts
z.string().optional();                // string | undefined
z.string().nullable();                // string | null
z.string().nullish();                 // string | null | undefined
z.string().default("anonymous");      // 欠けていたらデフォルト
```

## 変換（transform）とリファイン（refine）

```ts
// transform: パース時に値を変換（型も変わる）
const IntFromString = z.string().transform((s) => parseInt(s, 10));

// refine: 追加の検証ルール
const Password = z.string().refine(
  (s) => /[A-Z]/.test(s) && /[0-9]/.test(s),
  { message: "Password needs uppercase and a digit" },
);

// 複数フィールド横断
const Form = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
```

## エラーのハンドリング

```ts
const result = User.safeParse(input);
if (!result.success) {
  const { issues } = result.error;
  // issues: Array<{ code, path, message, ... }>
}
```

### `ZodError` の整形

```ts
import { z } from "zod";

try {
  User.parse(input);
} catch (e) {
  if (e instanceof z.ZodError) {
    // 平文フォーマット
    console.log(e.message);
    // 構造化
    for (const issue of e.issues) {
      console.log(`${issue.path.join(".")}: ${issue.message}`);
    }
    // v4: ツリー形式（推奨）
    const tree = z.treeifyError(e);
    // v3 互換: e.flatten() / e.format() は v4 で deprecated。
  }
}
```

v4 では `e.flatten()` / `e.format()` は deprecated、`.formErrors` / `.errors` は削除。代わりに top-level の `z.treeifyError(error)` を使う。

## z.infer と z.input / z.output

```ts
const Trimmed = z.string().trim();

type In = z.input<typeof Trimmed>;   // string
type Out = z.output<typeof Trimmed>; // string（同じ）

const ParsedInt = z.string().transform((s) => parseInt(s, 10));
type InI = z.input<typeof ParsedInt>;   // string
type OutI = z.output<typeof ParsedInt>; // number
```

`z.infer<T>` は `z.output<T>` のエイリアス。

## JSON Schema との相互変換

- **Zod → JSON Schema**: `zod-to-json-schema`（MCP SDK は内部でこれを使う）
- **JSON Schema → Zod**: `json-schema-to-zod`

## MCP ツールでの使い方

`@modelcontextprotocol/sdk` v1 系の `inputSchema` は **Zod raw shape**（`z.object()` でラップしない）:

```ts
server.registerTool(
  "search",
  {
    inputSchema: { query: z.string(), limit: z.number().int().optional() },
  },
  async ({ query, limit }) => ({ content: [{ type: "text", text: "..." }] }),
);
```

詳細は `ai/platform/mcp-typescript-sdk.md` 参照。

## v3 と v4 の差

**2026-05 現在**: `zod@4` が stable。最新は `zod@4.4.2`（2026-05-01 リリース）。新規プロジェクトは v4 を推奨。

主な破壊的変更:

- **文字列フォーマット**: `z.string().email()` → `z.email()` の top-level 関数化。`z.uuid()` は RFC 9562/4122 厳格化。
- **`z.record()`**: 1 引数形式を廃止、`z.record(keySchema, valueSchema)` 必須。enum キーで exhaustiveness 強制。
- **エラー API**: `e.flatten()` / `e.format()` deprecated。`z.treeifyError()` へ移行。`.formErrors` / `.errors` は削除。
- **パッケージ分割**: `zod`（メイン）、`zod/v4/core`（コアユーティリティ）、`zod-mini`（軽量版・tree-shake 重視）。
- **パフォーマンス**: パース速度・型推論ともに大幅改善。

**ライブラリ開発の peer dep**: 当面 `zod@^3 || ^4` で両対応する選択もある（MCP SDK 等）。アプリケーション側は v4 へ移行を推奨。

詳細な移行手順は公式の [v4 changelog](https://zod.dev/v4/changelog) を参照。

## よくある誤り

1. **`z.object({}).parse(undefined)` で落ちる** — `z.object({}).optional()` を使うか `safeParse` で握る
2. **`transform` の中で副作用**（DB 呼び出し等） — パースは純粋関数であるべき。副作用は別レイヤーで
3. **v4 で `z.record(z.string())` が動かない** — v4 は 2 引数必須。`z.record(z.string(), z.string())` と書く
4. **v4 でも `z.string().email()` を書く** — 動くが deprecated。新規は `z.email()` を使う
5. **`z.literal([...])` が使えない** — literal は単一値用。複数は `z.union([z.literal(...), ...])` または `z.enum([...])`
6. **`z.enum()` に非 readonly 配列を渡す** — `z.enum(["a", "b"] as const)` と const assertion を付ける

## 他ライブラリとの比較

| 観点 | Zod | Yup | io-ts | Valibot |
|---|---|---|---|---|
| 型推論 | 強力 | 弱め | 強力 | 強力 |
| 書き味 | 手続き的 | チェーン | 関数合成 | 関数合成 |
| バンドルサイズ | 中 | 中 | 中 | 小（tree-shake） |
| エコシステム | 大 | 大 | 小 | 中（成長中） |
| 変換 | あり | あり | あり | あり |

TypeScript プロジェクトでは Zod がデファクト。バンドルサイズが厳しい場合は Valibot が代替候補。
