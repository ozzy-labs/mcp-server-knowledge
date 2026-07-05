---
reviewed: 2026-05-04
tags: [framework, javascript, typescript]
---

# Astro

A content-focused, server-first web framework. Static generation (SSG) is the default per page, adopting an **Islands Architecture** that hydrates only the parts of the client that need it. It is UI-agnostic, letting multiple UI libraries such as React / Vue / Svelte / Solid coexist in the same project. Often paired with **Starlight**, the documentation-site theme.

Official: [docs.astro.build](https://docs.astro.build/) / [starlight.astro.build](https://starlight.astro.build/)

## Positioning

- Aimed at blogs, documentation, and marketing sites (not data-driven SPAs)
- The default output is static files. SSR and hybrid modes are available via adapters
- Client JS is 0 bytes by default. Only the parts that need it are hydrated with `client:*` directives

## Versions

As of 2026-05, the current stable is **Astro 6.2** (6.0: 2026-03-10, 6.1: 2026-03-26, 6.2: 2026-04-30). **Astro 7 alpha** was published on 2026-04-30 (`astro@7.0.0-alpha.x`). Starlight is on the **0.38.x** series, still below 1.0, with breaking changes between minors, so **pinning the minor version** is recommended.

## Setup

```bash
pnpm create astro@latest
# When using the Starlight template directly
pnpm create astro@latest -- --template starlight
```

## Key commands

| Command | Purpose |
|---|---|
| `astro dev` | Dev server (with HMR) |
| `astro build` | Production build into `dist/` |
| `astro preview` | Serve the build output locally |
| `astro check` | TypeScript / type diagnostics (**build does not include type checking**) |
| `astro add <integration>` | Add an integration dependency and its config |
| `astro sync` | Regenerate types for content collections / env |

## `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://example.com',
  integrations: [react()],
});
```

Anything added to `integrations` is registered when Astro starts. `astro add <name>` automatically inserts both the dependency and the config.

## Islands Architecture basics

Import components from other frameworks inside a `.astro` file, and hydrate only what needs it with `client:*`:

```astro
---
import ReactCounter from '../components/ReactCounter.tsx';
---
<ReactCounter client:visible />
```

| Directive | Timing |
|---|---|
| `client:load` | Immediately after page load |
| `client:idle` | On requestIdleCallback |
| `client:visible` | When the element enters the viewport |
| `client:media="(max-width: 600px)"` | When the media query matches |
| `client:only="react"` | Rendered client-only, without SSR |

If none is given, the component **is rendered to HTML at SSG time and no JS is shipped**.

## Content Collections

Markdown/MDX under `src/content/<collection>/` is handled with types:

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
```

Astro 6 added **Live Content Collections** (dynamic ingestion of external data sources). 6.1 added per-codec Sharp image defaults and i18n fallback routes; 6.2 added an SVG optimizer API, a font file URL helper, and a JSON-output logger (experimental).

## Starlight (documentation theme)

An "all-in-one theme for documentation sites" integration built on top of Astro.

- Automatic sidebar generation (file-based or explicit config)
- i18n (per-locale routing, RTL support)
- Full-text search via [Pagefind](https://pagefind.app/) built in by default
- Built-in components such as Cards / Tabs / Steps / Asides
- MDX / Markdoc support, frontmatter schema validation

### Minimal configuration

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/org/repo' },
      ],
      sidebar: [
        { label: 'Guides', items: [{ slug: 'guides/getting-started' }] },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
      ],
    }),
  ],
});
```

Place articles as Markdown under `src/content/docs/`.

> **Note**: Starlight's `social` option has changed from the previous object-map form to an array form (`{ icon, label, href }[]`). Pasting an old example will cause a type error.

## Project structure (default)

```text
src/
├── components/      Reusable components
├── content/
│   └── docs/        Starlight content (Content Collections)
├── layouts/         Layouts
├── pages/           File-based routing
└── styles/          Global styles
public/              Static files served as-is
astro.config.mjs
```

## Type checking and CI

`astro build` does not perform type checking. Run it separately in CI:

```bash
pnpm astro check
pnpm astro build
```

## Common mistakes made by AI agents

1. **Writing React etc. without `client:*`, so it never hydrates and doesn't work** — output as static HTML is the default. Always add `client:*` to interactive elements.
2. **Assuming `astro build` alone guarantees type safety** — type errors only surface via `astro check`.
3. **Installing Starlight with `^0.38.0` and hitting minor breaking changes** — Starlight is below 1.0. Pin down to the minor, e.g. `"0.38.3"`.
4. **Mixing locales directly under `src/content/docs/`** — i18n requires the `src/content/docs/<locale>/` structure (the root locale is configured via the `root` key).
5. **Adding `client:load` to every page, negating the benefits of Islands** — consider `client:visible` / `client:idle` first.

## Comparison with other tools

| Framework | Positioning |
|---|---|
| Astro | Content sites. SSG by default, UI-agnostic |
| Next.js | Supports both SSR/SSG. React only. App-oriented |
| Nuxt | The Vue-only equivalent of Next.js |
| Hugo / Jekyll | Pure static site generators. No UI framework support |
| Docusaurus | React-based, documentation-site only (comparable to Starlight) |
| VitePress | Vue-based, documentation-focused |

## References

- [Astro official documentation](https://docs.astro.build/)
- [Astro CLI reference](https://docs.astro.build/en/reference/cli-reference/)
- [Islands Architecture](https://docs.astro.build/en/concepts/islands/)
- [Starlight official documentation](https://starlight.astro.build/)
- [Starlight: Getting Started](https://starlight.astro.build/getting-started/)
