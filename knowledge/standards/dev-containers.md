---
reviewed: 2026-05-04
tags: [methodology, dockerfile]
---

# Dev Containers

A specification for defining a development environment inside an OCI container. Placing `.devcontainer/devcontainer.json` at the repository root lets tools such as VS Code, GitHub Codespaces, JetBrains, and the `devcontainer` CLI spin up **the same isolated environment**. It eliminates machine-dependent setup, and it's increasingly common to keep AI agents (Claude Code / Codex CLI / Gemini CLI / Copilot CLI) resident inside the Dev Container too. See `ai/practice/multi-agent-repo.md` for multi-agent setups within a single repo, and `standards/multi-repo-config-sync.md` for distributing config across multiple repos.

Official: [containers.dev](https://containers.dev/) / [Reference](https://containers.dev/implementors/json_reference/)

## Why use it

| Problem | How Dev Containers solve it |
|---|---|
| Toolchains differ per machine | Unified via container image |
| "It doesn't work" issues from local environment drift | Reproduced inside the container |
| Onboarding a new member takes half a day | clone → reopen in container |
| AI agent behaves differently from CI | Develop with the same image as CI |
| Multiple languages mixed together | Combine via features |

## Minimal example

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "my-app",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
  "features": {
    "ghcr.io/devcontainers/features/node:2": { "version": "24" },
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "pnpm install",
  "remoteUser": "vscode"
}
```

Just this is enough for `Reopen in Container` to bring up an isolated environment with **Node 24 + gh CLI + dependencies already installed**.

## Key fields

| Field | Purpose |
|---|---|
| `name` | Display name |
| `image` | Base image (registry reference) |
| `build.dockerfile` / `build.context` / `build.args` | When using a custom Dockerfile |
| `features` | Add Dev Container Features (see below) |
| `customizations.vscode.extensions` | Auto-install VS Code extensions |
| `customizations.vscode.settings` | Editor settings |
| `forwardPorts` | Ports forwarded from container → host |
| `portsAttributes` | Port labels / protocol |
| `mounts` | Additional bind / volume mounts |
| `runArgs` | Extra args passed to `docker run` (e.g. `--gpus=all`) |
| `remoteUser` | User inside the container (defaults to e.g. `vscode`) |
| `workspaceFolder` | Workspace path inside the container |
| `workspaceMount` | Host → container mount spec |
| `containerEnv` / `remoteEnv` | Environment variables for the container / tool subprocesses |
| `hostRequirements` | Required CPU / memory / storage / GPU |
| `shutdownAction` | Behavior on container stop (`none` / `stopContainer` / `stopCompose`) |

## Lifecycle commands

Execution order is fixed:

```text
initializeCommand     ← runs on the host (before Docker starts)
       ↓
[ container build / start ]
       ↓
onCreateCommand       ← runs once, on first container creation
updateContentCommand  ← runs during prebuild (incremental update)
postCreateCommand     ← final step of creation
       ↓
[ startup complete ]
       ↓
postStartCommand      ← runs on every start
postAttachCommand     ← runs every time a client attaches
```

| Command | Typical use |
|---|---|
| `initializeCommand` | Generating keys on the host, creating `.env` |
| `onCreateCommand` | Warming up language runtime caches |
| `updateContentCommand` | `pnpm install` / `uv sync` (runs during prebuild) |
| `postCreateCommand` | Initial DB migration |
| `postStartCommand` | Starting services (e.g. `docker compose up -d`) |
| `postAttachCommand` | Prompt / welcome message |

Distinguishing between `updateContentCommand` and `postCreateCommand` matters for Codespaces **prebuild** (see below).

## Features ecosystem

Features are "**declarative installation of additional toolchains**." Reference them as `ghcr.io/<owner>/features/<name>:<version>`:

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:2": { "version": "24" },
    "ghcr.io/devcontainers/features/python:1": { "version": "3.13" },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "username": "vscode"
    }
  }
}
```

| Category | Examples |
|---|---|
| Languages | `node` / `python` / `go` / `rust` / `java` / `ruby` |
| Runtimes | `docker-in-docker` / `docker-outside-of-docker` / `kubectl-helm-minikube` |
| CLIs | `github-cli` / `aws-cli` / `azure-cli` / `terraform` |
| OS | `common-utils` (zsh, oh-my-zsh, sudo, locale) |

**Always pin versions by major** (`:2` → takes `2.x.y`). `:latest` breaks reproducibility. Browse community Features at [containers.dev/features](https://containers.dev/features).

## Multi-container (Compose)

```jsonc
{
  "name": "stack",
  "dockerComposeFile": "../docker-compose.yaml",
  "service": "app",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "shutdownAction": "stopCompose"
}
```

`service` specifies the attach target. DBs, caches, etc. can be started simultaneously as separate services. `shutdownAction: stopCompose` stops all services when the client exits.

## Customizations

VS Code-specific settings:

```jsonc
{
  "customizations": {
    "vscode": {
      "extensions": [
        "biomejs.biome",
        "ms-azuretools.vscode-docker",
        "anthropic.claude-code"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "terminal.integrated.defaultProfile.linux": "zsh"
      }
    },
    "jetbrains": {
      "backend": "IntelliJ"
    }
  }
}
```

Per-agent MCP configuration (`.claude.json` / `.codex/config.toml` / etc.) is typically managed by dropping it into the **home directory inside the container**, distributed via features or `postCreateCommand`.

## Codespaces-specific: prebuild

In GitHub Codespaces, "prebuild" shortens startup time from 1-2 minutes to a few seconds:

- Everything up to `updateContentCommand` is built and cached periodically / on push
- When a user starts a Codespace, it boots from an already-warm snapshot

`postCreateCommand` is not included in prebuild (to leave room for instance-specific setup), so heavy work like dependency installation should go into `updateContentCommand`.

## The `devcontainer` CLI

The official CLI for launching Dev Containers without VS Code / Codespaces:

```bash
npm install -g @devcontainers/cli

devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
devcontainer build --workspace-folder .
devcontainer run-user-commands --workspace-folder .
```

Used for "running tests in the same environment as the Dev Container" in CI, or via the GitHub Actions `devcontainers/ci` action.

## Support status

| Client | Support |
|---|---|
| VS Code (Dev Containers extension) | Full |
| GitHub Codespaces | Full + prebuild |
| JetBrains IDEs | Full (some feature constraints) |
| `devcontainer` CLI | Full (mainly CI use cases) |
| Cursor | VS Code-compatible |
| Vim / Neovim | Via third-party plugins |

## Pattern for keeping an AI agent resident

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/anthropics/devcontainer-features/claude-code:1": {}
  },
  "postCreateCommand": "claude mcp add --scope user knowledge -- node /workspaces/mcp-server-knowledge/dist/index.js",
  "remoteEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  }
}
```

- Relay host environment variables via `remoteEnv` (using the `localEnv:VAR` syntax)
- Reproduce MCP configuration via `postCreateCommand`
- Keys and secrets go through a volume mount or the OS keystore (never baked into the image)

## Common mistakes AI agents make

1. **Confusing `postCreateCommand` with `postStartCommand`** — putting heavy work in `postStartCommand` slows every startup. One-time dependency installs belong in `postCreateCommand` or `updateContentCommand`
2. **Referencing features with `:latest`** — breaks reproducibility. Pin by major, e.g. `:2`
3. **Mismatch between `workspaceMount` and `workspaceFolder`** — host and container paths get out of sync and the editor loses track of the workspace
4. **Running Codespaces without prebuild** — running `pnpm install` / `uv sync` on every startup costs 30 seconds to 2 minutes. Moving it into `updateContentCommand` lets prebuild take effect
5. **Staying on `remoteUser: root`** — bind-mounted files end up owned by root, breaking edit permissions on the host side. Combine with `updateRemoteUserUID: true`
6. **Running pip / npm install directly in the Dockerfile instead of using features** — hard to share and update. Prefer features
7. **App not reachable because `forwardPorts` isn't used** — not listening on 0.0.0.0, or the port is missing from `forwardPorts`
8. **Hardcoding secrets in `containerEnv`** — gets committed to the file. Use `localEnv:` or Codespaces secrets instead

## Related

- [`platforms/docker/docker.md`](../platforms/docker/docker.md) — Foundational container knowledge
- [`ai/practice/multi-agent-repo.md`](../ai/practice/multi-agent-repo.md) — Multi-agent setups within a single repo
- [`standards/multi-repo-config-sync.md`](multi-repo-config-sync.md) — Distributing `.devcontainer/` across multiple repos

## References

- [Development Containers Specification](https://containers.dev/)
- [devcontainer.json reference](https://containers.dev/implementors/json_reference/)
- [Available Features](https://containers.dev/features)
- [@devcontainers/cli](https://github.com/devcontainers/cli)
- [Codespaces prebuilds](https://docs.github.com/en/codespaces/prebuilding-your-codespaces)
