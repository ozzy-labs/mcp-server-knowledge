---
reviewed: 2026-06-28
tags: [package, version-manager, python, rust, fast]
---

# uv

A Python package and project manager by Astral. Written in Rust, it unifies `pip` / `pip-tools` / `pipx` / `poetry` / `pyenv` / `twine` / `virtualenv` into one tool. Claims 10-100x the speed of `pip`. It handles everything from installing Python itself to dependency resolution, CLI tool management, and build/publish. Complements the dependency and version management sections of `languages/python.md` at the practical level.

Official: [docs.astral.sh/uv](https://docs.astral.sh/uv/)

## Installation

```bash
# Official script (recommended. No Python or Rust required)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Homebrew
brew install uv

# mise
mise use uv

# pipx (isolated)
pipx install uv

# WinGet
winget install --id=astral-sh.uv -e

# Docker
docker run ghcr.io/astral-sh/uv
```

To update: `uv self update` for the standalone build, or `brew upgrade uv` for Homebrew.

## What it replaces

| Old tool | Role | uv replacement |
|---|---|---|
| `pip` | Package install | `uv pip install` or `uv add` |
| `pip-tools` | requirements lock | `uv lock` / `uv sync` |
| `virtualenv` / `venv` | Virtual env creation | `uv venv` |
| `pyenv` | Python version management | `uv python install` |
| `pipx` | CLI tool install | `uv tool install` / `uvx` |
| `poetry` | Project + lock + publish | `uv init` / `uv add` / `uv build` / `uv publish` |
| `twine` | publish | `uv publish` |

## Project management (recommended flow)

```bash
uv init my-app          # generates pyproject.toml + .python-version + src/
cd my-app
uv add httpx            # add dependency → updates uv.lock → syncs .venv
uv add --dev pytest     # dev dependency
uv remove httpx
uv sync                 # read uv.lock and match .venv (for CI / another machine)
uv lock                 # resolve dependencies and update uv.lock (no install)
uv run pytest           # run command in project env (with auto-sync)
uv tree                 # show dependency tree
```

`uv add` performs three steps in one go: updating `[project]` in `pyproject.toml`, regenerating `uv.lock`, and syncing `.venv`. If you edit `pyproject.toml` by hand, run `uv sync` to catch up.

### uv-related sections of `pyproject.toml`

```toml
[project]
name = "my-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "ruff"]

[tool.uv]
dev-dependencies = []   # legacy. Migration to dependency-groups.dev recommended

[tool.uv.workspace]
members = ["packages/*"]
```

`[dependency-groups]` is the PEP 735 standard. You can add groups like `uv add --group test pytest`.

## CLI tools (pipx replacement)

```bash
uv tool install ruff          # persistent install (registered on PATH)
uv tool list
uv tool upgrade ruff
uv tool uninstall ruff

uvx ruff check .              # one-off run (alias for uv tool run)
uvx --from "rich[jupyter]" python    # specify extras
```

`uvx` resolves arguments fast, making it ideal for "just run lint" or "run the formatter once" use cases in CI. It avoids global pollution while still sharing the `pip install` cache.

## Python version management (pyenv replacement)

```bash
uv python install 3.12 3.13     # install multiple versions at once
uv python list                  # installed + available
uv python pin 3.13              # write to .python-version
uv python dir                   # install location (used for uninstall)
```

If a project has a `.python-version`, `uv run` / `uv sync` automatically match it. It is rejected if it does not align with `requires-python`.

## Script execution (PEP 723)

Writing metadata at the top of a file lets a script with dependencies run as a **single file**:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rich"]
# ///

import httpx
from rich import print
print(httpx.get("https://example.com"))
```

```bash
uv run script.py        # resolve dependencies and run in an isolated environment
```

`uv add --script script.py httpx` updates the metadata. Strong fit for use cases that need to be self-contained in one file without a `requirements.txt`.

## Workspaces (monorepo)

```toml
# root pyproject.toml
[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/legacy"]
```

Each member has its own independent `pyproject.toml`; running `uv sync` / `uv run` at the root resolves dependencies for all members. Inter-member dependencies are expressed with `workspace = true`:

```toml
[project]
dependencies = ["my-core"]

[tool.uv.sources]
my-core = { workspace = true }
```

## Cache and lockfile

- Global cache: `~/.cache/uv/` (macOS/Linux) / `%LocalAppData%\uv\cache` (Windows)
- Removable with `uv cache clean`
- `uv.lock` **must always be committed**. It is a universal lockfile across OS/architecture (unlike `requirements.txt`, it covers multiple platforms in a single file)

## CI pattern

```yaml
- uses: actions/checkout@v7
- uses: astral-sh/setup-uv@v8
  with:
    enable-cache: true
- run: uv sync --locked        # fails if uv.lock is not up to date (recommended for CI)
- run: uv run pytest
```

For CI, `--locked` (verifies the lockfile is up to date and fails otherwise) is recommended. `--frozen` is a weaker guarantee that proceeds with the existing content without updating the lockfile. `--no-sync` skips install.

## Build and publish

```bash
uv build                         # generate sdist + wheel into dist/
uv publish --token $PYPI_TOKEN   # to PyPI
uv publish --trusted-publishing automatic   # Trusted Publishers (OIDC)
```

PyPI also supports Trusted Publishers (OIDC), enabling publish from GitHub Actions without holding a `UV_PUBLISH_TOKEN`.

## Common mistakes AI agents make

1. **Running `pip install`** — use `uv add` in uv projects. Calling `pip` directly bypasses `pyproject.toml` / `uv.lock`
2. **Forgetting `uv sync --frozen` in CI** — distinguish it from `uv sync` (default), which updates the lockfile. If `uv.lock` gets rewritten in CI, it disrupts diff detection / review
3. **Also using `requirements.txt`** — it can be generated via `uv export`, but the source of truth is `pyproject.toml` + `uv.lock`
4. **Calling `activate` then running `python` directly** — the uv way is to use `uv run` without activating `.venv`. This is safe even when multiple Python versions coexist
5. **Confusing `uv tool install` with `uvx`** — install is persistent, `uvx` is one-off. `uvx` is sufficient for lint / format in CI
6. **Mismatch between `requires-python` and `.python-version`** — causes an error at `uv run` time. Align them with `uv python pin`
7. **Running `uv sync` per member in a monorepo** — running it once at the root is enough. Doing it per member causes duplicate installs

## Related

- [`languages/python/python.md`](python.md) — language-level prerequisites
- [`tools/mise.md`](../../tools/mise.md) — when introducing via `mise use uv` from mise
- [`languages/js/pnpm.md`](../js/pnpm.md) — the Node.js counterpart (similar philosophy)

## References

- [uv Documentation](https://docs.astral.sh/uv/)
- [uv on GitHub](https://github.com/astral-sh/uv)
- [PEP 723 — inline script metadata](https://peps.python.org/pep-0723/)
- [PEP 735 — dependency groups](https://peps.python.org/pep-0735/)
