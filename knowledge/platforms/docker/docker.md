---
reviewed: 2026-05-04
tags: [dockerfile, oci]
---

# Docker

A platform for distributing and running applications as containers (lightweight isolated environments). An ecosystem of an OCI (Open Container Initiative) compliant runtime + CLI + image registry + Compose.

Official: [docs.docker.com](https://docs.docker.com/)

## Installation

```bash
# Docker Desktop (macOS / Windows / Linux)
# → Download from https://www.docker.com/products/docker-desktop/

# Linux (Docker Engine only, no Desktop)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER           # run docker without sudo
newgrp docker

# Homebrew (Docker Desktop)
brew install --cask docker

# Alternatives: Podman / Colima / OrbStack
brew install colima docker              # Colima + CLI only
colima start
```

## Basic concepts

| Term | Meaning |
|---|---|
| **Image** | Read-only application template (stack of layers) |
| **Container** | Running instance of an image |
| **Dockerfile** | Script of build instructions for an image |
| **Registry** | Distribution destination for images (Docker Hub / GHCR / ECR / GCR, etc.) |
| **Volume** | Persistent storage (stored outside the container) |
| **Network** | Logical network for inter-container communication |
| **Compose** | Declarative management of multiple containers |

## Minimal Dockerfile example

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Key instructions

| Instruction | Purpose |
|---|---|
| `FROM` | Base image (required) |
| `WORKDIR` | Working directory |
| `COPY` / `ADD` | Add files (`ADD` also supports URLs + extraction; `COPY` is recommended) |
| `RUN` | Run a command at build time |
| `CMD` | Default command when the container starts |
| `ENTRYPOINT` | Command that always runs (CMD is treated as its arguments) |
| `EXPOSE` | Documentation-only port declaration (actual publishing is via `-p`) |
| `ENV` | Environment variables |
| `ARG` | Build-time argument (`docker build --build-arg`) |
| `USER` | User to run as (non-root recommended) |
| `HEALTHCHECK` | Health check command |
| `VOLUME` | Mount point |

## Build basics

```bash
# Build
docker build -t myapp:latest .

# Tag
docker tag myapp:latest ghcr.io/org/myapp:1.0.0

# Build args
docker build --build-arg NODE_ENV=production -t myapp .

# Disable cache
docker build --no-cache -t myapp .

# Specify platform (cross-build)
docker build --platform linux/amd64,linux/arm64 -t myapp .
```

### BuildKit + buildx

BuildKit is the default from Docker Engine 23 onward (currently v29.x). For multi-platform builds use `docker buildx`:

```bash
docker buildx create --use --name mybuilder
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/org/myapp:latest --push .
```

## Run basics

```bash
# Minimal
docker run --rm -it ubuntu:24.04 bash

# Run as daemon + publish port
docker run -d -p 3000:3000 --name myapp myapp:latest

# Environment variables
docker run -e DATABASE_URL="postgres://..." myapp

# Volume mount
docker run -v $(pwd)/data:/app/data myapp               # bind mount
docker run -v mydata:/app/data myapp                     # named volume

# Specify network
docker run --network mynet myapp

# Resource limits
docker run --cpus 2 --memory 512m myapp
```

### Common flags

| Flag | Meaning |
|---|---|
| `-d` | Detached (background) |
| `-it` | Interactive + TTY |
| `--rm` | Auto-remove after stop |
| `--name <n>` | Container name |
| `-p host:ctr` | Port mapping |
| `-v src:dst` | Volume mount |
| `-e KEY=VAL` | Environment variable |
| `--env-file <f>` | Environment variable file |
| `--network <n>` | Network |
| `--restart <policy>` | Restart policy (`no` / `on-failure` / `always` / `unless-stopped`) |

## State management

```bash
docker ps                       # running containers
docker ps -a                    # all containers
docker images                   # list images
docker logs <container>         # logs
docker logs -f <container>      # follow
docker exec -it <container> sh  # attach a shell
docker stop <container>
docker rm <container>
docker rmi <image>
docker system prune -a          # bulk-remove unused resources
```

## Docker Compose

Define multiple containers together. `docker-compose.yaml` (or `compose.yaml`):

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://db:5432/app
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - path: ./src
          action: sync
          target: /app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

```bash
docker compose up              # start (foreground)
docker compose up -d           # background
docker compose up --build      # rebuild
docker compose logs -f app     # follow logs
docker compose exec app sh     # enter the container
docker compose down            # stop and remove
docker compose down -v         # also remove volumes
docker compose watch           # detect changes + sync (for development)
```

## Multi-stage builds

Separate build-only stages from the runtime stage to shrink the final image. The Dockerfile example above does exactly this. Effects:

- Excludes build tools (e.g. TypeScript compiler) from the production image
- Image size can shrink to 1/5–1/10
- Reduces the attack surface

## Image size optimization

| Technique | Effect |
|---|---|
| Alpine / distroless base | A few MB to a few dozen MB |
| Multi-stage | Keeps only build artifacts |
| `.dockerignore` | Excludes unneeded files (`node_modules`, `.git`, `dist`) |
| Dependency install ordering | COPY the rarely-changing `package.json` first |
| `--frozen-lockfile` | Better reproducibility + cache hits |
| `docker buildx build --cache-from` | CI cache |

### `.dockerignore`

```text
node_modules
dist
.git
.github
.env
.env.*
*.log
.DS_Store
.claude
```

## Security best practices

1. **Run as non-root**: e.g. `USER node`
2. **Pin base image versions**: e.g. `node:24-alpine`, and keep it updated with Renovate
3. **SHA pinning**: `FROM node:24-alpine@sha256:...` to prevent tampering
4. **Trivy scanning**: integrate `trivy image myapp:latest` into CI
5. **Don't bake secrets into the build**: inject at runtime via environment variables or a volume
6. **Configure HEALTHCHECK**: lets the orchestrator detect container failures
7. **Least privilege**: read-only filesystem (`--read-only`), capability drop (`--cap-drop=ALL`)

## Usage in CI (GitHub Actions)

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Relation to Claude Code / MCP

- When distributing an MCP server as a Docker image, the stdio transport doesn't usually fit well since it's confined inside the container (it assumes being launched as a child process)
- An MCP server using the Streamable HTTP transport is a natural fit for Docker distribution
- Using Docker as a development sandbox (letting an agent run a shell) is also a common pattern (e.g. Codex CLI's `sandbox = "docker"`)

## Troubleshooting

### `Cannot connect to the Docker daemon`

- Docker Desktop isn't running → start it
- On Linux, the user isn't in the `docker` group → `sudo usermod -aG docker $USER`, then re-login
- Misconfigured `DOCKER_HOST`

### `no space left on device`

```bash
docker system df                # check usage
docker system prune -a --volumes # remove everything (caution)
```

Docker Desktop has a separate virtual disk size setting (GUI "Resources").

### `exec format error` on Apple Silicon

The image is `linux/amd64` only. Specify `--platform linux/amd64` explicitly (works via Rosetta but slower), or use a multi-arch image.

### Build cache not working

- Bad COPY ordering (`package.json` not copied first)
- BuildKit disabled (enabled by default on Engine 23+; only disable explicitly via `DOCKER_BUILDKIT=0`)
- No cache destination configured in CI → for GitHub Actions use `cache-from/to: type=gha`

### File permission issues (Linux)

A container started with `USER node` can't write to a bind-mounted directory. Match the UID (`--user $(id -u):$(id -g)`) or `chown` beforehand.

## Comparison with other tools

| Aspect | Docker Desktop | Colima | OrbStack | Podman |
|---|---|---|---|---|
| License | Paid for large enterprises | OSS | Free for personal use / paid for commercial | OSS |
| OS | mac/Win/Linux | mac/Linux | mac only | Linux (mac/Win experimental) |
| Speed | Normal | Fast | Fastest | Fast |
| Kubernetes | Built-in | k3s option | Built-in | minikube, etc. |
| Daemonless | No | No | No | Yes |

For personal use or OSS, Docker Desktop / Colima / OrbStack. To avoid license constraints, Colima / Podman.

## References

- [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/)
- [Compose specification](https://compose-spec.io/)
- [Vulnerability scanning with Trivy](../../tools/trivy.md)
- [build-push-action in GitHub Actions](../github/github-actions.md)
