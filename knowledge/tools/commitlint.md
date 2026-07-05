---
reviewed: 2026-05-04
tags: [lint, git-hook, javascript]
---

# commitlint

A Node.js linter that validates whether commit messages follow a convention such as Conventional Commits. It runs in the `commit-msg` Git hook to block non-compliant commits locally. Pairs with `standards/conventional-commits.md`.

Official site: [commitlint.js.org](https://commitlint.js.org/)

## Installation

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

As of 2026-05, the current line is v20.5 (latest v20.5.3, released 2026-04-30, requires Node 20 or higher).

## Minimal configuration

For ESM projects, `.mjs` is recommended (see the Pitfalls section below):

```js
// commitlint.config.mjs
export default { extends: ['@commitlint/config-conventional'] };
```

YAML format `.commitlintrc.yaml`:

```yaml
extends:
  - "@commitlint/config-conventional"
```

## Invoking from lefthook

Run it in the `commit-msg` stage:

```yaml
# lefthook.yaml
commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}
```

`{1}` is the path to `.git/COMMIT_EDITMSG`. Without `--edit`, commitlint tries to read the commit message from stdin and hangs.

With husky v9:

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

## Rule syntax

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
    'scope-enum': [2, 'always', ['api', 'web', 'infra']],
  },
};
```

`[level, applicable, value]`:

| Element | Value | Meaning |
|---|---|---|
| level | `0` / `1` / `2` | disabled / warning / error |
| applicable | `always` / `never` | apply the rule / invert it |
| value | any | rule-specific value (length, allow-list, etc.) |

## Commonly used rules

| Rule | Default | Purpose |
|---|---|---|
| `type-enum` | Conventional Commits' standard 11 types | restrict allowed types |
| `type-empty` | `[2, 'never']` | disallow omitting type |
| `scope-enum` | (unset) | restrict scope to specific values |
| `subject-case` | `[2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']]` | restrict casing of the subject |
| `subject-empty` | `[2, 'never']` | require a subject |
| `subject-full-stop` | `[2, 'never', '.']` | disallow a trailing period on the subject |
| `header-max-length` | `[2, 'always', 100]` | max length of the header line |
| `body-max-line-length` | `[2, 'always', 100]` | max length of each body line |
| `body-leading-blank` | `[1, 'always']` | require a blank line before the body |
| `footer-leading-blank` | `[1, 'always']` | require a blank line before the footer |

For the full rule list, see [reference/rules](https://commitlint.js.org/reference/rules.html).

## CLI

```bash
# One-off validation (no args reads from stdin)
echo "feat: add login" | pnpm exec commitlint

# Validate .git/COMMIT_EDITMSG (invoked from a hook)
pnpm exec commitlint --edit .git/COMMIT_EDITMSG

# Validate a range of past commits
pnpm exec commitlint --from=origin/main --to=HEAD
```

## Validating in CI

Example that validates all commits in a PR:

```yaml
# .github/workflows/commitlint.yaml
on: [pull_request]
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec commitlint --from=${{ github.event.pull_request.base.sha }} --to=${{ github.event.pull_request.head.sha }}
```

For squash-merge workflows, validating the PR title is lighter (implement it on the GitHub Actions side).

## Relationship to Conventional Commits

- `@commitlint/config-conventional` loads the rules from [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog)
- For implementation-level convention details, see `standards/conventional-commits.md`
- Keep aligned with: `standards/semver.md`, `tools/release-please.md`

## Common mistakes AI agents make

1. **Forgetting the `--edit` argument** — if you forget to pass `{1}` or `$1` in a `lefthook` / `husky` hook, it stalls waiting on stdin.
2. **Placing a `.js` config in an ESM project** — on Node 24+, a standalone `.js` config without `package.json` support fails with `Cannot use import statement`. Use `.mjs` or explicitly set `type: "module"`.
3. **Making `scope-enum` too strict, causing it to get disabled in practice** — introduce it as a warning (`level: 1`) first, and raise it to error once it's settled in.
4. **Duplicating linting on the PR title side** — if you run commitlint against the PR title under a squash-merge workflow, it's fine (a matter of preference) to also disable the per-commit `commit-msg` hook.

## References

- [commitlint official documentation](https://commitlint.js.org/)
- [Rule list](https://commitlint.js.org/reference/rules.html)
- [lefthook examples: commitlint](https://lefthook.dev/examples/commitlint/)
- [conventional-changelog repository](https://github.com/conventional-changelog/commitlint)
