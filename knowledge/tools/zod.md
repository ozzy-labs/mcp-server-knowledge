---
reviewed: 2026-04-18
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
z.string().email();
z.string().url();
z.string().uuid();
z.string().regex(/^[a-z]+$/);
z.string().startsWith("https://");
z.string().datetime();        // ISO 8601
z.string().trim();            // パース時に trim
z.string().toLowerCase();     // パース時に変換
```

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
    // フラット化（フィールド → エラーメッセージ配列）
    const flat = e.flatten();
    // ネスト形式
    const formatted = e.format();
  }
}
```

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

本記事は **v3 系**（2026-04 時点で `zod@3.25+` が主流）を前提。v4（alpha/beta）で予定されている変更:

- パッケージ分割（`zod/v4`、`zod-mini`）
- エラーフォーマッタの刷新
- `z.discriminatedUnion` の多段対応
- パフォーマンス改善
- 一部メソッド名の整理

**2026-04 現在**: プロダクションは v3 推奨。ライブラリ開発では peer dep を `zod@^3.25 || ^4.0` にしておくと両対応可能（MCP SDK もそうしている）。

## よくある誤り

1. **`z.object({}).parse(undefined)` で落ちる** — `z.object({}).optional()` を使うか `safeParse` で握る
2. **`transform` の中で副作用**（DB 呼び出し等） — パースは純粋関数であるべき。副作用は別レイヤーで
3. **`z.record(z.string())` を `Record<string, string>` と混同** — `z.record(keySchema, valueSchema)` は v3.23+ の 2 引数形式。1 引数だと values のみ
4. **`z.literal([...])` が使えない** — literal は単一値用。複数は `z.union([z.literal(...), ...])` または `z.enum([...])`
5. **`z.enum()` に非 readonly 配列を渡す** — `z.enum(["a", "b"] as const)` と const assertion を付ける

## 他ライブラリとの比較

| 観点 | Zod | Yup | io-ts | Valibot |
|---|---|---|---|---|
| 型推論 | 強力 | 弱め | 強力 | 強力 |
| 書き味 | 手続き的 | チェーン | 関数合成 | 関数合成 |
| バンドルサイズ | 中 | 中 | 中 | 小（tree-shake） |
| エコシステム | 大 | 大 | 小 | 中（成長中） |
| 変換 | あり | あり | あり | あり |

TypeScript プロジェクトでは Zod がデファクト。バンドルサイズが厳しい場合は Valibot が代替候補。
