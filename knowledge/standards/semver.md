---
reviewed: 2026-05-04
tags: [methodology, release]
---

# Semantic Versioning (SemVer)

A public API contract that expresses a version as three components, `MAJOR.MINOR.PATCH`. Paired with Conventional Commits, it forms the basis for release automation.

Official: [semver.org](https://semver.org/lang/ja/)

## Basic format

```text
1.4.2
│ │ └─ PATCH: backward-compatible bug fixes
│ └─── MINOR: backward-compatible feature additions
└───── MAJOR: backward-incompatible changes
```

### Additional components

```text
1.4.2-beta.3+20260418.abcdef
          │         │
          │         └─ Build metadata (not used for precedence comparison)
          └─── Pre-release identifier (beta, rc, etc.)
```

| Range | Order |
|---|---|
| With pre-release | `1.4.2-alpha` < `1.4.2-alpha.1` < `1.4.2-beta` < `1.4.2` |
| Build metadata | Does not affect precedence comparison (`1.4.2+build.1` = `1.4.2+build.2`) |

## When to bump what

| Change | Component to bump |
|---|---|
| Removing an existing API, changing a signature, or changing behavior (breaking) | MAJOR |
| Deprecation (`@deprecated`) | MINOR (it still works) |
| Adding a new API (no impact on existing behavior) | MINOR |
| Bug fix (restoring intended behavior) | PATCH |
| Updating a dependency version range | PATCH / MINOR depending on impact |
| README, comments, docs | No bump needed, or PATCH |

**The 0.x series** is treated as "not yet stable." In many ecosystems, `0.x.y` → `0.x.(y+1)` is allowed to carry what would effectively be a MINOR-level breaking change. Releasing 1.0.0 declares that the API is stable.

## npm range notation

```text
^1.4.2   # >=1.4.2 <2.0.0    (recommended default)
~1.4.2   # >=1.4.2 <1.5.0    (pins MINOR)
1.4.2    # exact match
>=1.4.2  # greater than or equal
1.x      # 1.x.x
*        # any
```

### The 0.x exception

`^0.4.2` means **`>=0.4.2 <0.5.0`** (MAJOR is pinned at 0, and MINOR is pinned too). This treatment allows breaking changes within 0.x.

## Pre-releases

```text
1.0.0-alpha          # early testing
1.0.0-alpha.1
1.0.0-beta
1.0.0-beta.1
1.0.0-rc.1           # release candidate
1.0.0                # GA
```

Tagged publish: `npm publish --tag beta` / `--tag alpha`. Consumers can pull it with `npm install pkg@beta`.

## Integration with Conventional Commits

Detect `feat:` / `fix:` / `!` to determine the next version:

| Commit | Bump |
|---|---|
| `fix:` | PATCH |
| `feat:` | MINOR |
| `feat!:` / `BREAKING CHANGE:` footer | MAJOR |
| `docs:` / `chore:` / `test:` etc. | None (skipped on reset-on-release) |

See `standards/conventional-commits.md` for details.

## Automation tools

| Tool | Characteristics |
|---|---|
| `semantic-release` | Determines the next version from the Git log → generates CHANGELOG → npm publish → GitHub Release, fully automated |
| `changesets` | For monorepos. Records changes explicitly in `.changeset/*.md`, then aggregates them for release |
| `release-please` | Made by Google. Auto-generates PRs |
| `standard-version` | Changelog + tag (deprecated; migrate to semantic-release or changesets) |

### Minimal semantic-release configuration

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    "@semantic-release/git"
  ]
}
```

An automatic release runs on push to `main`.

### changesets

Assign independent versions to each package in a monorepo:

```bash
pnpm changeset              # interactively record the change type (major/minor/patch)
pnpm changeset version      # aggregate and update each package.json
pnpm changeset publish      # npm publish + tag
```

It's common to auto-generate PRs in CI (`changesets/action`).

## How to handle breaking changes

### 1. Deprecation stage

```ts
/** @deprecated use `newFoo()` instead. Will be removed in 2.0.0 */
export function oldFoo() { /* ... */ }
```

Courtesy dictates waiting at least one MINOR version before removal.

### 2. Migration guide

At MAJOR release time, document the upgrade steps in `MIGRATION.md` or the CHANGELOG:

```markdown
## Migration to 2.0.0

### Removed `oldFoo()`
- Before: `oldFoo(x)`
- After:  `newFoo(x, { legacy: true })`
```

### 3. Codemod

For large breaking changes, providing an automated conversion script (e.g., `jscodeshift`) helps drive adoption.

## Differences between libraries and internal apps

| Aspect | Library (has a public API) | Internal app |
|---|---|---|
| SemVer compliance | Required | Recommended but not strict |
| How versions are bumped | Automated via semantic-release, etc. | Can be per commit / tag |
| Pre-release | Pre-release testing required | Can be substituted with a deploy environment |
| Changelog | Required | Optional |

For internal deployments, **date-based** (`2026.04.18`) or **build number** schemes are also practically fine.

## Common mistakes

1. **Shipping a breaking change as PATCH** — users following `^` get broken all at once. Bump MAJOR instead
2. **Bumping MINOR when intending a MAJOR-level change within 0.x** — `0.4.x` → `0.5.0` is allowed to include breaking changes, but it's important to state this explicitly
3. **Ordering between pre-releases** — `1.0.0-beta` < `1.0.0-beta.1`. `.1` is treated as a normal increment
4. **Using build metadata for precedence comparison** — don't. `+metadata` is for identification only
5. **Mismatch between tag and package.json** — the `v1.2.3` tag and `"version": "1.2.3"` must always stay in sync

## Implications for AI agent operations

- For dependency update PRs (Renovate, etc.), verify that the `^` range doesn't cross a MAJOR boundary
- Automated releases depend on the quality of Conventional Commits → enforce linting rigorously
- Version consistency in a monorepo is maintained with tools like changesets
- Keep "internal snapshot distribution" and "public stable release" as separate processes

## References

- [Semantic Versioning 2.0.0 (Japanese translation)](https://semver.org/lang/ja/)
- [npm semver calculator](https://semver.npmjs.com/)
- `standards/conventional-commits.md` — commit message convention
- `tools/renovate.md` — range strategy details
