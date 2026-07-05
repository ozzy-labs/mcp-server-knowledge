---
reviewed: 2026-05-05
tags: [github, ci]
---

# GitHub Environments

GitHub Actions' **Environments** is a mechanism for separating secrets / variables / approval gates per deployment target (`production`, `staging`, etc.). Attaching `environment:` to a job applies its protection rules.

Official: [Managing environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment)

Related articles:

- [`platforms/github/github-actions.md`](github-actions.md)
- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md) (a typical example of requiring `environment:` with OIDC)

## What it solves

| Problem | Solved by Environments |
|---|---|
| Don't want production secrets visible to all jobs | Expose as environment-scoped secrets, only to targeted jobs |
| Want a human approval gate before production deploy | Required reviewers |
| Want to forbid production deploy from branches other than `main` | Deployment branch policy |
| Want a 5-minute grace period before production deploy (for rollback) | Wait timer |
| Want to scope npm publish OIDC trust policy by environment name | `sub` claim includes `environment:production` |

## Creating an environment

Create it from `Settings > Environments > New environment`. Name must be 255 characters or fewer, case-insensitive, and unique within the repository.

## Using it from a workflow

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production           # simple form
    steps:
      - run: ./deploy.sh
        env:
          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}    # resolves the production secret
```

Form with a URL (shows the deployment target URL in the Job Summary):

```yaml
environment:
  name: production
  url: https://app.example.com
```

For a deployment that passes through multiple environments in sequence, split into separate jobs chained with `needs:`:

```yaml
jobs:
  deploy-staging:
    environment: staging
    steps: [...]
  deploy-prod:
    needs: deploy-staging
    environment: production
    steps: [...]
```

## Protection rules

### Required reviewers

Specify up to 6 people (or 6 teams). The job stays in a waiting state until at least one (or the configured number) of the specified reviewers approves.

- **Self-review prevention**: can be configured so the person who triggered the workflow cannot approve it
- Other jobs continue to run while approval is pending (unless chained via `needs:`)

### Wait timer

Up to 43,200 minutes (30 days). The job always waits the specified time before starting. E.g. "a 5-minute grace period after approval for a final rollback check."

### Deployment branch / tag policies

```text
- Selected branches and tags
  - main
  - release/*
  - tags: v*
```

Specified with wildcards (fnmatch). Choosing `Protected branches only` allows only branches protected by branch protection.

### Custom deployment protection rules

GitHub App-based extended protection (integration with external approval systems, change management tools, etc.). Enabled by installing a third-party App.

### Admin bypass

A toggle for whether repository admins can skip protection rules. Should be OFF for production as a rule.

## Environment secrets / variables

| Scope | Reference | Use |
|---|---|---|
| Repository | `${{ secrets.X }}` / `${{ vars.X }}` | Visible from all jobs |
| Environment | `${{ secrets.X }}` / `${{ vars.X }}` (only jobs within the environment) | Per deployment target |
| Organization | `${{ secrets.X }}` | Shared across multiple repositories |

Precedence: **Environment > Repository > Organization**. When names collide, the environment value wins.

## Combining with OIDC

The OIDC `sub` claim includes the environment name:

```text
repo:your-org/my-app:environment:production
```

By having the cloud-side trust policy allow only subs containing `environment:production`, you get a design where staging jobs cannot touch production resources:

```json
{
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:sub":
        "repo:your-org/my-app:environment:production"
    }
  }
}
```

npm Trusted Publishers can also require `environment:`. See [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md) for details.

## Deployment history

Per-environment history can be viewed in the `Deployments` tab of the GitHub UI. Each deployment has an Active / Inactive state, and rollback-equivalent operations can be done via the API.

## API

```bash
# list environments
gh api repos/:owner/:repo/environments

# get protection rules
gh api repos/:owner/:repo/environments/production

# set secrets
gh secret set DEPLOY_KEY --env production
```

## Common mistakes AI agents make

1. **Forgetting to attach `environment:` and getting confused when environment secrets aren't visible** — tends to assume the secret is at repository scope. Check the actual entry at `Settings > Environments > <name> > Environment secrets`
2. **Running a production deploy in parallel with staging without `needs:`** — this defeats the purpose of staged deployment. Enforce ordering with `needs:`
3. **Setting Required reviewers to "everyone"** — since the job proceeds once even one person approves, specifying multiple reviewers behaves as OR. If you want AND, use an App-based custom rule
4. **Not scoping the environment name in the OIDC trust policy** — allows a staging workflow to reach production resources
5. **Embedding a URL containing secrets in `environment.url`** — this appears in the Job Summary, risking information leakage

## References

- [About environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/managing-environments-for-deployment)
- [Configuring OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect)
- [Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
