---
reviewed: 2026-06-07
tags: [release, security, npm, github]
---

# npm Trusted Publishers (OIDC publishing)

A mechanism to **publish to the npm registry from CI without holding a long-lived secret (`NPM_TOKEN`)**. npm trusts an OIDC token issued on the CI side, eliminating the cost of managing and rotating tokens. GA in 2024. As of 2026-05, supported CI platforms are **GitHub Actions / GitLab CI/CD / CircleCI** (all cloud-hosted runners). **Self-hosted runners are not supported** (planned for the future).

Requirements (by publisher):

| Publisher | Minimum version | Provenance support |
|---|---|---|
| `npm publish` | npm CLI **v11.5.1+** / Node.js **v22.14.0+** | `--provenance` from v11.5.1+ |
| `pnpm publish` (recommended) | pnpm **v9.5+** / Node.js v22.14.0+ | `--provenance` officially supported from v9.5+ (v9.0-v9.4 carries a silent-fail risk, so always pin to v9.5 or later) |
| `yarn npm publish` | yarn berry **v4.0+** / Node.js v22.14.0+ | `--provenance` from v4.0+ |

Official: [docs.npmjs.com — Trusted Publishers](https://docs.npmjs.com/trusted-publishers)

## Why avoid `NPM_TOKEN`

| Item | `NPM_TOKEN` (legacy) | Trusted Publishers (OIDC) |
| --- | --- | --- |
| Auth method | Long-lived token in a repo secret | OIDC token issued per run |
| Leak risk | If the secret is extracted, publish is possible for 90 days to indefinitely | Token expires within minutes |
| Rotation | Periodic renewal is an operational burden | Not needed |
| Provenance attestation | Requires separate OIDC setup | Attached automatically in the same flow |
| Recommendation level | Only for maintaining compatibility on existing repos | **Recommended for both new and existing projects** |

`NPM_TOKEN` itself is not deprecated, but there is no strong reason to adopt it for new projects.

## Setup steps (GitHub Actions)

### 1. Register a Trusted Publisher on npmjs.com

1. Package page → Settings → Publishing
2. Add Trusted Publisher → select GitHub Actions
3. Enter the following:
   - Organization or User: `your-org`
   - Repository: `my-repo`
   - Workflow filename: `release.yaml`
   - Environment name (optional): `npm-publish`

This must be configured per package for each package in an org (`@scope/`). If there are multiple scoped packages, link all of them. **Only one Trusted Publisher can be configured per package** (you cannot register multiple workflows/repos simultaneously).

### 2. Choosing a trigger pattern

There are broadly two patterns for the publish workflow trigger. Both are valid; choose based on the repo's operational granularity.

#### Pattern A: `on: push: tags: ['v*']` (standalone publish workflow)

Place the publish job in its own workflow (`publish.yaml`), triggered by a tag push. Release tools such as release-please / changesets are kept in a separate workflow (`release-please.yaml`).

```yaml
# .github/workflows/publish.yaml
name: Publish

on:
  push:
    tags: ['v*']
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r publish --access public --provenance --no-git-checks
```

**Pros**: publish can be retried independently (doesn't re-run the release-please job), easy to re-publish manually via `workflow_dispatch`.
**Cons**: a manual tag push (e.g. `git push origin v1.2.3`) also triggers publish, leaving room for accidents from tags created outside the release tool.

#### Pattern B: `on: push: branches: [main]` + `needs: release-please` (unified workflow)

Place the `release-please` job and the `publish` job in the same workflow (`release.yaml`), and trigger publish only when release-please has created a release, using `needs: release-please` + `if: needs.release-please.outputs.release_created`.

```yaml
# .github/workflows/release.yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write
  id-token: write   # required to obtain the OIDC token

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v5
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
      - run: pnpm -r publish --access public --provenance --no-git-checks
```

**Pros**: release-please atomically gates the flow (a manual tag push will not publish), single workflow file is easier to maintain.
**Cons**: publish cannot be retried alone (re-running also re-runs the release-please job).

#### Which to choose

| Priority | Recommendation |
|---|---|
| Independent publish retry (recovering from transient npm-side failures) | **A** (tags trigger) |
| Preventing accidental manual tag pushes / single-workflow maintainability | **B** (branches + needs) |

Within ozzy-labs, **Pattern B (unified)** is the majority approach (e.g. `skills` / `create-agentic-app` / `create-agentic-aws` / `starlight-theme`). Repos that prioritize retry-ability choose **Pattern A (separated)** (e.g. `feedradar`).

### 3. Required: `permissions: id-token: write`

Without this, the OIDC token cannot be obtained and the Trusted Publisher will not work. If write access is also needed for `actions/checkout` etc., add `contents: write` separately.

### 4. `environment:` is **optional** (conditionally recommended)

An earlier version of this standard unconditionally demonstrated `environment: npm-publish`, but leaving it as an empty auto-created environment provides only limited benefit in practice:

- ✅ The OIDC token carries an `"environment": "npm-publish"` claim (functions as defense-in-depth only if the npm-side TP config requires an environment)
- ✅ Adds an entry to the GitHub Deployments tab (visibility only)

In other words, an `environment:` declared **without protection rules** amounts to nothing more than an "OIDC label + UI decoration." npm's own documentation also states the Environment field is **optional**.

There are 4 **legitimate reasons** to declare `environment:`:

- (a) **Required reviewers**: insert an approval gate before publish (e.g. publish is blocked unless the `security-team` team approves)
- (b) **Wait timer**: delay publish by a fixed amount of time (allowing room for emergency rollback)
- (c) **Deployment branches/tags restriction**: strictly restrict publish to only run from `main` branch or `v*` tags
- (d) **Environment-scoped secrets**: isolate secrets dedicated to publish at the environment scope (usually unnecessary since the TP flow needs no secret)

Declare `environment:` **only when you intend** to configure one or more of the above, and pair it with the corresponding protection rule set up on the npmjs.com TP configuration.

**If you're not configuring any of these, don't declare it**. A cargo-culted empty environment declaration only causes confusion, so avoid it.

```yaml
# Example declaring an environment (combining Required reviewers + tag restriction)
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-publish   # Required reviewers + Tags='v*' configured separately on the GitHub side
    # Also set environment='npm-publish' as Required in the npmjs.com TP configuration
    steps: ...
```

## Provenance attestation

Adding `--provenance` causes npm to **immutably record** the following at publish time:

- Which commit the build was made from (`source.commit`)
- Which workflow run performed the publish (`buildConfig.runId`)
- The build environment (runner OS / commit hash)

Users can verify this with `npm view <pkg> dist.attestations`. The combination of Sigstore + GitHub OIDC has become the standard for detecting supply chain attacks.

Notes:

- **When publishing from a private repository, provenance is not attached even if the package is public** (to avoid exposing the source link)
- **CircleCI does not support provenance** (OIDC authentication succeeds, but no attestation is issued)
- OIDC authentication only applies to `npm publish`. Other commands such as `npm token` still require traditional token authentication

## Publishing with pnpm / yarn

See the "Requirements" table at the top. Version pinning matters (pnpm v9.0-v9.4 carries a risk of `--provenance` silently failing). Specify the Node version with `actions/setup-node@v5`, and also pin the pnpm version explicitly via the `pnpm-version` input of `actions/setup-node` or with `corepack enable && corepack prepare pnpm@9.5.0 --activate` beforehand.

## Monorepo / org operations

### One monorepo / multiple scoped packages

`pnpm -r publish` publishes all publishable workspaces in a monorepo at once, but the Trusted Publishers configuration is required **per package**. For example, to publish `@scope/foo` and `@scope/bar` from the same repo, register **the same TP configuration (org/repo/workflow filename) for both packages** under Settings → Publishing on npmjs.com.

When adding a new package to the monorepo:

1. On npmjs.com, go to Settings → Publishing → Add Trusted Publisher for the target package
2. Register the same values for Organization / Repository / Workflow filename as the existing package
3. (Optional) if using `environment:`, register with the same environment name
4. Before the first publish, verify with `pnpm -r publish --dry-run --access public --provenance`

### ozzy-labs operations (checklist for adding a new scoped package)

Order of operations when launching a new `@ozzylabs/*` package under ozzy-labs:

- [ ] **Decide publication in the ADR / handbook**: does it actually need to be published to npm in the first place (if it's for internal use only, publishing may be unnecessary; referencing it only within the `pnpm` workspace is an alternative)
- [ ] **Reserve the package / register the scope on npmjs.com**: confirm `@ozzylabs/<name>` doesn't already exist (check publish permissions under org-wide settings → Members)
- [ ] **Register the Trusted Publisher on npmjs.com**:
  - Organization: `ozzy-labs`
  - Repository: `ozzy-labs/<repo-name>`
  - Workflow filename: same as existing packages (`release.yaml` or `publish.yaml`)
  - Environment: same operational choice as existing packages (none, or `npm-publish`)
- [ ] **Place the workflow**: use an existing package's release/publish workflow as a template (choose Pattern A or B)
- [ ] **Verify with a dry-run**: confirm it works with `--dry-run` before the first publish
- [ ] **release-please integration**: register the new package in `release-please-config.json` / `.release-please-manifest.json` (for monorepos)
- [ ] **`package.json` `publishConfig`**: set `{ "access": "public", "provenance": true, "registry": "https://registry.npmjs.org/" }`
- [ ] **Update handbook / README**: reflect the new package's existence in the ozzy-labs index

### Standardizing the publisher path org-wide

Within ozzy-labs, **pnpm adoption is the majority** (`feedradar` / `create-agentic-app` / `create-agentic-aws` / `skills` / `starlight-theme`, etc.). New packages should use `pnpm publish --provenance --access public` as the default. `npm publish` is the legacy path and should be avoided for new adoption (the npm CLI path requires an `npm install -g npm@latest` step beforehand, complicating the workflow).

## Migrating an existing `NPM_TOKEN` project

1. Register a Trusted Publisher on npmjs.com (step 1 above)
2. Update the workflow YAML — add `permissions: id-token: write`
3. Remove auth lines such as `npm publish`'s `--//registry.npmjs.org/:_authToken=${NPM_TOKEN}` (unnecessary once setup-node sets the URL via registry-url)
4. Verify with a single dry-run (`--dry-run`)
5. Remove `NPM_TOKEN` from the repo secret
6. If removing it from an org-wide secret, take time for a careful audit

If the first publish produces a "Trusted Publisher configuration not found" error, the npmjs.com configuration and the workflow path don't match (a typo in workflow filename / environment name is the usual cause).

## Combining with release-please / changesets

Neither tool touches publishing itself, so once the Release PR is merged, the above YAML can be incorporated into the `release-please --publish` / `changesets/action`'s `publish` step to coexist. Example:

```yaml
- uses: changesets/action@v1
  with:
    publish: pnpm -r publish --access public --provenance --no-git-checks
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    # NPM_TOKEN is not needed — authenticated via OIDC
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `403 Forbidden — you don't have permission` | Trusted Publisher not registered | Verify repository / workflow filename on npmjs.com |
| `OIDC token not available` | Missing `permissions: id-token: write` | Add it at the workflow/job scope |
| `cannot find environment 'X'` | Environment name mismatch with npm side | Match the npmjs.com config and the job's env name |
| `403` on a self-hosted runner | Self-hosted runners are unsupported for Trusted Publisher | Run the publish job only on a GitHub-hosted runner |
| OIDC auth fails due to an outdated npm CLI | npm CLI below v11.5.1 / Node below 22.14.0 | Specify Node 22.14+ with `actions/setup-node@v5` and run `npm i -g npm@latest` |
| Multiple scoped packages in one monorepo | Each package needs its own Trusted Publisher registration | `pnpm -r publish` will run, but watch out for missed registrations |

## Related

- [`tools/release-please.md`](../tools/release-please.md) — Automating release PRs driven by Conventional Commits
- [`standards/semver.md`](./semver.md) — Rules for determining version numbers
- [`standards/conventional-commits.md`](./conventional-commits.md) — Deriving the version bump from commit messages
- [`platforms/github/github-actions.md`](../platforms/github/github-actions.md) — Workflow / OIDC foundations
