---
reviewed: 2026-08-16
tags: [cloudflare, cli, typescript, npm]
---

# Wrangler

The CLI for the Cloudflare developer platform: scaffolding, local development, type generation, resource management (KV / R2 / D1 / Queues), and deployment of Workers. Configuration lives in `wrangler.jsonc` (or `wrangler.toml`) next to the Worker. Latest release **v4.123.0** (2026-08-13); v4 has been the current major since **2025-03-13** and there is no v5.

Official: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler/)

## Install and scaffold

```bash
npm i -D wrangler@latest      # pnpm add -D / yarn add -D / bun add -d
npx wrangler --version        # `wrangler version` was removed in v4

npm create cloudflare@latest -- my-worker   # C3 scaffolder
```

- Requires **Node.js >= 22** (`engines.node` of 4.123.0); Cloudflare supports Current, Active, and Maintenance Node releases
- Install per project, not globally — a bare `npx wrangler` with no local install silently fetches the newest version
- C3 defaults to `--platform=workers` (pass `--platform=pages` for Pages) and generates **`wrangler.jsonc`**. Useful flags: `--framework` (astro, hono, next, nuxt, react, remix, svelte, vue, …), `--type` (`hello-world`, `hello-world-durable-object`, `scheduled`, `queues`, `openapi`, `pre-existing`), `--lang ts|js|python`, `--template <repo>`, `-y`
- Wrangler bundles the runtime it runs against: 4.123.0 ships `workerd 1.20260811.1` and `miniflare 5.20260811.1-alpha`

## Configuration file

