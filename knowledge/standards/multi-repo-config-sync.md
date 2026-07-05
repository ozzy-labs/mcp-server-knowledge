---
reviewed: 2026-05-03
tags: [methodology]
---

# Config sync across multiple repositories

Design guidance for when you want to keep `.editorconfig` / `lefthook` / `biome.json` / `.github/workflows/` / agent config / Dev Container etc. **aligned across multiple repositories**. For multi-agent support within a single repository, see `ai/practice/multi-agent-repo.md`.

## The problem to solve

- Copy-pasting the same config into each repo → improvements don't propagate
- `git submodule` of a central repo → local customization is hard, high adoption barrier
- Consolidating into a monorepo → grows too large, breaks down on ownership / visibility / CI time

You need a model where "**each repo stays independent, but only the shared config is kept in sync**."

## Design options

| Approach | Sync method | Customization | Propagation timing |
|---|---|---|---|
| Manual copy-paste | Human copies periodically | Free | Irregular (degrades over time) |
| `git submodule` | Embedded as a subtree | Limited | Every `submodule update` |
| `git subtree` | Pulled in via squash merge | Free | Manual pull |
| **Central repo + sync script + pin list** | One-way sync from central to receiving repo, intentional divergence via `pinned` | Free at the file level | Scheduled workflow + Renovate |
| Cookiecutter / Yeoman | Initial generation only | Free | Cannot sync |
| Renovate config preset | Preset extension only | Limited to the preset's scope | Follows Renovate's schedule |

The central repo + sync script approach best balances **continuous propagation** and **local discretion**. This article details it as the "**commons pattern**."

## Components of the commons pattern

```text
[ commons repository ]
├── dist/                  ← distribution targets (synced)
│   ├── .editorconfig
│   ├── biome.json
│   ├── lefthook-base.yaml
│   ├── .github/workflows/
│   ├── .claude/
│   ├── .gemini/
│   └── .devcontainer/
├── templates/             ← copied once at init time (not synced)
│   ├── AGENTS.md
│   └── CLAUDE.md
├── sync.sh                ← script copied to and used by receiving repos
└── commons-sync.json      ← Renovate preset

[ receiving repository ]
├── .commons/
│   └── sync.yaml          ← sync metadata
├── sync.sh                ← obtained from commons
└── ...                    ← synced files
```

### `.commons/sync.yaml` (sync metadata)

```yaml
commit: a32c498f106b8684e2419ab7861e95e1bbef5445
synced_at: 2026-05-02T14:00:00Z
pinned:
  - CLAUDE.md
  - lefthook.yaml
  - .gitignore
```

| Key | Meaning |
|---|---|
| `commit` | HEAD SHA of commons at the last sync |
| `synced_at` | Time the sync was performed (ISO 8601) |
| `pinned` | List of files **intentionally diverging from commons**. Skipped during sync |

The `pinned` list is the crux. Instead of an "overwrite everything" policy, adopting "**explicitly declare what you want to exclude for local reasons**" lets receiving repos run sync without hesitation.

### `sync.sh` modes

| Mode | Purpose |
|---|---|
| Interactive (default) | Show diffs → choose `[y/N/pin/all]` for each file |
| `--yes` / `-y` | Non-interactive. Overwrite everything except `pinned` |
| `--dry-run` | Show diffs only, no apply |
| `--check` | Exit 1 if there is a diff (drift detection in CI) |

Choosing `pin` appends the filename to `pinned` in `.commons/sync.yaml`. Less error-prone than managing it by hand.

## Automating propagation

Combining two paths stops degradation:

### 1. Scheduled workflow in the receiving repo

```yaml
# .github/workflows/sync-commons.yaml
on:
  schedule: [{ cron: '0 0 * * 1' }]    # every Monday
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6
      - run: ./sync.sh --check
        continue-on-error: true
        id: check
      - if: steps.check.outcome == 'failure'
        run: ./sync.sh --yes
      - if: steps.check.outcome == 'failure'
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/commons-sync
          title: 'chore(commons): sync to latest'
          commit-message: 'chore(commons): sync to latest'
```

It only opens a PR — no auto-merge. This preserves a review opportunity.

### 2. Renovate preset

```json
// commons-sync.json (in the commons repository)
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^\\.commons/sync\\.yaml$"],
      "matchStrings": ["commit:\\s+(?<currentDigest>[a-f0-9]+)"],
      "depNameTemplate": "your-org/commons",
      "datasourceTemplate": "git-refs",
      "currentValueTemplate": "main"
    }
  ]
}
```

