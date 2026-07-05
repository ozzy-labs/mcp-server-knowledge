---
reviewed: 2026-05-10
tags: [standards, infrastructure]
---

# Software Distribution Methods

Key approaches for delivering tools and applications to users' environments. Broadly divided into three tiers: OS level, language runtime level, and direct distribution.

Official documentation and repository READMEs often list several of these together (e.g., providing `brew`, `npm`, and `curl | sh` all at once).

## OS Package Managers (System level)

Manage the entire OS filesystem, installing while resolving dependencies. Best suited when system-wide stability is the priority.

### Representative OS-level tools

| Tool | Target OS | Characteristics |
|---|---|---|
| `apt` | Debian / Ubuntu | The Linux standard. Installs to `/usr/bin` etc. Generally requires root privileges. |
| `Homebrew` | macOS / Linux | Installs under the user directory (`/opt/homebrew` etc.). The de facto standard for Mac development. |
| `WinGet` | Windows | Official Microsoft tool. Fetches and manages binaries from GitHub or the Store. |
| `apk` / `dnf` | Alpine / Fedora | Distribution-specific. `apk` is heavily used inside containers. |

## Language-specific Package Managers (Runtime level)

Distribution methods specialized for a particular programming language ecosystem. Widely used for distributing development tools (CLIs); requires that language's runtime.

### Major tools by language

| Tool | Language | Characteristics |
|---|---|---|
| `npm` / `pnpm` | JavaScript | `npm install -g` installs globally. `npx` allows ephemeral execution. |
| `uv` | Python | `uv tool install` (pipx-compatible) creates an isolated environment per tool. |
| `go install` | Go | Fetches source and builds locally, placing the binary in `GOBIN`. Fast. |
| `cargo install` | Rust | Builds from source, so installation takes longer, but the result is optimized. |

## Direct Distribution

Provides prebuilt binaries or scripts directly, bypassing a package manager.

### Methods

- **GitHub Releases**: Distributes prebuilt binaries (`.deb`, `.rpm`, `.zip`, `.tar.gz`) for specific OS/architecture combinations. Well suited to CI usage.
- **Installer Scripts**: The `curl -fsSL https://... | sh` style. Few dependencies and instant setup, but be mindful of the security risks of piping to a shell.
- **Mise (aqua)**: A tool that abstracts and manages binary distribution. Lets you pin versions declaratively, e.g., `mise use aqua:cli/cli`.

## Selection Criteria

| Perspective | Recommended method | Rationale |
|---|---|---|
| **General users (non-dev)** | OS package manager | Rides the OS update cycle and is easy to manage. |
| **Node.js developers** | `npm` / `pnpm` | The environment is already in place, so the adoption barrier is low. |
| **Rust tools** | `cargo install` / direct binary | e.g. [`ripgrep`](../tools/ripgrep.md), `fd`. Often distributed as a single binary. |
| **Python tools** | `uv` / `pipx` | Avoids polluting (conflicting with) the global Python environment. |
| **CI / automation environments** | Direct binary / `mise` | Install speed, reproducibility, and ease of permission management matter. |

## Common Mistakes AI Agents Make

1. **Inappropriate use of `sudo`** — Adding unnecessary `sudo` to `npm install -g` or `brew install`, triggering permission errors.
2. **Breaking the system environment** — Installing Python tools directly into the system Python via `pip install`, causing conflicts with OS-managed packages.
3. **Misidentifying architecture** — When downloading a binary with `curl`, using a fixed URL without distinguishing `x86_64` from `arm64` (e.g., Apple Silicon).
4. **Forgetting to update environment variables** — After installation, `~/.local/bin` or `~/go/bin` needs to be added to the PATH, but attempting to run the tool without accounting for this.

## References

- [Homebrew Documentation](https://docs.brew.sh/)
- [npm Docs: Downloading and installing packages globally](https://docs.npmjs.com/downloading-and-installing-packages-globally)
- [uv: Installing tools](https://docs.astral.sh/uv/guides/tools/)
- [GitHub CLI: Installation](https://cli.github.com/manual/)
