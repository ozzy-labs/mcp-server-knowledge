---
reviewed: 2026-08-16
tags: [cloudflare, cloud-hosted, javascript, typescript]
---

# Cloudflare Pages and Workers Static Assets

Two ways to host a site on Cloudflare. **Pages** is the older git-connected static/JAMstack platform with Functions; **Workers Static Assets** serves the same files from an ordinary Worker. Both are active, but Cloudflare's investment goes to Workers, and new projects should start there.

Official: [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages/) / [Workers static assets](https://developers.cloudflare.com/workers/static-assets/)

## Which to use

Cloudflare's own statement (2025-04-08 blog, "Full-stack development on Cloudflare Workers"):

> "Cloudflare Pages will continue to be supported, but, going forward, all of our investment, optimizations, and feature work will be dedicated to improving Workers." … "Now that Workers supports both serving static assets **and** server-side rendering, you should **start with Workers**."

Note what this is *not*: Pages is **not deprecated** and carries no maintenance-mode banner — the docs still list it as available on all plans. "Pages is dead" is a common but wrong claim. The practical signal is the C3 default: `npm create cloudflare@latest` builds a Worker unless you pass `--platform=pages`.

| Capability | Workers + Static Assets | Pages |
|---|---|---|
| Cloudflare Vite plugin, Gradual Deployments, remote dev | Yes | No |
| Workers Logs, Logpush, Tail Workers, source maps | Yes | No |
| Cron Triggers, Queue consumers, Email Workers, Rate Limiting | Yes | No |
| Durable Objects | Yes | Workaround |
| Assets on a path / non-root routes | Yes | No |
| Early Hints | Workaround | Native |
| File-based routing, Pages Plugins | Workaround | Native |
| Custom domains outside a Cloudflare zone, branch aliases | No | Yes |
| Rollbacks, preview URLs, custom headers/redirects, most bindings, build caching | Yes | Yes |

Requests for static assets are free on Workers, so there is no cost penalty in moving.

## Workers Static Assets

```jsonc
{
  "name": "my-site",
  "compatibility_date": "2026-08-16",
  "main": "./src/index.ts",
  "assets": {
    "directory": "./dist/",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

- `main` is optional: omit it for a pure static site
- `not_found_handling`: `none` (default), `single-page-application` (serves `/index.html` with 200), `404-page`
- `html_handling`: `auto-trailing-slash` (default), `force-trailing-slash`, `drop-trailing-slash`, `none`
- `run_worker_first`: `true`, `false` (default), or globs with `!` negation — the replacement for `_routes.json`
- `env.ASSETS.fetch(request)` serves an asset from Worker code

Deploy with `wrangler deploy`; develop with `wrangler dev` or the Vite plugin. Details in [`cloudflare-workers.md`](cloudflare-workers.md#static-assets) and [`wrangler.md`](wrangler.md).

## Pages mechanics

```bash
npx wrangler pages deploy ./dist --project-name=my-site
```

- Git integration builds on push; each deployment gets `<hash>.<project>.pages.dev` plus a stable branch alias (`fix/api` → `fix-api.<project>.pages.dev`)
- `_headers`: up to **100 rules**, 2,000 characters per line, one splat per rule, not applied to Functions responses
- `_redirects`: 301/302/303/307/308 (302 default), **2,000 static + 100 dynamic redirects**, 1,000 characters per line
- `_routes.json`: `version: 1`, `include`/`exclude` (exclude wins), max 100 rules combined
- **Functions**: `functions/index.js`, `[param].js` (one segment), `[[catchall]].js` (many). Advanced mode (`_worker.js`) disables the `functions/` directory entirely and requires calling `env.ASSETS.fetch(request)` yourself — and `_worker.ts` is **not** read
- `wrangler pages publish` was removed in Wrangler v4; use `pages deploy`

## Migrating Pages → Workers

1. Swap the framework adapter to its Workers target
2. Create `wrangler.jsonc` with `name` and `compatibility_date`; `assets.directory` replaces `pages_build_output_dir`
3. Set `assets.not_found_handling` to match the previous SPA/404 behavior
4. Port Functions: run `wrangler pages functions build`, or adapt `_worker.js` into `main`
5. `_headers` and `_redirects` keep working; `_routes.json` maps onto `run_worker_first`
6. Replace `wrangler pages dev` / `pages deploy` with `wrangler dev` / `deploy`, and Pages CI with Workers Builds

Known gap: Workers has no native "different bindings for production vs preview builds" equivalent to Pages — Cloudflare says it is exploring this.

## Frameworks

- **`@cloudflare/vite-plugin`** (v1.52.1) is the primary integration — your code runs in `workerd` during `vite dev`, with HMR. Official support now includes TanStack Start and React Router v8 with SSR
- **Next.js**: use **`@opennextjs/cloudflare`** (v1.20.2, peer `next >=15.5.21 <16 || >=16.2.11`). **`@cloudflare/next-on-pages` is deprecated and archived** (2025-09-29)
- Adapters: `@sveltejs/adapter-cloudflare`, `@astrojs/cloudflare`, Nuxt/Nitro `preset: cloudflare`, React Router (the former Remix guide)
- C3 templates cover Angular, Astro, Docusaurus, Gatsby, Hono, Next.js, Nuxt, Qwik, React, Redwood, Remix, SolidStart, SvelteKit, and Vue

See [`../../languages/js/astro.md`](../../languages/js/astro.md) and [`../../languages/js/hono.md`](../../languages/js/hono.md) for the framework side.

## References

- [Pages](https://developers.cloudflare.com/pages/) / [Functions routing](https://developers.cloudflare.com/pages/functions/routing/) / [headers](https://developers.cloudflare.com/pages/configuration/headers/) / [redirects](https://developers.cloudflare.com/pages/configuration/redirects/) / [preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) — includes the feature comparison matrix
- [Static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/) / [Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) / [full-stack on Workers (2025-04-08)](https://blog.cloudflare.com/full-stack-development-on-cloudflare-workers/)
- Related: [`cloudflare-workers.md`](cloudflare-workers.md), [`wrangler.md`](wrangler.md), [`cloudflare.md`](cloudflare.md)
