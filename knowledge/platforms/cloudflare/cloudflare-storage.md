---
reviewed: 2026-08-16
tags: [cloudflare, cloud-hosted, infrastructure, typescript]
---

# Cloudflare Storage and Data (KV / R2 / D1 / Durable Objects / Queues)

Cloudflare exposes several storage primitives to Workers, each with a different consistency and cost model. Picking the wrong one is the most expensive early mistake in a Workers project, because the access pattern — not the data shape — decides. This article compares them and shows the minimal binding + API for each. Runtime details are in [`cloudflare-workers.md`](cloudflare-workers.md); CLI and config in [`wrangler.md`](wrangler.md).

Official: [developers.cloudflare.com/workers/platform/storage-options](https://developers.cloudflare.com/workers/platform/storage-options/)

## Choosing

| Product | Use for | Consistency | Avoid when |
|---|---|---|---|
| **Workers KV** | Config, routing metadata, feature flags, A/B assignment — read-heavy and cacheable | Eventually consistent (up to ~60 s across locations) | You need read-after-write, or write frequently |
| **R2** | Objects and blobs: assets, images, datasets, logs. **Zero egress fees** | Strongly consistent per object | You need queries or indexes |
| **D1** | Relational data: users, orders, listings. SQLite semantics | Single primary + optional read replicas | Write-heavy fan-out, or >10 GB per database |
| **Durable Objects** | Per-entity coordination, WebSockets, agents, transactional state | Single-threaded and strongly consistent per object | Global read-heavy data, cross-entity queries |
| **Queues** | Background jobs, batching, decoupling producers from consumers | At-least-once delivery | You need sub-second synchronous results |
| **Hyperdrive** | Accelerating an **existing** Postgres/MySQL from Workers | Depends on the origin database | You want a database — it is a pool + cache |
| **Vectorize** | Embeddings, semantic search, classification | — | You need filters more than similarity |

## Workers KV

```jsonc
{ "kv_namespaces": [{ "binding": "CACHE", "id": "<KV_ID>" }] }
```

```ts
await env.CACHE.put("user:1", JSON.stringify(user), { expirationTtl: 3600, metadata: { v: 1 } });
const user = await env.CACHE.get("user:1", "json");
const many = await env.CACHE.get(["user:1", "user:2"]);           // up to 100 keys → Map
const { value, metadata } = await env.CACHE.getWithMetadata("user:1");
const { keys, cursor, list_complete } = await env.CACHE.list({ prefix: "user:" });
```

- **Eventually consistent**: a write is visible immediately in the writing location, but can take ~60 s elsewhere. Negative lookups are cached too
- `cacheTtl` defaults to 60 s; the minimum dropped from 60 s to **30 s** on 2026-01-30
- Limits: key 512 B, metadata 1,024 B, **value 25 MiB**, 1,000 namespaces/account, **1 write/second to the same key**, 1,000 KV operations per Worker invocation
- Pricing (Paid): 10M reads/month then $0.50/M; 1M writes, deletes, and lists each then $5.00/M; 1 GB stored then $0.50/GB-month. Free: 100k reads and 1k writes per day
- Legacy `/accounts/{id}/workers/namespaces/*` REST routes are discontinued **2026-10-15** — migrate to `/storage/kv/namespaces/*`

## R2

```jsonc
{ "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "assets" }] }
```

```ts
await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: "image/png" } });
const obj = await env.BUCKET.get(key);
if (obj) { const headers = new Headers(); obj.writeHttpMetadata(headers); return new Response(obj.body, { headers }); }
await env.BUCKET.delete([key1, key2]);              // up to 1,000 keys
const listed = await env.BUCKET.list({ prefix: "img/", limit: 1000 });
const upload = await env.BUCKET.createMultipartUpload(key); // uploadPart / complete / abort
```

- **Strongly consistent**: read-after-write, list, and delete are immediately globally visible. Concurrent writes to a key are last-writer-wins. Note that enabling cache on a custom domain relaxes this; the Worker binding and S3 API bypass the cache
- **Egress is free** via the Workers API, S3 API, and `r2.dev`
- Limits: object 4.995 TiB, single-part upload 4.995 GiB, 10,000 multipart parts, key 1,024 B, custom metadata 8,192 B, **1 write/second per object**
- Pricing: Standard $0.015/GB-month, Infrequent Access $0.01/GB-month (+$0.01/GB retrieval, 30-day minimum). Class A $4.50/M, Class B $0.36/M. Free: 10 GB-month, 1M Class A, 10M Class B
- **R2 Data Catalog** (public beta) is a managed Apache Iceberg REST catalog inside the bucket; **R2 SQL** (open beta) queries those tables serverlessly (`wrangler r2 sql query`, $2.50/TB scanned). Together with Pipelines (open beta) they are marketed as the Cloudflare Data Platform

## D1

```jsonc
{ "d1_databases": [{ "binding": "DB", "database_name": "app", "database_id": "<uuid>" }] }
```

```ts
const { results } = await env.DB.prepare("SELECT * FROM orders WHERE user_id = ?").bind(userId).all();
const one = await env.DB.prepare("SELECT count(*) AS n FROM orders").first("n");
await env.DB.batch([                       // sequential, auto-commit, aborts on first failure
  env.DB.prepare("INSERT INTO orders (id, user_id) VALUES (?, ?)").bind(id, userId),
  env.DB.prepare("UPDATE users SET orders = orders + 1 WHERE id = ?").bind(userId),
]);
```

- GA since 2024-04-01. `meta` on every result reports `changes`, `duration`, and exact rows read/written — the billing units
- **Read replication**: `env.DB.withSession(bookmark)` routes reads to a replica and keeps sequential consistency through bookmarks. Writes always go to the primary. Enabled per database in the dashboard or REST API (not in `wrangler.jsonc`); announced as public beta on 2025-04-10

```ts
const session = env.DB.withSession(request.headers.get("x-d1-bookmark") ?? "first-unconstrained");
const { results } = await session.prepare("SELECT * FROM orders").all();
const bookmark = session.getBookmark();   // return to the client for its next request
```

- Limits: **10 GB per database** (500 MB Free), 1 TB per account, 50,000 databases, 1,000 queries per Worker invocation (50 Free), statement 100 KB, 100 bound parameters, row 2 MB, 30 s query timeout, Time Travel 30 days
- Pricing (Paid): 25B rows read/month then $0.001/M; 50M rows written/month then $1.00/M; 5 GB then $0.75/GB-month. No compute or egress charge
- **Migrations**: `wrangler d1 migrations create|list|apply`, tracked in a `d1_migrations` table inside the database. Config keys `migrations_dir`, `migrations_table`, `migrations_pattern` (glob, added 2026-05-29 for Drizzle-style nested layouts). Pass the **database name, not the binding name** — the binding can change
- ORMs: **Drizzle** is the smoothest fit (native D1 dialect). Prisma works through `@prisma/adapter-d1`, which Cloudflare's own tutorial still describes as a Preview feature requiring `previewFeatures = ["driverAdapters"]`

## Durable Objects

```jsonc
{
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "exports": { "Room": { "type": "durable-object", "storage": "sqlite" } }
}
```

```ts
import { DurableObject } from "cloudflare:workers";

export class Room extends DurableObject<Env> {
  async addMessage(text: string) {
    this.ctx.storage.sql.exec("INSERT INTO messages (text) VALUES (?)", text);
    await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }
  async alarm(info?: { retryCount: number; isRetry: boolean }) { /* retried with backoff */ }
}

const stub = env.ROOM.getByName(roomId);   // = idFromName + get
await stub.addMessage("hello");            // RPC, not fetch
```

- The `exports` block is the current form; the older `migrations: [{ tag, new_sqlite_classes }]` array is legacy. **New namespaces are SQLite-backed only** — accounts without an existing KV-backed namespace can no longer create one (2026-07-09)
- SQLite in DOs went GA on 2025-04-07, and SQLite-backed DOs became available on the **Workers Free plan** the same day
- `ctx.storage.sql.exec(query, ...bindings)` returns a cursor (`one()`, `toArray()`, `raw()`, `rowsRead`, `rowsWritten`). Cursors are not stable across `await` — consume them synchronously. Use `ctx.storage.transaction()` rather than raw `BEGIN`
- Alarms are guaranteed at-least-once with exponential backoff (2 s, up to 6 retries)
- Limits: 10 GB SQLite per object, ~1,000 requests/second per individual object (soft), 32 MiB WebSocket message, CPU 30 s default up to 5 min, alarm wall time 15 min. Point-in-time recovery covers 30 days
- Pricing (Paid): requests 1M/month then $0.15/M; duration 400,000 GB-s/month then $12.50/M GB-s — **duration counts idle-in-memory time**, which is the usual bill surprise. SQLite storage: rows read 25B/month then $0.001/M, rows written 50M/month then $1.00/M, 5 GB then $0.20/GB-month
- Placement: `env.ROOM.jurisdiction("eu")` is a hard guarantee (`eu`, `us`, `fedramp`); `locationHint` is best-effort and only honored on first creation

## Queues

```jsonc
{
  "queues": {
    "producers": [{ "binding": "JOBS", "queue": "jobs" }],
    "consumers": [{ "queue": "jobs", "max_batch_size": 10, "max_batch_timeout": 5, "dead_letter_queue": "jobs-dlq" }]
  }
}
```

```ts
await env.JOBS.send({ userId }, { delaySeconds: 30 });
await env.JOBS.sendBatch([{ body: a }, { body: b }]);

export default {
  async queue(batch: MessageBatch<Job>, env: Env) {
    for (const message of batch.messages) {
      try { await handle(message.body); message.ack(); }
      catch { message.retry({ delaySeconds: 60 }); }
    }
  },
};
```

- GA since 2024-09-26; available on Free and Paid plans. Throughput 5,000 messages/second per queue, consumer concurrency up to 250
- Limits: message 128 KB, batch 100 messages or 256 KB, 10,000 queues/account, retention up to 14 days (24 h on Free), max 100 retries, 15 min wall clock per consumer invocation
- Pricing: **$0.40 per million operations**, where an operation is each 64 KB written, read, or deleted — a typical small message costs three operations. Free: 10,000 operations/day

## Hyperdrive

```jsonc
{ "hyperdrive": [{ "binding": "PG", "id": "<id>" }] }
```

```ts
import { Client } from "pg";
const sql = new Client({ connectionString: env.PG.connectionString });
await sql.connect();
const { rows } = await sql.query("SELECT * FROM users WHERE id = $1", [id]);
```

- Connection pooling + query caching in front of an existing Postgres or MySQL (**MySQL went GA 2026-08-07**). Create with `wrangler hyperdrive create <name> --connection-string=...`
- Cache defaults: `max_age` 60 s, `stale_while_revalidate` 15 s, max 1 hour; only non-mutating queries with immutable functions are cached (`NOW()`, `RANDOM()` are excluded). `--caching-disabled` turns it off — a common pattern is binding one cached and one uncached config
- Limits: ~20 origin connections per config on Free, ~100 on Paid; query duration 60 s; cached response 50 MB
- **No local emulation**: set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>` (or `localConnectionString`), which bypasses pooling and caching

## Vectorize

```jsonc
{ "vectorize": [{ "binding": "VECTORIZE", "index_name": "docs" }] }
```

```ts
await env.VECTORIZE.upsert([{ id, values: embedding, metadata: { url } }]);
const matches = await env.VECTORIZE.query(embedding, { topK: 5, returnMetadata: "all" });
```

- GA. `wrangler vectorize create docs --dimensions=768 --metric=cosine` — the metric is **immutable after creation**
- Limits: 1,536 dimensions max, 20M vectors per index, metadata 10 KiB per vector, `topK` 50 with values/metadata (100 without)
- Pricing: queried dimensions $0.01/M, stored dimensions $0.05 per 100M. No charge for indexes, CPU, or memory
- **Not emulated locally** — requires `"remote": true`

## Workflows, Pipelines, Analytics Engine

- **Workflows** (GA 2025-04-07): durable multi-step execution with `step.do()`, `step.sleep()`, `step.waitForEvent()`. Billed on requests, CPU-ms, storage, and **steps** (500,000/month then $0.80 per 100,000); step and storage billing started 2026-08-10
- **Pipelines** (open beta, Workers Paid): Streams → SQL transforms → Sinks writing Iceberg or Parquet into R2, with exactly-once delivery
- **Workers Analytics Engine**: unlimited-cardinality time series via `env.DATASET.writeDataPoint({ blobs, doubles, indexes })`, queried over a SQL API. Max 20 blobs / 20 doubles / 1 index per point, 250 points per invocation, 3-month retention. Billing is announced but not yet enabled

## Local development

`wrangler dev` emulates KV, R2, D1, Queues, Durable Objects, and Workflows locally against `.wrangler/state` (add it to `.gitignore`; `--persist-to` moves it). Wrangler v4 runs resource commands **locally by default** — `wrangler kv key get`, `wrangler d1 execute` and friends need `--remote` to touch production.

| Product | Local emulation | Remote binding |
|---|---|---|
| KV / R2 / D1 | Yes | Yes |
| Queues / Durable Objects / Workflows | Yes | No |
| Hyperdrive | No (local connection string) | No |
| Vectorize / Workers AI / Browser Run | No | Required |

## References

- [Storage options](https://developers.cloudflare.com/workers/platform/storage-options/) — the decision matrix Cloudflare maintains
- [KV](https://developers.cloudflare.com/kv/) / [R2](https://developers.cloudflare.com/r2/) / [D1](https://developers.cloudflare.com/d1/) / [Durable Objects](https://developers.cloudflare.com/durable-objects/) / [Queues](https://developers.cloudflare.com/queues/) / [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) / [Vectorize](https://developers.cloudflare.com/vectorize/) / [Workflows](https://developers.cloudflare.com/workflows/)
- [D1 read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/) / [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) / [Durable Objects migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [R2 consistency](https://developers.cloudflare.com/r2/reference/consistency/) / [R2 Data Catalog](https://developers.cloudflare.com/r2-data-catalog/) / [R2 SQL](https://developers.cloudflare.com/r2-sql/)
- Related: [`cloudflare-workers.md`](cloudflare-workers.md), [`wrangler.md`](wrangler.md), [`cloudflare-ai.md`](cloudflare-ai.md), [`cloudflare.md`](cloudflare.md)
