---
reviewed: 2026-06-28
tags: [package, npm, javascript, fast]
---

# pnpm

A fast, disk-efficient Node.js package manager. It shares dependencies via hard links to a global store and uses a strict node_modules tree (no hoisting) to prevent implicit dependencies on transitive packages.

As of 2026-06, the `latest` dist-tag is **v11.9.0** (v11 reached GA as v11.0.0 on 2026-04-28). `corepack use pnpm@latest` and `npm install -g pnpm` fetch v11. The v10 line is still maintained via the `latest-10` dist-tag (latest **v10.34.4**).

Key changes in v11: **Node.js 22+ required**, pure ESM distribution, supply-chain protection on by default (`minimumReleaseAge: 1440` — packages published less than 24 hours ago are not resolved), and configuration migrating from `.npmrc` to `pnpm-workspace.yaml`.

Official site: [pnpm.io](https://pnpm.io/)

## Installation

```bash
# Via Corepack (bundled with Node.js, recommended)
corepack enable pnpm
corepack use pnpm@latest          # v11 line (latest dist-tag)
corepack use pnpm@latest-10       # pin to v10 line

# Standalone installer (installs pnpm alone, without Node.js/Corepack)
curl -fsSL https://get.pnpm.io/install.sh | sh -                           # latest dist-tag (currently v11)
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=10.34.4 sh -   # pin a specific version via PNPM_VERSION

# mise / asdf
mise use pnpm@11                  # latest line
mise use pnpm@10                  # pin to v10 line

# Homebrew
brew install pnpm

# Via npm
npm install -g pnpm               # v11 line (latest dist-tag)
npm install -g pnpm@latest-10     # pin to v10 line
```

## Pinning a version

Pin via the `packageManager` field in `package.json` (Corepack applies it automatically):

```json
{ "packageManager": "pnpm@11.9.0" }
```

## Key commands

| Command | npm equivalent | Notes |
|---|---|---|
| `pnpm install` | `npm install` | `pnpm i` also works |
| `pnpm add <pkg>` | `npm install <pkg>` | |
| `pnpm add -D <pkg>` | `npm install -D` | dev dependency |
| `pnpm add -g <pkg>` | `npm install -g` | global |
| `pnpm remove <pkg>` | `npm uninstall` | `pnpm rm` also works |
| `pnpm update` | `npm update` | `pnpm up` also works |
| `pnpm run <script>` | `npm run` | can be shortened to `pnpm <script>` (watch for collisions with built-in commands) |
| `pnpm exec <bin>` | `npx --no` | runs a binary from node_modules/.bin |
| `pnpm dlx <bin>` | `npx` | downloads and runs a package temporarily |
| `pnpm outdated` | `npm outdated` | |
| `pnpm audit` | `npm audit` | |
| `pnpm prune` | `npm prune` | |
| `pnpm list` | `npm ls` | `pnpm ls` also works |

## Common flags

| Flag | Meaning |
|---|---|
| `--frozen-lockfile` | don't update `pnpm-lock.yaml` (required in CI) |
| `--ignore-scripts` | skip scripts like postinstall |
| `--filter <pattern>` | apply to a subset of the workspace |
| `--recursive` / `-r` | run recursively across the whole workspace |

## Workspaces (monorepo)

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

```bash
# Test across all workspaces
pnpm -r test

# A single workspace only
pnpm --filter "@myorg/web" test

# Build in dependency order (leaves first)
pnpm -r --filter ./apps/web... build
```

The `workspace:*` protocol lets you reference a local workspace as a dependency:

```json
{ "dependencies": { "@myorg/core": "workspace:*" } }
```

## Strict node_modules layout

pnpm does **not hoist** by default. A package not declared in `package.json` cannot be `import`ed (prevents phantom dependencies).

This can break code that worked under npm. Fixes:

1. Declare the missing dependency in `package.json` (recommended)
2. Set `shamefullyHoist: true` in `pnpm-workspace.yaml` (npm-compatible, not recommended)
3. Hoist specific packages only, e.g. `publicHoistPattern: ["*eslint*"]` in `pnpm-workspace.yaml`

## Configuration files (v11+)

From pnpm 11, `.npmrc` is **for auth/registry settings only**. All other settings go in `pnpm-workspace.yaml` (project) or `~/.config/pnpm/config.yaml` (global), in camelCase. The `pnpm` field in `package.json` is no longer read either.

`pnpm-workspace.yaml`:

```yaml
# Pin the lockfile in CI
frozenLockfile: true

# Auto-install peer dependencies
autoInstallPeers: true

# Registries (new in v11, can declare multiple at once)
registries:
  default: https://registry.npmjs.org/
  "@myorg": https://npm.pkg.github.com/
```

`.npmrc` (auth only):

```ini
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Use `pnpm_config_*` environment variables instead of `npm_config_*` (e.g. `pnpm_config_registry`).

## CI best practices

```yaml
- uses: actions/checkout@v7
- uses: pnpm/action-setup@v6
  with:
    version: 11              # set to 10 to pin the v10 line
- uses: actions/setup-node@v6
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install --frozen-lockfile
- run: pnpm run test
```

- **`--frozen-lockfile`** is required (fails the build on any mismatch between `pnpm-lock.yaml` and `package.json`)
- `actions/setup-node`'s `cache: pnpm` caches the **store**, not node_modules (reduces build time)

## Troubleshooting

### `ERR_PNPM_OUTDATED_LOCKFILE`

`package.json` and `pnpm-lock.yaml` are out of sync. Run `pnpm install` locally and commit the result.

### `Cannot find module 'foo'` at build time

A phantom dependency — `foo` is used but not declared as a direct dependency. Run `pnpm add foo` to declare it explicitly.

### `peer dependency` warnings

Add `autoInstallPeers: true` to `pnpm-workspace.yaml`. Alternatively, mark it optional with `peerDependenciesMeta.<name>.optional = true`.

### `pnpm install` is slow

The store cache may not be effective. Check the store location with `pnpm store path` and make sure it's included in the CI cache.

## Differences from npm / yarn

| Aspect | pnpm | npm | yarn (v1) | yarn berry |
|---|---|---|---|---|
| node_modules | symlinks + hard links | flat | flat | PnP (no files) or nm |
| Disk usage | small (shared store) | large | large | small (PnP) |
| Phantom deps | prevented | allowed | allowed | prevented (PnP) |
| Workspaces | mature | supported since npm 7 | mature | mature |
| Speed | fast | slower | average | fast |

AI agents tend to guess and run npm commands, but pnpm repos must use `pnpm` (the lockfile format differs).
