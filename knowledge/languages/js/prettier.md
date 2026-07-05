---
reviewed: 2026-05-04
tags: [format, javascript, typescript, markdown, yaml]
---

# Prettier

An opinionated code formatter. It discards the original style and re-outputs code in a consistent form. As of 2026-05, it continues to play a complementary role for **Markdown / YAML / HTML / Vue / Svelte and other formats that Biome still does not support**. Even projects that have adopted Biome commonly run a hybrid setup where Prettier handles non-JS assets.

Official site: [prettier.io](https://prettier.io/)

## Version

The current release as of 2026-05 is the **3.8 line** (3.8.3, 2026-04-15). 4.0 is planned, mainly focused on CLI speedups.

## Installation

```bash
pnpm add -D -E prettier
```

Minor updates can produce formatting diffs, so pinning to an exact version (`-E`) is the officially recommended practice.

## Basic commands

```bash
# Diff check (for CI; exits non-zero on violations)
pnpm exec prettier --check .

# Write (apply formatting)
pnpm exec prettier --write .

# Specific extensions only
pnpm exec prettier --write "**/*.{md,yaml,yml}"
```

## Supported languages (built-in)

| Language | Notes |
|---|---|
| JavaScript / TypeScript / JSX | Overlaps with Biome |
| Flow | JS family |
| Vue / Angular | Framework-specific |
| CSS / Less / SCSS | Biome also supports CSS |
| HTML / Handlebars | Not supported by Biome |
| JSON / JSON5 / JSONC | Overlaps with Biome |
| GraphQL | — |
| **Markdown (GFM / MDX v1)** | **Not supported by Biome** |
| **YAML** | **Not supported by Biome** |

Plugins (`prettier-plugin-*`) extend support to TOML / XML / PHP / Astro / Svelte / Tailwind class sorting, and more.

## Configuration file

Supports multiple formats: `.prettierrc` / `.prettierrc.json` / `.prettierrc.yaml` / `prettier.config.mjs` / the `"prettier"` key in `package.json`, etc.:

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

| Option | Typical value | Description |
|---|---|---|
| `printWidth` | 80 / 100 | Target wrap width (not enforced strictly) |
| `tabWidth` | 2 | Indent width |
| `useTabs` | false | Tabs vs. spaces |
| `semi` | true | Semicolons |
| `singleQuote` | false | Single quotes |
| `trailingComma` | `"all"` | Trailing commas (default `all` since 3.0) |
| `endOfLine` | `"lf"` | Line ending |

### Per-extension overrides with `overrides`

```json
{
  "printWidth": 100,
  "overrides": [
    { "files": "*.md", "options": { "proseWrap": "preserve" } },
    { "files": "*.{yaml,yml}", "options": { "singleQuote": false } }
  ]
}
```

## `.prettierignore`

```text
node_modules
dist
pnpm-lock.yaml
CHANGELOG.md
```

Since Prettier 3.0, **`.gitignore` is also respected automatically**.

## Division of labor with Biome (as of 2026-05)

The practical approach is to **center on Biome and use Prettier for what Biome cannot handle**:

| Target | Biome | Prettier |
|---|---|---|
| JS / TS / JSX / JSON | ✓ (recommended) | Possible |
| CSS | ✓ | Possible |
| Markdown / YAML | ✗ | ✓ (**this is the main purpose**) |
| HTML / Vue / Svelte / Astro | Limited | ✓ via plugins |

**To avoid double-formatting**, separate responsibilities using one of the following:

- Restrict Biome to JS/TS/JSON only via `files.includes` in `biome.json`
- Exclude extensions handled by Biome via `.prettierignore`
- Separate Prettier invocations into their own commands, e.g. `pnpm run lint:md` / `lint:yaml`

## CI and pre-commit

```yaml
# lefthook.yaml
pre-commit:
  commands:
    prettier:
      glob: "*.{md,yaml,yml}"
      run: prettier --write {staged_files}
      stage_fixed: true
```

CI side:

```bash
pnpm exec prettier --check "**/*.{md,yaml,yml}"
```

## Plugins

| Plugin | Purpose |
|---|---|
| `prettier-plugin-astro` | `.astro` files |
| `prettier-plugin-svelte` | `.svelte` files |
| `prettier-plugin-tailwindcss` | Auto-sorts Tailwind CSS classes |
| `prettier-plugin-toml` | TOML (see also `tools/taplo.md`) |
| `prettier-plugin-sh` | Shell scripts (usually unnecessary since it conflicts with `tools/shfmt.md`) |
| `@prettier/plugin-xml` | XML |

Add to the `plugins` array in the config file, or specify via the CLI with `--plugin <pkg>`.

## Common mistakes made by AI agents

1. **Running both Biome and Prettier on the same files, causing an endless formatting diff loop** — always separate which extensions each tool owns.
2. **Mistaking `printWidth` for a strict physical rule** — Prettier treats it as a "target wrap width," not a hard limit (long URLs / identifiers in particular can exceed it).
3. **Setting Markdown's `proseWrap` to `"always"`, causing huge diffs** — for content mixed with Japanese, `"preserve"` is safer. For existing documents, don't change the default `"preserve"`.
4. **Formatting `pnpm-lock.yaml` or other generated files, creating diff noise** — add them to `.prettierignore` (they are also excluded via `.gitignore`).
5. **Copy-pasting v2 settings (e.g., `trailingComma: "es5"`)** — aligning with the 3.x default of `"all"` produces less noise.

## References

- [Prettier official documentation](https://prettier.io/docs/en/)
- [Options](https://prettier.io/docs/en/options)
- [Plugins](https://prettier.io/docs/en/plugins)
- [Biome: Differences with Prettier](https://biomejs.dev/formatter/differences-with-prettier/)
