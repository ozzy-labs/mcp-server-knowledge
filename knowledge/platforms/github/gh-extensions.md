---
reviewed: 2026-05-04
tags: [github, cli, extension]
---

# GitHub CLI Extensions

An extension mechanism that lets users add subcommands to `gh`. Installing a GitHub repository named with the `gh-*` convention lets you call it as `gh foo ...`, just like a built-in command. Supports Bash scripts, Go binaries, and precompiled extensions in any language.

Official: [Using GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/using-github-cli-extensions) / [Creating GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/creating-github-cli-extensions) / [`gh extension` manual](https://cli.github.com/manual/gh_extension)

For installing/authenticating `gh` itself and basic commands, see [`gh-cli.md`](gh-cli.md).

## How it works

- A repository is recognized as an extension if its name starts with the `gh-` prefix and it has an executable file at the repo root matching the repo name (`gh-foo` or `gh-foo.exe`)
- Extensions are installed locally in user scope (not shared across machines/users)
- Binary extension directories carry a `manifest.yml` recording `Owner` / `Name` / `Tag` / `IsPinned`, etc.

### Install path

| OS | Default path |
|---|---|
| Linux / macOS | `~/.local/share/gh/extensions/` |
| Windows | `%LocalAppData%\GitHub CLI\extensions\` |

Setting `XDG_DATA_HOME` takes precedence.

## Management commands

### install

```bash
# Basic
gh extension install owner/gh-foo

# Full GHES URL
gh extension install https://ghe.example.com/owner/gh-foo

# Install the extension in the current directory locally (for development)
gh extension install .

# Pin a version (release tag for binary extensions, commit ref for script extensions)
gh extension install owner/gh-foo --pin v1.2.3

# Force overwrite if the same name already exists
gh extension install owner/gh-foo --force
```

| Flag | Description |
|---|---|
| `--pin <ref>` | Pin to a release tag or commit ref |
| `--force` | Overwrite an existing install |

As of `gh` 2.90.0 (2026-04), `gh extension install` only handles public release assets, so it **works without authentication**.

### list / upgrade / remove

```bash
# List (upgradable extensions are marked)
gh extension list      # alias: gh ext ls / gh extensions ls

# Upgrade
gh extension upgrade gh-dash
gh extension upgrade --all
gh extension upgrade --all --dry-run    # preview only, no changes
gh extension upgrade gh-dash --force

# Remove
gh extension remove gh-dash
```

Pinned extensions (`--pin`) are skipped even by `upgrade --all`.

### search / browse

```bash
# Keyword search (default: top 30 by star count desc)
gh ext search dashboard
gh ext search --owner github
gh ext search --sort updated --order desc --limit 10
gh ext search --license MIT --json fullName,description

# TUI browser (interactive install / remove / upgrade)
gh ext browse
gh ext browse --single-column   # for accessibility
```

Key `search` flags:

| Flag | Description |
|---|---|
| `--sort` | `forks` / `help-wanted-issues` / `stars` / `updated` |
| `--order` | `asc` / `desc` |
| `--owner` | Filter by owner |
| `--license` | Filter by license |
| `--limit` / `-L` | Number of results (default 30) |
| `--json` / `--jq` / `--template` | Machine-readable output |

### exec

A workaround for when an extension name collides with a core `gh` command. Forces the extension to run using its short name (`foo` for `owner/gh-foo`).

```bash
gh extension exec foo args...
```

## Creating extensions

### Bash script extension (simplest)

```bash
gh extension create gh-hello
cd gh-hello
# Write logic in the gh-hello executable, then push and cut a release
```

The scaffold includes a repo already initialized with a `gh-foo` shell script. Any interpreted language (Python, Ruby, etc.) works the same way as long as the shebang works and `gh-foo` is executable.

### Go precompiled extension

```bash
gh extension create --precompiled=go gh-hello
```

Also bundles a GitHub Actions workflow (`cli/gh-extension-precompile`) that attaches binaries for each OS/arch to the release just by pushing a tag.

### Precompiled extensions in other languages

```bash
gh extension create --precompiled=other gh-hello
# Write your own script/build.sh
```

Naming convention for release-attached binaries: `gh-<name>_<version>_<os>-<arch>[.exe]`.

### `cli/gh-extension-precompile` Action

The official Action that automates cross-compiling Go extensions and publishing the release.

```yaml
name: release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cli/gh-extension-precompile@v2
        with:
          go_version_file: go.mod
```

Main inputs:

| Input | Purpose |
|---|---|
| `go_version` / `go_version_file` | Specify Go version |
| `go_build_options` | Additional `go build` flags |
| `build_script_override` | Custom build script for non-Go extensions |
| `gpg_fingerprint` | GPG-sign checksums |
| `generate_attestations` | Generate build-provenance attestations |
| `release_android` | Enable the Android target (disabled by default in v2) |

Notes:

- Tags containing a hyphen (e.g. `v2.0.0-rc.1`) are automatically published as a **prerelease**
- Builds with `CGO_ENABLED=0` (except for Android)
- v1 fails with newer Go, so **use the v2 line**

Adding the `gh-extension` repo topic gets you listed on `github.com/topics/gh-extension` and in `gh ext search` results.

## Notable extensions

| Extension | Purpose |
|---|---|
| `dlvhdr/gh-dash` | PR / Issue dashboard TUI |
| `github/gh-aw` | GitHub Agentic Workflows |
| `github/gh-actions-importer` | Migrate to Actions from other CI/CD |
| `github/gh-gei` | GitHub-to-GitHub migration (GitHub Enterprise Importer) |
| `github/gh-skyline` | 3D visualization of contributions |
| `seachicken/gh-poi` | Bulk-delete merged local branches |
| `Link-/gh-token` | Fetch GitHub App installation tokens |
| `basecamp/gh-signoff` | Local CI sign-off |

Search: `gh ext search`, or [github.com/topics/gh-extension](https://github.com/topics/gh-extension).

### Extensions absorbed into core or deprecated

- **`github/gh-projects`** has been **merged into core** as `gh project` (the repo is archived). `gh project create / list / view / item-add / item-edit / field-list` etc. are available. `--user` / `--org` were consolidated into `--owner`
- **`github/gh-copilot`** was deprecated on 2025-09-25. As of 2026-01-21, `gh copilot` acts as an installer/forwarder for the new agentic GitHub Copilot CLI

## Handling in CI

GitHub-hosted runners come with `gh` preinstalled, so you only need to pass auth via env to add extensions.

```yaml
- name: Install gh extension
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    gh extension install owner/gh-foo --pin v1.2.3
    gh foo --help
```

Notes:

- Public extensions can be installed unauthenticated since `gh` 2.90.0, but in CI you should **always require `--pin <tag>`** for reproducibility
- Installing extensions from private repos requires a PAT / GitHub App token, not `GITHUB_TOKEN` (`GITHUB_TOKEN` only has permissions on the running repo)
- Copilot-related (`gh copilot`) commands assume OAuth and are not supported for CI use

## Security

- The official docs state plainly: "**extensions not made by GitHub are not certified, signed, or endorsed by GitHub**." Installing one means fetching and running an executable from an arbitrary repo — **reviewing the source before installing** is the user's responsibility
- Use `--pin <tag>` for supply-chain attack resistance (avoids pulling in a later malicious release)
- Publishers can use `cli/gh-extension-precompile`'s `gpg_fingerprint` / `generate_attestations` to add checksum signing and build-provenance attestation
- In organizational use, enforce an "only install approved extensions" policy plus check owners with `gh extension list`

## Common mistakes AI agents make

1. **Forgetting the `gh-` prefix** — a repo named `my-tool` won't be recognized as an extension. Always create/publish it as `gh-my-tool`
2. **Writing `gh extension install` without flags in CI** — with no version specified, it pulls the latest release and can break unexpectedly one day. Always add `--pin <tag>` in CI
3. **Installing `gh-projects` fresh** — it's already merged into core as `gh project`. Use the built-in command for new setups, don't install the extension
4. **Creating an extension name that collides with a core `gh` command** — names like `gh-pr` or `gh-issue` get shadowed by the core command. Colliding names force users into `gh extension exec`, which is a poor experience
5. **Using `GITHUB_TOKEN` for a private extension** — it lacks permissions on other repos, causing a 404. Use a PAT or GitHub App token
6. **Copying `gh-extension-precompile@v1` from a template** — builds fail with newer Go. New extensions should use `@v2`

## References

- [Using GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/using-github-cli-extensions)
- [Creating GitHub CLI extensions](https://docs.github.com/en/github-cli/github-cli/creating-github-cli-extensions)
- [`gh extension` manual](https://cli.github.com/manual/gh_extension)
- [`cli/gh-extension-precompile`](https://github.com/cli/gh-extension-precompile)
- [github.com/topics/gh-extension](https://github.com/topics/gh-extension)
