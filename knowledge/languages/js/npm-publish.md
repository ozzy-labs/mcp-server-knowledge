---
reviewed: 2026-05-04
tags: [package, release, npm]
---

# npm publish

Commands and operational essentials for publishing packages to the npm registry. The core pitfalls are tarball contents (`files` / `.npmignore`), dist-tags, lifecycle scripts, provenance, and the unpublish policy. Use alongside `languages/js/pnpm.md` for package manager operations, `standards/npm-trusted-publishers.md` for OIDC, and `standards/semver.md` for version decisions.

Official: [docs.npmjs.com — npm-publish](https://docs.npmjs.com/cli/v11/commands/npm-publish)

## Publish flow

1. `prepublishOnly` → `prepare` → `prepack` → tarball creation (equivalent to `npm pack`) → `postpack` → authenticated PUT upload to the registry → `publish` → `postpublish`
2. The registry creates an immutable record of `name@version` (the same version cannot be uploaded twice)
3. The dist-tag (default `latest`) is updated

The `name`/`version` pair is **permanently unique**. Once a version number has been published, it can never be reused (even after unpublishing).

## Key commands and flags

| Flag | Purpose |
|---|---|
| `--dry-run` | Preview what would be included, without uploading |
| `--tag <name>` | Specify the dist-tag (default `latest`) |
| `--access public` / `--access restricted` | Visibility for scoped packages |
| `--otp <code>` | One-time code for 2FA |
| `--provenance` | Issue an attestation via OIDC + Sigstore |
| `--provenance-file <path>` | Submit an attestation from an existing provenance bundle file (mutually exclusive with `--provenance`) |
| `--workspace <name>` / `--workspaces` | Target specific workspaces in a monorepo |
| `--include-workspace-root` | Also target the root when using `--workspaces` |

```bash
# Check contents first
npm publish --dry-run

# Publish (scoped, public)
npm publish --access public

# Prerelease
npm publish --tag next
```

## Publish-related `package.json` fields

| Field | Role |
|---|---|
| `name` | Package name. 214 characters or fewer, lowercase, URL-safe. Scoped via `@scope/name` |
| `version` | SemVer. See `standards/semver.md` for details |
| `main` | CommonJS entry point (default `index.js`) |
| `module` | Entry point for ESM (for bundlers; Node.js does not read it) |
| `exports` | **Modern entry point definition**. Supports conditional resolution via `import` / `require` / `types` / `default`, etc. |
| `types` | Entry point for TypeScript type definitions |
| `bin` | Path to CLI binaries. Placed in `node_modules/.bin` on install (no `chmod` needed) |
| `files` | Whitelist of files to include in the tarball |
| `publishConfig` | Settings applied only at publish time (can override `registry` / `access` / `tag`) |
| `private: true` | Prevents accidental publishing. `npm publish` errors out when `true` |
| `license` | SPDX identifier (`MIT`, `Apache-2.0`, `(MIT OR Apache-2.0)`, etc.) |
| `repository` | Source code location. Can be shortened as `github:owner/repo` |
| `sideEffects` | Hint for tree-shakability. `false` or an array of target files |

### Minimal `exports` example

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

Once `exports` is defined, **paths not listed there cannot be `import`ed externally** (encapsulation takes effect). If `./package.json` is not exposed, tools may fail to read it and error out.

### When to use `publishConfig`

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public",
    "tag": "next"
  }
}
```

Avoids repeating CLI flags or `.npmrc` settings every time. Useful for pinning to GitHub Packages or a private registry.

## What goes into the tarball

Priority order (strongest first):

1. If the `package.json` `files` array exists, **only what's listed there**
2. If there is no `files`, `.npmignore`
3. If there is no `.npmignore` either, `.gitignore`
4. Always **included**: `package.json`, `README*`, `LICENSE*` / `LICENCE*`
5. Always **excluded**: `.git`, `node_modules`, `.DS_Store`, `npm-debug.log`, `.npmrc`, symlinks, etc.

Golden rule for verification:

```bash
npm publish --dry-run     # Show the list of files that would be included
npm pack                  # Generate the actual tarball (creates a .tgz locally)
tar -tzf <pkg>-<ver>.tgz  # Inspect the contents
```

Writing `files` explicitly causes fewer accidents (relying on `.gitignore` can leak, e.g., a build artifact `dist/` being excluded because it's in `.gitignore` when there is no `.npmignore` in CI).

## dist-tags (release channels)

```bash
npm publish --tag next       # Publish under the next tag (latest is not updated)
npm dist-tag ls <pkg>        # List tags
npm dist-tag add <pkg>@1.2.0 latest    # Move latest afterward
npm dist-tag rm <pkg> next   # Remove a tag
```

| dist-tag | Convention |
|---|---|
| `latest` | Default fetched by `npm install <pkg>` |
| `next` / `beta` / `alpha` / `rc` | Prereleases. Fetched via `npm install <pkg>@next` |
| `canary` | Unstable, per-commit builds |

If `latest` is not updated at GA release time, users installing `latest` will not receive the release even with a SemVer prerelease notation (`2.0.0-rc.1`).

## Lifecycle scripts

Defined under `scripts` in `package.json` and run automatically:

| Script | `npm publish` | `npm pack` | `npm install` (local) |
|---|---|---|---|
| `prepublishOnly` | runs | skipped | skipped |
| `prepare` | runs (before `prepack`) | runs | runs (for git dependencies) |
| `prepack` | runs | runs | skipped |
| `postpack` | runs | runs | skipped |
| `publish` | runs | skipped | skipped |
| `postpublish` | runs | skipped | skipped |

Common practical setup:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "prepack": "pnpm run build",
    "prepublishOnly": "pnpm run test && pnpm run lint"
  }
}
```