```json
// renovate.json in the receiving repo
{
  "extends": ["github>your-org/commons:commons-sync"]
}
```

Renovate opens a PR that rewrites the `commit:` line in `.commons/sync.yaml` to the new SHA. Once merged, the next scheduled workflow run (or `workflow_dispatch`) performs the actual sync. **Separation of concerns between Renovate and the workflow**:

- Renovate: decides on the SHA update (rides along with the dependency-update context)
- workflow: performs the actual file sync (with verification when diffs are large)

This shortens the "wait until next week" turnaround to "within a few hours."

## Separating distribution artifacts from init artifacts

| Type | Location | Initial | Ongoing sync |
|---|---|---|---|
| Distribution artifact | `commons/dist/` | Obtained via sync | Updated via sync |
| Init artifact | `commons/templates/` | Copied manually | **Not synced** |

`templates/` files are meant to be "referenced once at the start, then customized for the specific project." **Instruction files** like `AGENTS.md` / `CLAUDE.md` are the representative case. Putting these in `dist/` would overwrite hard-won customizations.

## Receiving repo init flow

```bash
# setup-repo.sh auto-configures GitHub repo creation + Branch Protection etc.
gh repo create my-org/my-app --private
./setup-repo.sh my-org/my-app

# initialize commons
mkdir .commons
echo 'commit: <main SHA>' > .commons/sync.yaml
curl -fsSL https://raw.githubusercontent.com/<org>/commons/main/sync.sh > sync.sh
chmod +x sync.sh
./sync.sh --yes

# copy initial files
curl -fsSL .../templates/AGENTS.md > AGENTS.md
curl -fsSL .../templates/CLAUDE.md > CLAUDE.md

git add . && git commit -m "chore: initialize from commons"
```

Wrapping this inside `setup-repo.sh` lets you bring a new repo to "commons-synced, Branch-Protection-configured" state with a single command.

## Where to draw the line

| File | Should it be dist? |
|---|---|
| `.editorconfig` / `biome.json` / `lefthook-base.yaml` | **dist** (should be identical across all repos) |
| Generic workflows under `.github/workflows/` | dist |
| `lefthook.yaml` (project-specific hook additions) | **pin candidate** (should extend the `lefthook-base.yaml` in dist) |
| `.gitignore` | Project-specific → pin |
| `AGENTS.md` / `CLAUDE.md` | **templates** (initial copy only) |
| `package.json` / `pyproject.toml` | Not dist (project-specific) |

When in doubt, **put it in dist and give yourself an escape hatch via pin**. If too many pins accumulate, that's a signal to retire the dist file.

## Anti-patterns

1. **Making commons a submodule** — receiving repos must remember to `git pull` for updates, and CI needs submodule support too. Gets rejected
2. **Auto-merging sync** — eliminates the review opportunity. High risk of a config mistake propagating to every repo
3. **Keeping `pinned` around indefinitely like a `.gitignore`** — pins accumulating → sync's value erodes → signal to retire it
4. **Packing "company-wide conventions" into commons** — `dist/` should be the least common denominator. Split into sub-repos by team / language / project category if needed
5. **Mixing `templates/` into `dist/`** — gets overwritten. Keep them clearly separate
6. **Making commons public while the receiving repo is private, causing the workflow to lack a token** — design access via a fine-grained PAT or a GitHub App

## Implications for AI agents

- Checking `.commons/sync.yaml` in a receiving repo tells you "which central repo it tracks." Before changing a config file, first check whether it's in pinned
- Changing a config file that is not in pinned will be **overwritten** on the next sync. Config changes should either go as a PR to commons, or be pinned in the receiving repo
- **base** files like `lefthook-base.yaml` are meant to be inherited. Read them assuming they're pulled in via `extends:` in `lefthook.yaml`

## Related

- [`ai/practice/multi-agent-repo.md`](../ai/practice/multi-agent-repo.md) — design for coexisting multiple AI agents within a single repository (used in combination with the commons pattern)
- [`tools/renovate.md`](../tools/renovate.md) — details on presets / customManagers
- [`tools/lefthook.md`](../tools/lefthook.md) — model for inheriting base config via `extends`
- [`platforms/github/github-actions.md`](../platforms/github/github-actions.md) — scheduled workflow / `peter-evans/create-pull-request`

## References

- [Renovate custom managers](https://docs.renovatebot.com/modules/manager/regex/)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
- [GitHub Branch Protection / Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
