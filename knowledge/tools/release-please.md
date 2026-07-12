---
reviewed: 2026-07-12
tags: [release, github, cloud-hosted]
---

# release-please

A release automation tool developed by Google. It determines the next version from Conventional Commits history and keeps a **single "Release PR"** always up to date with an updated `CHANGELOG.md`, `package.json`, etc. Merging the Release PR creates a GitHub Release and a Git tag. It's commonly used as a four-piece set together with `standards/conventional-commits.md` + `standards/semver.md` + `tools/commitlint.md`.

Official: [googleapis/release-please](https://github.com/googleapis/release-please) / [googleapis/release-please-action](https://github.com/googleapis/release-please-action)

> **Note**: The former `google-github-actions/release-please-action` is archived. Use `googleapis/release-please-action` now.

## Operating model

1. A developer merges to `main` using Conventional Commits format
2. Actions detects the update to `main` and parses commits since the last release
3. It computes the next version and creates/updates the Release PR with an appended `CHANGELOG.md` (always exactly one)
4. Merging the Release PR creates a Git tag and a GitHub Release

**It does not publish to registries** such as npm. Branch the publish job on the `release_created` output.

## Minimal workflow

```yaml
# .github/workflows/release-please.yaml
on:
  push:
    branches: [main]

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v5
        id: release
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

      - if: ${{ steps.release.outputs.release_created }}
        uses: actions/checkout@v6
      - if: ${{ steps.release.outputs.release_created }}
        run: pnpm publish --no-git-checks
```

As of 2026-07, the current major is `release-please-action@v5` (node24 runtime; the internal release-please library is in the 17.10.x line). v5.0.0 was released on 2026-04-22 as a major update.

## `release-please-config.json`

Single package:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "initial-version": "0.1.0",
      "bump-minor-pre-major": true,
      "changelog-sections": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" }
      ]
    }
  }
}
```

pnpm workspaces monorepo:

```json
{
  "packages": {
    "packages/cli": { "release-type": "node" },
    "packages/core": { "release-type": "node" }
  },
  "plugins": ["node-workspace"]
}
```

### Key fields

| Field | Description |
|---|---|
| `release-type` | `node` / `python` / `go` / `rust` / `simple`, etc. |
| `bump-minor-pre-major` | Treat `feat` as MINOR while in `0.x` (default is PATCH) |
| `bump-patch-for-minor-pre-major` | Treat MINOR as PATCH while in `0.x` |
| `initial-version` | The first release version |
| `changelog-sections` | Mapping from commit type to CHANGELOG heading |
| `changelog-path` | CHANGELOG output path (default `CHANGELOG.md`) |
| `include-commit-authors` | Include PR authors in the CHANGELOG |
| `draft` / `prerelease` | Adjust release treatment |
| `packages` | Per-package path → individual config |
| `plugins` | `node-workspace` / `cargo-workspace` / `linked-versions`, etc. |

All fields are documented in [customizing.md](https://github.com/googleapis/release-please/blob/main/docs/customizing.md).

## `.release-please-manifest.json`

A JSON mapping of package path → current version. It's automatically updated every time a Release PR is merged. You may initialize it as an empty `{}` or manually write existing versions.

```json
{
  ".": "0.2.0"
}
```

## Common commit types and CHANGELOG

Default section mapping (even without configuration):

| type | SemVer impact | CHANGELOG |
|---|---|---|
| `feat` | MINOR (PATCH while in `0.x`; MINOR with the flag above) | Features |
| `fix` | PATCH | Bug Fixes |
| `perf` | PATCH | — (specify explicitly via `changelog-sections`) |
| `docs` / `chore` / `refactor` / `test` / `ci` / `build` | None | Hidden |
| `feat!` / `BREAKING CHANGE:` | MAJOR (MINOR while in `0.x`) | Breaking Changes |

## Common mistakes by AI agents

1. **Forgetting `permissions`, so the Release PR can't be created** — `contents: write` / `issues: write` / `pull-requests: write` are required.
2. **Forgetting that merging the Release PR doesn't trigger other workflows** — tags created with `GITHUB_TOKEN` do not trigger downstream CI. If you want publishing to run, pass a GitHub App token or a PAT via `token:`.
3. **Leaving `bump-minor-pre-major` unset, so `0.x` stays PATCH forever** — for pre-release projects, this is usually set to `true`.
4. **Missing the `node-workspace` plugin, so internal dependencies don't get updated** — required for pnpm/yarn workspaces. Cargo uses `cargo-workspace`.
5. **Placing `release-please-config.json` but it has no effect** — v4's default is manifest mode. Confirm both `config-file` and `manifest-file` are specified.

## Comparison with other tools

| Tool | Characteristics |
|---|---|
| release-please | Release PR approach. The **next** release candidate is always visible as a single PR |
| semantic-release | Tags immediately. Publishes a release right after a commit; no human review |
| changesets | Adds a "changeset file" per PR. Popular with pnpm workspaces |
| release-it | Manually invoked interactive CLI |

The Release PR model's strength is **"pre-review of releases."** It suits teams that don't want to fully automate tag-and-publish.

## References

- [release-please repository](https://github.com/googleapis/release-please)
- [release-please-action](https://github.com/googleapis/release-please-action)
- [Manifest Releaser Docs](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)
- [Customizing Releases](https://github.com/googleapis/release-please/blob/main/docs/customizing.md)
