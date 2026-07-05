---
reviewed: 2026-05-04
tags: [methodology, git-hook]
---

# Conventional Commits

A specification that standardizes the format of commit messages. Enables automated generation from history (CHANGELOG, semantic versioning) and makes the intent of changes machine-readable.

Official spec: [conventionalcommits.org](https://www.conventionalcommits.org/)

## Basic Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- **type**: change category (required, see below)
- **scope**: area affected (optional). Example: `api`, `ui`, `deps`
- **description**: aim for under 50 characters, present imperative tense (`add`, `fix`, not `added`, `fixes`)
- **body**: background/motivation for the change. Wrap at 72 characters
- **footer**: `BREAKING CHANGE:`, `Refs: #123`, etc.

## Type List

| type | purpose | typical examples |
|---|---|---|
| `feat` | new feature | new API, new screen, new CLI option |
| `fix` | bug fix | crash fix, fixing incorrect output |
| `docs` | documentation only | README, comments, knowledge updates |
| `style` | formatting only (no behavior change) | formatter, semicolon adjustments |
| `refactor` | refactoring | cleanup/abstraction with no behavior change |
| `perf` | performance improvement | algorithm optimization, adding caching |
| `test` | tests only | adding or fixing tests |
| `build` | build system | tsconfig, adding dependencies to package.json |
| `ci` | CI configuration | GitHub Actions, lefthook |
| `chore` | miscellaneous | gitignore, tool configuration (anything not covered above) |
| `revert` | revert | commits from `git revert` |

## Breaking Change

Append `!` right after `type`, or write `BREAKING CHANGE:` in the footer.

```text
feat!: redesign authentication flow

BREAKING CHANGE: `/auth/login` endpoint no longer accepts email+password.
Migrate to `/auth/oauth` instead.
```

Tools like semantic-release detect `!` / `BREAKING CHANGE` and perform a MAJOR bump.

## Scope

Indicates the area of change briefly in parentheses. Optional, but strongly recommended for monorepos and large repositories.

```text
feat(api): add pagination to /users
fix(ui): correct button alignment on mobile
build(deps): bump zod to 3.25.23
```

## Writing the Description

- **Write in English** (compatibility with agents/CI tools, easy to grep)
- **Present imperative tense** (`add`, `fix`, `update`). Do not use `added`, `fixing`
- **Lowercase first letter** (avoid capitalizing after the `fix` prefix, for consistency)
- **No trailing period**
- **No subject** (`add`, not `I added`)

### OK / NG Examples

```text
# OK
feat: add rate limit to search endpoint
fix(auth): handle expired JWT with 401 response
docs: update MCP registration instructions

# NG
feat: Added rate limit.              # past tense, capitalized, trailing period
Fix: searching is broken             # missing colon-style separation after type, vague description
update stuff                          # no type, vague
```

## Enforcement Tools

Automate validation at commit time:

- **commitlint** (`@commitlint/cli` + `@commitlint/config-conventional`): message validation
- **lefthook** / **husky**: run commitlint via a `commit-msg` hook
- **semantic-release**: determines the next version from type and auto-releases
- **changesets**: version management for monorepos

Minimal `.commitlintrc.json` configuration:

```json
{ "extends": ["@commitlint/config-conventional"] }
```

Invoking from lefthook:

```yaml
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

## Aligning with Branch Naming

Combined with the `<type>/<short-description>` convention, the type stays consistent between branch and commit, and the PR title can reuse it directly.

```text
Branch:      feat/add-rate-limit
Commit:      feat(api): add rate limit to search endpoint
PR title:    feat(api): add rate limit to search endpoint
```

## Multi-line Messages

When including a body/footer, passing via HEREDOC is safer (avoids escaping mishaps):

```bash
git commit -m "$(cat <<'EOF'
feat(api): add rate limit to search endpoint

Limit: 60 req/min per API key. Returns 429 with Retry-After header.

Refs: #234
EOF
)"
```