Cloudflare recommends **`wrangler.jsonc` for new projects**, and states that some newer features are JSON-only (JSON config landed in v3.91.0). TOML remains supported; having both files in one project is a common silent failure.

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-16",
  "workers_dev": false,
  "route": { "pattern": "example.org/*", "zone_name": "example.org" },
  "observability": { "enabled": true },
  "triggers": { "crons": ["0 * * * *"] },
  "vars": { "LOG_LEVEL": "info" },
  "kv_namespaces": [{ "binding": "CACHE", "id": "<KV_ID>" }],
  "env": {
    "staging": {
      "name": "my-worker-staging",
      "route": { "pattern": "staging.example.org/*", "zone_name": "example.org" },
      "vars": { "LOG_LEVEL": "debug" },
      "kv_namespaces": [{ "binding": "CACHE", "id": "<STAGING_KV_ID>" }]
    }
  }
}
```

- `name`: alphanumeric and dashes only (no underscores)
- `compatibility_date`: required; set it to **today's date** on a new project. Uploads via the API without one fall back to `2021-11-02`
- `workers_dev` defaults to `true`; `preview_urls` defaults to the value of `workers_dev`
- `limits`: `cpu_ms` (max 300,000) and `subrequests`; `placement: { mode: "smart" }`; `observability`: `enabled` plus `head_sampling_rate` (0–1)
- `keep_vars`: keep dashboard-configured `vars` on deploy (top-level only)
- `secrets`: `{ "required": ["API_KEY"] }` declares the secret names a deploy expects, for validation and type generation

### Bindings

Bindings are declared per resource and read off `env` in the Worker ([`cloudflare-workers.md`](cloudflare-workers.md#bindings)):

```jsonc
{
  "kv_namespaces": [{ "binding": "CACHE", "id": "<id>" }],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "assets" }],
  "d1_databases": [{ "binding": "DB", "database_name": "app", "database_id": "<uuid>" }],
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "exports": { "Room": { "type": "durable-object", "storage": "sqlite" } },
  "queues": { "producers": [{ "binding": "JOBS", "queue": "jobs" }], "consumers": [{ "queue": "jobs" }] },
  "services": [{ "binding": "AUTH", "service": "auth-worker", "entrypoint": "AuthEntrypoint" }],
  "ai": { "binding": "AI" },
  "hyperdrive": [{ "binding": "PG", "id": "<id>" }],
  "assets": { "directory": "./dist/", "binding": "ASSETS" }
}
```

Add `"remote": true` to an individual binding to run local code against the real resource during `wrangler dev`.

## Commands

| Command | Notes |
|---|---|
| `wrangler dev` | Local by default. `--remote` (legacy full-remote), `--port`, `--local-protocol http\|https`, `--var KEY:VALUE`, `--test-scheduled` (exposes `/__scheduled`), `--persist-to`, `--tunnel` |
| `wrangler deploy` | `--dry-run --outdir` to inspect the bundle without deploying, `--env`, `--minify`, `--keep-vars`, `--secrets-file`, `--tag`, `--message` |
| `wrangler versions upload` / `versions deploy` | Gradual deployments: upload a version, then split traffic by `--percentage`. Only the last 100 versions are eligible |
| `wrangler versions secret put` | Adds a secret to a **new version** without deploying it |
| `wrangler deployments list` / `status`, `wrangler rollback [VERSION_ID]` | Deployment history and one-step rollback |
| `wrangler secret put\|delete\|list\|bulk` | `secret put` creates and **deploys** a new version immediately. `secret bulk` accepts JSON or `.env` format |
| `wrangler tail [WORKER]` | `--format json\|pretty`, `--status ok\|error\|canceled`, `--search`, `--sampling-rate`, `--version-id` |
| `wrangler types` | Writes `worker-configuration.d.ts` (runtime types + `Env`). `--check` for CI, `--env-interface` to rename `Env` |
| `wrangler kv` / `r2` / `d1` / `queues` | Resource management; see [`cloudflare-storage.md`](cloudflare-storage.md) |
| `wrangler login` / `logout` / `whoami` | OAuth login; `--scopes` to narrow |
| `wrangler init --from-dash <worker>` | Pull an existing dashboard Worker into a local project |
| `wrangler check startup` | Catches startup-CPU failures before deploying |

`wrangler types` replaces hand-written binding types. In v4 runtime types are included by default (`--x-include-runtime` was a v3-only flag); wire the output up with `"types": ["./worker-configuration.d.ts"]` in `tsconfig.json` and re-run it after every binding or compatibility change.

## Environments

`"env": { "staging": { … } }` (TOML: `[env.staging]`) creates a **separate Worker** named `<name>-<environment>` unless the block sets its own `name`. Select it with `--env staging` or `CLOUDFLARE_ENV=staging`.

- **Inheritable** (fall through from the top level): `name`, `main`, `compatibility_date`, `compatibility_flags`, `account_id`, `workers_dev`, `preview_urls`, `route`/`routes`, `triggers`, `build`, `minify`, `logpush`, `limits`, `observability`, `assets`, `exports`, `migrations`, `placement`, `tsconfig`, `rules`
- **Non-inheritable — must be redeclared inside every environment**: `vars`, `define`, `secrets`, `kv_namespaces`, `r2_buckets`, `d1_databases`, `durable_objects`, `services`, `queues`, `workflows`, `vectorize`, `ai_search`, `tail_consumers`

Forgetting the second list is the single most common Wrangler bug: the environment deploys successfully with **no bindings at all**. Secrets are per-environment too (`wrangler secret put KEY --env production`), and a Service binding pointing at an environment must name the suffixed Worker (`auth-worker-staging`).

`legacy_env` / Service Environments were removed in v4.

## Secrets and variables

| Mechanism | Visibility | Use for |
|---|---|---|
| `vars` in config | **Plaintext, visible in the dashboard**, shipped with the deploy | Non-sensitive configuration |
| `--define` | **Inlined into the bundle at build time** | Build constants only — never secrets |
| `wrangler secret put` | Write-only after creation; injected on `env` | API keys, tokens |
| Secrets Store binding | Account-level, reusable across Workers; `await env.SECRET.get()` | Secrets shared by several Workers |
| `.dev.vars` / `.env` | Local only, never commit | Local development values |

- Deploys **delete every `var` not present in the config** — set `keep_vars: true` (or `--keep-vars`) when the dashboard is the source of truth. Secrets are never deleted by a deploy
- Use either `.dev.vars` or `.env`, not both. `.dev.vars.<env>` **replaces** `.dev.vars` entirely (redeclare everything), whereas `.env.<env>` merges with precedence `.env.<env>.local` > `.env.local` > `.env.<env>` > `.env`

## CI/CD

```yaml
name: Deploy Worker
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- `cloudflare/wrangler-action` **v4.0.0** (2026-05-12) installs Wrangler v4 by default; the docs sample still pins `@v3`. Inputs: `command`, `environment`, `workingDirectory`, `wranglerVersion`, `secrets`, `packageManager`, `preCommands`/`postCommands`. OIDC is not supported — the API token is a repository secret
- API token: a **Custom token** with *Edit Cloudflare Workers* (Workers Scripts: Edit, Account Settings: Read, User Details: Read), plus KV / D1 / R2 edit permissions for the bindings in use, scoped to the single deploying account
- Useful environment variables: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ENV`, `WRANGLER_LOG`, `WRANGLER_SEND_METRICS`, `WRANGLER_OUTPUT_FILE_PATH` (ND-JSON deploy output, parseable in CI)
- **Workers Builds** is Cloudflare's own git-connected CI (GA): connect a GitHub/GitLab repo, production-branch pushes run `wrangler deploy`, other branches produce preview deployments. The dashboard Worker name must match `name` in the config or the build fails. External CI is the answer for self-hosted or non-GitHub/GitLab providers

See [`../github/github-actions.md`](../github/github-actions.md) for the workflow side.

## Pitfalls

1. **Stale `compatibility_date`.** Templates (including Cloudflare's own prompting docs) carry dates over a year old. Set it to today
2. **`nodejs_compat` guidance flipped on 2026-08-04.** With a compatibility date on or after that, `nodejs_compat` and `nodejs_compat_v2` are on by default — omit them from new configs. Between `2024-09-23` and `2026-08-03` they are still required
3. **Removed in v4**: `wrangler publish` (→ `deploy`), `wrangler generate` (→ `npm create cloudflare@latest`), `wrangler version` (→ `--version`), `--node-compat`, `--legacy-assets`, `usage_model`, `getBindingsProxy()` (→ `getPlatformProxy()`)
4. **v4 runs commands locally by default.** `wrangler kv key get`, `d1 execute`, and friends operate on `.wrangler/state` unless you pass `--remote`. Always pass the flag explicitly in scripts
5. **`[site]` / Workers Sites is deprecated** — use the `assets` object
6. **Forgetting `--env`** deploys to the top-level Worker and writes secrets to the wrong script
7. **Bindings not redeclared per environment** (see above)
8. **`wrangler dev --remote` vs remote bindings.** The modern approach is `"remote": true` on the specific binding; `--remote` uploads the whole Worker to preview infrastructure
9. **Stale generated types** — re-run `wrangler types` after config changes; use `--check` in CI

## References

- [Wrangler docs](https://developers.cloudflare.com/workers/wrangler/) — [configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) / [commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) / [environments](https://developers.cloudflare.com/workers/wrangler/environments/) / [system environment variables](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/)
- [v3 → v4 migration](https://developers.cloudflare.com/workers/wrangler/migration/update-v3-to-v4/) / [deprecations](https://developers.cloudflare.com/workers/wrangler/deprecations/)
- [Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) / [environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/) / [gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/)
- [CI/CD](https://developers.cloudflare.com/workers/ci-cd/) / [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) / [GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) / [cloudflare/wrangler-action](https://github.com/cloudflare/wrangler-action)
- Related: [`cloudflare-workers.md`](cloudflare-workers.md), [`cloudflare-storage.md`](cloudflare-storage.md), [`cloudflare-pages.md`](cloudflare-pages.md), [`cloudflare.md`](cloudflare.md)
