---
reviewed: 2026-05-04
tags: [go, release, ci]
---

# GoReleaser

An OSS tool that completes **cross-compilation + multi-channel distribution** of Go binaries in a single command. Write one `.goreleaser.yaml` and push a SemVer tag, and it automatically builds binaries for each OS/Arch, generates checksums, SBOMs, signatures, GitHub Releases, Homebrew taps, Docker pushes, apt/rpm packages, and more.

Official: [goreleaser.com](https://goreleaser.com/) / [GitHub](https://github.com/goreleaser/goreleaser)

Latest is the v2 series (v2.15+). **In v2, a `version: 2` header is required in the config.**

## Editions

OSS is fully featured for most needs. **Pro-only** features:

- Native signing/notarization of macOS `.pkg` / `.dmg` / `.app`
- Windows MSI / NSIS installers
- Two-stage prepare/publish releases, changelog preview
- Monorepo path filters, enhanced AI changelog
- npm publish, Cloudsmith / Gemfury integration
- Podman support, config include/templating
- License is passed via `GORELEASER_KEY`

## Installation

| Method | OSS | Pro |
|---|---|---|
| Homebrew | `brew install --cask goreleaser/tap/goreleaser` | `goreleaser/tap/goreleaser-pro` |
| go install | `go install github.com/goreleaser/goreleaser/v2@latest` | (not available) |
| Docker | `goreleaser/goreleaser` | `goreleaser/goreleaser-pro` |
| Snap | `sudo snap install --classic goreleaser` | — |
| apt / yum | Official repo (key setup required) | Same |
| script | `curl -sfL https://goreleaser.com/static/run \| VERSION=v2.15.4 bash -s -- check` | Same |

## Config file `.goreleaser.yaml`

```yaml
version: 2

before:
  hooks:
    - go mod tidy
    - go generate ./...

builds:
  - id: myapp
    main: ./cmd/myapp
    binary: myapp
    env:
      - CGO_ENABLED=0
    flags:
      - -trimpath
    ldflags:
      - -s -w -X main.version={{.Version}} -X main.commit={{.Commit}} -X main.date={{.Date}}
    goos: [linux, darwin, windows]
    goarch: [amd64, arm64]

archives:
  - id: default
    formats: [tar.gz]
    format_overrides:
      - goos: windows
        formats: [zip]
    name_template: >-
      {{ .ProjectName }}_{{ .Version }}_{{ .Os }}_{{ .Arch }}
    files:
      - LICENSE
      - README.md

checksum:
  name_template: checksums.txt

signs:
  - cmd: cosign
    artifacts: checksum
    args:
      - sign-blob
      - --bundle=${signature}
      - ${artifact}
      - --yes

sboms:
  - artifacts: archive

snapshot:
  version_template: "{{ .Version }}-SNAPSHOT-{{.ShortCommit}}"

changelog:
  use: github
  sort: asc
  groups:
    - title: Features
      regexp: '^.*?feat(\([[:word:]]+\))??!?:.+$'
      order: 0
    - title: Bug fixes
      regexp: '^.*?fix(\([[:word:]]+\))??!?:.+$'
      order: 1
  filters:
    exclude:
      - "^docs:"
      - "^chore:"

release:
  github:
    owner: your-org
    name: myapp
  prerelease: auto      # automatically treats vX.Y.Z-rc.N as a prerelease
  draft: false
```

## Key sections

| Section | Role |
|---|---|
| `version: 2` | Required for v2 |
| `before:` | Pre-release hooks (e.g. `go mod tidy`) |
| `builds:` | Cross-compilation definitions |
| `archives:` | tar.gz / zip generation, naming via `name_template` |
| `checksum:` | SHA256 checksums (default) |
| `signs:` | cosign / GPG signing |
| `sboms:` | SBOM generation (default: syft / SPDX-JSON) |
| `snapshot:` | Version used when there is no tag |
| `changelog:` | Auto-generated changelog (github / gitlab / git-based) |
| `release:` | GitHub / GitLab / Gitea Release |

## Distribution channels

| Key | Destination |
|---|---|
| `brews:` | Automatic PR to a Homebrew tap |
| `homebrew_casks:` | Cask for macOS GUI apps (v2.10+) |
| `nfpms:` | deb / rpm / apk / ipk / Archlinux |
| `dockers:` | Docker image (requires a Dockerfile) |
| `docker_manifests:` | Multi-arch manifest list |
| `kos:` | ko integration, Dockerfile-less |
| `winget:` | Automatic PR to winget-pkgs (OSS) |
| `aurs:` / `scoops:` / `chocolateys:` | AUR / Scoop / Chocolatey |
| `snapcrafts:` / `flatpaks:` | Snap / Flatpak |
| `npms:` | Pro only |

## Key commands

```bash
goreleaser init                              # generate a template
goreleaser check                             # validate config + deprecation warnings
goreleaser healthcheck                       # check required external tools (cosign, syft, docker, etc.)

# Local testing
goreleaser build --snapshot --clean          # build only, no tag needed
goreleaser release --snapshot --clean        # full dry run
goreleaser release --skip=publish,sign       # skip specific steps

# Production
goreleaser release --clean                   # full release on tag push
```

Flags removed in v2: `--rm-dist` (→ `--clean`), `--skip-*` (→ `--skip=...`), `--debug` (→ `--verbose`).

## CI integration (GitHub Actions)

```yaml
name: release
on:
  push:
    tags: ["v*"]
permissions:
  contents: write       # release / archive upload
  packages: write       # for GHCR push
  id-token: write       # for cosign keyless (OIDC)
jobs:
  goreleaser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0    # required: full history (for tag detection)
      - uses: actions/setup-go@v5
      - uses: sigstore/cosign-installer@v3   # if signing
      - uses: anchore/sbom-action/download-syft@v0   # if generating SBOMs
      - uses: goreleaser/goreleaser-action@v6
        with:
          distribution: goreleaser
          version: "~> v2"
          args: release --clean
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # GORELEASER_KEY: ${{ secrets.GORELEASER_KEY }}  # for Pro
```

`goreleaser-action` itself does **not** install Docker / GPG / Cosign, so they must be set up separately.

### Channels that require committing to another repo

Channels like `brews:` (Homebrew tap) and `scoops:` (Scoop bucket) involve committing to a different repo. Since `GITHUB_TOKEN` only has permissions on the executing repo, **a separate PAT must be passed via e.g. `HOMEBREW_TAP_GITHUB_TOKEN`**:

```yaml
env:
  HOMEBREW_TAP_GITHUB_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
```

## Signing / SBOM / Reproducibility

### cosign keyless (recommended)

Keyless signing using GitHub OIDC. Requires `id-token: write` permission:

```yaml
signs:
  - cmd: cosign
    artifacts: checksum
    args:
      - sign-blob
      - --bundle=${signature}
      - ${artifact}
      - --yes
```

Verification side: `cosign verify-blob --bundle file.tar.gz.sigstore.json file.tar.gz`.

### SBOM

```yaml
sboms:
  - artifacts: archive
```

By default, syft generates SPDX-JSON. Container images are not supported (use `cosign attest` separately for images).

### Reproducibility

`-trimpath` + fixed `ldflags` make builds nearly reproducible. `CGO_ENABLED=0` makes it even more stable.

## Common mistakes AI agents make

1. **Forgetting `fetch-depth: 0`** — with checkout's default shallow clone, past tags aren't visible and `goreleaser` fails with a "no tag" error
2. **Wrong tag format** — the **leading `v` in `vX.Y.Z` is required**. `1.0.0` won't be recognized as SemVer and will fail
3. **Forgetting the `version: 2` line** — a v1-style config in a v2 environment produces a warning (will become an error in the future). Validate with `goreleaser check`
4. **Using `GITHUB_TOKEN` for the Homebrew tap token** — can't commit to another repo. Issue a dedicated PAT and register it as a separate secret
5. **Using `--rm-dist`** — removed in v2. Use `--clean`
6. **Forgetting `id-token: write` for cosign keyless** — fails to obtain an OIDC token, causing signing to fail
7. **Trying to notarize macOS binaries with OSS** — not supported. Requires Pro

## References

- [Install](https://goreleaser.com/install/)
- [Customization](https://goreleaser.com/customization/)
- [GitHub Actions](https://goreleaser.com/ci/actions/)
- [v1 → v2 Migration](https://goreleaser.com/blog/goreleaser-v2/)
- [goreleaser-action](https://github.com/goreleaser/goreleaser-action)
