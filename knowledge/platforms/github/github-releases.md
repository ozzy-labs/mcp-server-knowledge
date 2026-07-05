---
reviewed: 2026-05-05
tags: [github, release]
---

# GitHub Releases

A GitHub feature that provides release artifacts and release notes tied to Git tags. Beyond cutting tags, it supports automatic ZIP / tarball generation, binary asset attachment, auto-generated release notes, and draft / pre-release management.

Official: [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)

Related articles:

- [`tools/release-please.md`](../../tools/release-please.md) (release notes and PR-driven automation)
- [`standards/semver.md`](../../standards/semver.md)
- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md) (pattern combined with npm publish)
- [`platforms/github/gh-cli.md`](gh-cli.md#release)

## Model

```text
Git tag (v1.2.3)  ──linked to──▶  GitHub Release
                                 ├─ Title / body (release notes)
                                 ├─ Source archive (zip / tarball, auto-generated)
                                 ├─ Assets (binaries etc. attached manually / via CI)
                                 ├─ State: draft / pre-release / latest
                                 └─ Discussion (optional)
```

- 1 tag = 1 release
- Specifying a name for a tag that doesn't exist creates the tag on release publish
- Archives (`v1.2.3.zip` / `v1.2.3.tar.gz`) are auto-generated from the tag (no manual attachment needed)

## State

| State | Purpose | Behavior |
|---|---|---|
| **Draft** | Under internal review | Not yet published. Visible only to users with write access |
| **Pre-release** | RC / beta | Published, but not treated as `latest` |
| **Latest** | Regular release | Shown as latest by default. Only one at a time |

The `/releases/latest` URL returns the release flagged `Latest`. Since pre-releases don't become `latest`, you can publish an RC without breaking stable-version links.

## Auto-generated release notes

The `Generate release notes` button, or `gh release create --generate-notes`, generates release notes aggregating merged PRs since the previous tag.

### Customizing categorization via `.github/release.yaml`

```yaml
# .github/release.yaml
changelog:
  exclude:
    labels: [ignore-for-release, dependencies]
    authors: [dependabot, renovate]
  categories:
    - title: Breaking Changes
      labels: [breaking, semver-major]
    - title: New Features
      labels: [feat, feature]
    - title: Bug Fixes
      labels: [fix, bug]
    - title: Documentation
      labels: [docs]
    - title: Other Changes
      labels: ["*"]                  # catch-all for everything else
```

- Assumes PRs are labeled (a common pattern is CI that mirrors Conventional Commits types onto labels)
- Place the category containing `*` last (if placed earlier, it absorbs PRs that would otherwise match other categories)

## Creating from the CLI

```bash
# With auto-generated notes
gh release create v1.2.3 --generate-notes

# Notes file + asset attachment
gh release create v1.2.3 \
  --title "v1.2.3" \
  --notes-file CHANGELOG.md \
  dist/*.tar.gz dist/*.zip

# pre-release / draft
gh release create v1.2.3-rc.1 --prerelease
gh release create v1.2.3 --draft

# Publish a draft
gh release edit v1.2.3 --draft=false

# Add an asset
gh release upload v1.2.3 dist/extra.tar.gz

# Download
gh release download v1.2.3 --pattern "*.tar.gz"
```

## Automation with GitHub Actions

Create a release triggered by a tag push:

```yaml
# .github/workflows/release.yaml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: write       # required to create releases

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0      # full history required for auto release notes
      - run: |
          gh release create "${GITHUB_REF_NAME}" \
            --generate-notes \
            ./dist/*.tar.gz
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

There's also a form using `softprops/action-gh-release@v2`, but `gh release create` is sufficient in many cases.

## Relationship with release-please

[`tools/release-please.md`](../../tools/release-please.md) automates **Conventional Commits → release PR → tag + GitHub Release**.

- release-please: automatically maintains a "PR for the next version to ship," creating the tag and release on merge
- Manual / GitHub Actions only: developers have full control over when tags are cut

release-please suits continuous OSS releases; manual / Actions-only suits irregular releases.

## Asset limits

| Item | Limit |
|---|---|
| Assets per release | Max 1,000 |
| Size per asset | Max 2 GiB |
| Bandwidth limit | None |

For large artifacts, also push to a Container Registry or external storage (e.g. S3).

## Discussion link

```bash
gh release create v1.2.3 --discussion-category "Announcements"
```

For repositories with Discussions enabled under `Settings > General > Features > Discussions`, a discussion can be auto-opened for each release.

## API (GraphQL / REST)

```bash
# Get the latest release
gh api repos/:owner/:repo/releases/latest

# Get by tag name
gh api repos/:owner/:repo/releases/tags/v1.2.3

# Asset download URLs
gh api repos/:owner/:repo/releases/latest --jq '.assets[].browser_download_url'
```

## Common mistakes AI agents make

1. **Omitting `fetch-depth: 0`, resulting in empty auto-generated release notes due to insufficient history** — add `fetch-depth: 0` to the checkout step
2. **Forgetting `permissions.contents: write`, causing a 403** — write permission is required to create releases
3. **Placing the `*` category first in `categories:`, killing the other categories** — `*` must always be last
4. **Creating a release with the same tag name twice, causing failure** — update with `gh release edit`, or delete and recreate
5. **Distributing a pre-release via the `latest` URL** — without `--prerelease`, the latest URL ends up pointing at the RC
6. **Mixing `v1.2.3` and `1.2.3`** — pick a consistent prefix convention for the repository (a `v` prefix is recommended)

## References

- [About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)
- [Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)
- [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)
