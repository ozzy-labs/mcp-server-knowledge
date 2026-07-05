---
reviewed: 2026-05-04
tags: [library, typescript]
---

# Zod

A TypeScript-first schema declaration and validation library. It achieves runtime validation and type inference from the same schema. Used centrally in this repository as well, e.g. for MCP SDK tool input schemas.

Official site: [zod.dev](https://zod.dev/)

## Installation

```bash
pnpm add zod
```

- **Zero dependency**
- **TypeScript 4.5+** recommended (assumes `strict: true`)

## Basic pattern

```ts
import { z } from "zod";

const User = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().nonnegative().optional(),
});

// Type inference
type User = z.infer<typeof User>;
//   ^? { id: string; name: string; email: string; age?: number }

// Validation
const result = User.safeParse(input);
if (!result.success) {
  console.error(result.error.issues);
} else {
  const user: User = result.data;
}
```

## `parse` vs `safeParse`

| Method | Behavior |
|---|---|
| `.parse(data)` | Returns the parsed value on success, throws `ZodError` on failure |
| `.safeParse(data)` | Returns `{ success: true, data } \| { success: false, error }` |
| `.parseAsync` / `.safeParseAsync` | For validators that include async logic |

Use `safeParse` at boundaries (e.g. API handlers) where you want to avoid exceptions.

## Primitives

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

### String refinements

```ts
z.string().min(1).max(100);
z.string().regex(/^[a-z]+$/);
z.string().startsWith("https://");
z.string().trim();            // trim at parse time
z.string().toLowerCase();     // transform at parse time
```

### String formats (top-level functions since v4)

In v4, method-style forms like `z.string().email()` are **deprecated**. Format-related validators have moved to dedicated top-level functions.

```ts
z.email();
z.url();
z.uuid();           // stricter RFC 9562/4122 compliance (stricter than v3)
z.ipv4();
z.ipv6();
z.base64();
z.base64url();      // no padding allowed
z.iso.datetime();   // ISO 8601
```

The v3 method-style forms still work for now, but new code should use the top-level functions.

### Number refinements

```ts
z.number().int().positive().lt(100);
z.number().finite();           // excludes Infinity
z.number().safe();             // within Number.MAX_SAFE_INTEGER range
```

## Objects

```ts
const Config = z.object({
  host: z.string(),
  port: z.number().int(),
  tls: z.boolean().default(false),
});

Config.partial();              // make all fields optional
Config.required();             // make all fields required
Config.pick({ host: true });   // only host
Config.omit({ tls: true });    // everything except tls
Config.extend({ token: z.string() });
Config.merge(z.object({ env: z.string() }));
Config.strict();               // reject unknown keys
Config.passthrough();          // keep unknown keys
Config.strip();                // strip unknown keys (default)
```

## Arrays and tuples

```ts
z.array(z.string());
z.string().array();            // same, via method chaining
z.array(z.string()).min(1).max(10).nonempty();

z.tuple([z.string(), z.number()]);                  // [string, number]
z.tuple([z.string()]).rest(z.number());             // [string, ...number[]]
```

## Union / Discriminated union

```ts
z.union([z.string(), z.number()]);
z.string().or(z.number());     // same

// discriminated union (faster, clearer error messages)
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

In v4, the single-argument form `z.record(valueSchema)` is **removed**. You must call it with two arguments: `z.record(keySchema, valueSchema)`. Using an enum as the key requires exhaustiveness; use `z.partialRecord(...)` if you want to allow missing keys.

## Optional / Nullable / Default

```ts
z.string().optional();                // string | undefined
z.string().nullable();                // string | null
z.string().nullish();                 // string | null | undefined
z.string().default("anonymous");      // default value when missing
```

## Transform and refine

```ts
// transform: converts the value at parse time (type changes too)
const IntFromString = z.string().transform((s) => parseInt(s, 10));

// refine: adds a custom validation rule
const Password = z.string().refine(
  (s) => /[A-Z]/.test(s) && /[0-9]/.test(s),
  { message: "Password needs uppercase and a digit" },
);

// cross-field validation
const Form = z
  .object({ password: z.string(), confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
```

## Error handling

```ts
const result = User.safeParse(input);
if (!result.success) {
  const { issues } = result.error;
  // issues: Array<{ code, path, message, ... }>
}
```

### Formatting `ZodError`

```ts
import { z } from "zod";

try {
  User.parse(input);
} catch (e) {
  if (e instanceof z.ZodError) {
    // plain-text format
    console.log(e.message);
    // structured
    for (const issue of e.issues) {
      console.log(`${issue.path.join(".")}: ${issue.message}`);
    }
    // v4: tree format (recommended)
    const tree = z.treeifyError(e);
    // v3 compat: e.flatten() / e.format() are deprecated in v4.
  }
}
```

In v4, `e.flatten()` / `e.format()` are deprecated, and `.formErrors` / `.errors` have been removed. Use the top-level `z.treeifyError(error)` instead.

## z.infer vs z.input / z.output

```ts
const Trimmed = z.string().trim();

type In = z.input<typeof Trimmed>;   // string
type Out = z.output<typeof Trimmed>; // string (same)

const ParsedInt = z.string().transform((s) => parseInt(s, 10));
type InI = z.input<typeof ParsedInt>;   // string
type OutI = z.output<typeof ParsedInt>; // number
```

`z.infer<T>` is an alias for `z.output<T>`.

## Interop with JSON Schema

- **Zod → JSON Schema**: `zod-to-json-schema` (used internally by the MCP SDK)
- **JSON Schema → Zod**: `json-schema-to-zod`

## Usage in MCP tools

In `@modelcontextprotocol/sdk` v1, `inputSchema` takes a **Zod raw shape** (do not wrap it in `z.object()`):

```ts
server.registerTool(
  "search",
  {
    inputSchema: { query: z.string(), limit: z.number().int().optional() },
  },
  async ({ query, limit }) => ({ content: [{ type: "text", text: "..." }] }),
);
```

See `ai/platform/mcp-typescript-sdk.md` for details.

## Differences between v3 and v4

**As of 2026-05**: `zod@4` is stable. The latest release is `zod@4.4.2` (released 2026-05-01). New projects should use v4.

Key breaking changes:

- **String formats**: `z.string().email()` → moved to the top-level function `z.email()`. `z.uuid()` now enforces stricter RFC 9562/4122 compliance.
- **`z.record()`**: the single-argument form is removed; `z.record(keySchema, valueSchema)` is now required. Enum keys enforce exhaustiveness.
- **Error API**: `e.flatten()` / `e.format()` are deprecated in favor of `z.treeifyError()`. `.formErrors` / `.errors` have been removed.
- **Package split**: `zod` (main), `zod/v4/core` (core utilities), `zod-mini` (lightweight, tree-shake-focused variant).
- **Performance**: significant improvements to both parse speed and type inference.

**Peer deps for library authors**: supporting both with `zod@^3 || ^4` is a viable option for the time being (e.g. the MCP SDK does this). Application code should migrate to v4.

See the official [v4 changelog](https://zod.dev/v4/changelog) for detailed migration steps.

## Common mistakes

1. **`z.object({}).parse(undefined)` throws** — use `z.object({}).optional()` or catch it with `safeParse`
2. **Side effects inside `transform`** (e.g. DB calls) — parsing should be a pure function; keep side effects in a separate layer
3. **`z.record(z.string())` doesn't work in v4** — v4 requires two arguments; write `z.record(z.string(), z.string())`
4. **Still writing `z.string().email()` under v4** — it still works but is deprecated; use `z.email()` in new code
5. **Trying to use `z.literal([...])`** — literal is for a single value; for multiple values use `z.union([z.literal(...), ...])` or `z.enum([...])`
6. **Passing a non-readonly array to `z.enum()`** — add a const assertion: `z.enum(["a", "b"] as const)`

## Comparison with other libraries

| Aspect | Zod | Yup | io-ts | Valibot |
|---|---|---|---|---|
| Type inference | Strong | Weaker | Strong | Strong |
| Style | Imperative | Chained | Functional composition | Functional composition |
| Bundle size | Medium | Medium | Medium | Small (tree-shakeable) |
| Ecosystem | Large | Large | Small | Medium (growing) |
| Transforms | Yes | Yes | Yes | Yes |

Zod is the de facto standard for TypeScript projects. Valibot is a candidate alternative when bundle size is a hard constraint.