- **Put the build in `prepack`** (it also runs on `npm pack`, so `--dry-run` can verify the output)
- **Put tests/lint in `prepublishOnly`** (a gate that only runs at publish time)
- `prepublish` (without `Only`) is **deprecated**. Do not use it

## Scoped packages and `--access`

| Package name | Default `--access` | Can use `--access restricted`? |
|---|---|---|
| Unscoped (`my-pkg`) | fixed to `public` | no (must be public) |
| Scoped (`@scope/my-pkg`) | `public` (npm CLI v9+) | **yes** (can be made private; requires a paid plan or org) |

To make a scoped package private:

```bash
npm publish --access restricted
```

Or pin it via `package.json`:

```json
{ "publishConfig": { "access": "restricted" } }
```

## Provenance (attestation)

```bash
npm publish --provenance --access public
```

Records the source commit / workflow run / runner environment in Sigstore, forming the basis for tamper detection.

- Supported from npm CLI **v9.5+**
- pnpm supports it from **v9+** via `pnpm publish --provenance`
- yarn berry uses `yarn npm publish --provenance`

Using `--provenance` from CI requires an OIDC token. Combining it with **Trusted Publishers**, which eliminates long-lived tokens, is the modern approach (see `standards/npm-trusted-publishers.md`).

## 2FA / OTP

If 2FA is enabled on the account, pass a one-time code via `--otp`:

```bash
npm publish --otp 123456
```

Enabling 2FA at the `auth-and-writes` level requires an OTP every time you publish or change a dist-tag. CI should use OIDC (Trusted Publishers) or a **granular access token** (a write-permission token with 2FA bypass enabled).

> **Legacy access token deprecation**: creation of new tokens stopped on 2025-11-05, and **existing tokens were revoked on 2025-12-09**. Only granular access tokens are now available. Granular tokens allow fine-grained control over package/scope/organization-level permissions, expiration (minimum 1 day), IP CIDR restrictions, read-only/read-write, and 2FA bypass. If you need a long-lived token, migrate to granular.

## Publishing with pnpm / yarn

| Runner | Command | Notes |
|---|---|---|
| npm | `npm publish` | standard |
| pnpm | `pnpm publish` / `pnpm -r publish` | `--no-git-checks` can skip the clean-tree check. Commonly used in CI |
| yarn (v1) | `yarn publish` | prompts for a version. v1 is in maintenance mode; not recommended for new adoption |
| yarn berry | `yarn npm publish` | command name has changed |

Monorepo (pnpm workspaces) example:

```bash
# Publish all workspaces at once (change detection needed separately)
pnpm -r publish --access public --no-git-checks --provenance
```

Without `--no-git-checks`, the command halts on things like "there are uncommitted changes" or "not in sync with remote". CI typically includes this flag.

## Unpublish and deprecate

`unpublish` is broadly allowed only **within 72 hours of publishing** and only if no packages depend on it. After that, the npm registry policy requires that **all** of the following be met:

- Not depended on by any other published package
- Fewer than 300 downloads in the past week
- Only one maintainer

In addition:

- A deleted version number can **never be reused**
- If all versions are deleted, you must wait **24 hours** before republishing under the same name

In practice, use `deprecate` instead:

```bash
npm deprecate <pkg>@"<range>" "Use @scope/new-pkg instead. Will be unsupported after 2027-01."
```

`deprecate` leaves the package in place while emitting a warning at `npm install` time. It nudges consumers to migrate without breaking their dependencies.

## Mistakes AI agents commonly make

1. **Trying to build in `prepublishOnly`** — the build won't run when you want to inspect contents via `npm pack`. Split build into `prepack` and tests/lint into `prepublishOnly`
2. **Not writing `files`, missing a `dist/` leak** — if `dist/` is in `.gitignore` and there's no `.npmignore`, build artifacts won't make it into the tarball. Explicit `files` is safer
3. **Forgetting `--access public` for scoped packages** — the default became `public` from npm CLI v9, but setups that don't set it explicitly or older CLIs can still hit 402/403. Pinning via `publishConfig.access` is more reliable
4. **Forgetting to expose `./package.json` in `exports`** — the moment `exports` is defined, encapsulation kicks in and tools (postcss, vite, vitest, etc.) can no longer read `package.json`. Export it explicitly
5. **Trying to force-overwrite the same `version`** — overwriting isn't possible. Bump `patch` and republish
6. **Using `unpublish` casually** — it's disallowed even right after publishing if there are dependents. The rule is to bump the version and `deprecate` instead
7. **Fetching external resources in `prepare`** — this also runs on install for git dependencies (`"foo": "git+..."`), surprising consumers with heavy processing
8. **Accidentally including `.npmrc` in the tarball** — leaks secrets (`_authToken`). `.npmrc` is always excluded, but a differently named file (e.g. `registry.npmrc`) would be included

## Related

- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md) — publishing via OIDC without holding an `NPM_TOKEN`
- [`standards/semver.md`](../../standards/semver.md) — `version` decision rules and dist-tag strategy
- [`languages/js/pnpm.md`](pnpm.md) — differences and flags for `pnpm publish`
- [`tools/release-please.md`](../../tools/release-please.md) — automating Release PRs (does not perform the publish itself)

## References

- [npm-publish (CLI v11)](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- [package.json reference](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [Unpublish policy](https://docs.npmjs.com/policies/unpublish)
- [About scopes / access](https://docs.npmjs.com/cli/v11/using-npm/scope)
