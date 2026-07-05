---
reviewed: 2026-05-04
tags: [go, protobuf, grpc, codegen]
---

# Buf

A CLI that integrates the Protobuf toolchain. Instead of calling `protoc` directly, it consolidates dependency resolution, lint, breaking-change detection, formatting, code generation, and schema registry integration into a single CLI. Combined with the Buf Schema Registry (BSR), it enables **npm/pip-style Protobuf dependency management**.

Official: [buf.build/docs](https://buf.build/docs/) / [GitHub](https://github.com/bufbuild/buf)

Latest is **v1.69.0** (as of 2026-04). The CLI version stays on the v1 line, while the config schema is now v2 (v2 was introduced in CLI v1.32.0 / 2024-05).

## Installation

```bash
brew install bufbuild/buf/buf                         # macOS / Linux
npm install @bufbuild/buf                             # via Node
go install github.com/bufbuild/buf/cmd/buf@latest     # Go
scoop install buf                                     # Windows
winget install bufbuild.buf                           # Windows
docker run --rm -v "$(pwd):/workspace" -w /workspace bufbuild/buf lint
```

## Main commands

| Command | Purpose |
|---|---|
| `buf build` | Compile `.proto` into a Buf image / FileDescriptorSet |
| `buf lint` | Check style/structural rules (40+) |
| `buf format` | Format proto files |
| `buf breaking` | Detect breaking changes against a prior version (60+ rules) |
| `buf generate` | Generate code via local/remote plugins |
| `buf curl` | Call gRPC / gRPC-Web / Connect endpoints HTTP-style |
| `buf convert` | Convert binary ⇔ JSON |
| `buf dep update` / `buf dep prune` / `buf dep graph` | Dependency resolution (v2) |
| `buf push` | Publish a module to the BSR |
| `buf export` | Expand a BSR module locally |
| `buf config init` | Initialize for v2 |
| `buf config migrate` | Auto-migrate v1 config → v2 (`--diff` to preview) |
| `buf registry login` | BSR authentication |
| `buf lsp serve` | LSP server (editor integration) |

`buf mod init` / `buf mod update` / `buf mod prune` are v1 names, replaced in v2 by `buf config init` / `buf dep update` / `buf dep prune` (the old names still work with a deprecation warning).

## Configuration files

### `buf.yaml` (v2)

```yaml
version: v2
modules:
  - path: proto
    name: buf.build/acme/petapis      # BSR module name (optional)
    excludes: [proto/legacy]
deps:
  - buf.build/googleapis/googleapis
  - buf.build/bufbuild/protovalidate
lint:
  use: [STANDARD]                     # default: STANDARD
  except: [PACKAGE_NO_IMPORT_CYCLE]
  service_suffix: Service
  enum_zero_value_suffix: _UNSPECIFIED
breaking:
  use: [FILE]                         # default: FILE
  ignore_unstable_packages: true
```

### `buf.gen.yaml` (v2)

```yaml
version: v2
inputs:
  - directory: .
plugins:
  - remote: buf.build/protocolbuffers/go    # BSR-hosted (recommended)
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/connectrpc/go
    out: gen/go
    opt: paths=source_relative
  - local: protoc-gen-go                    # local binary
    out: gen/go
  - protoc_builtin: cpp                     # protoc built-in
    out: gen/cpp
```

`buf.lock` is the dependency lock file (auto-generated).

## v1 → v2 migration

v2 configuration was introduced in CLI v1.32.0 (2024-05). v2 is now the standard for new projects.

```bash
buf config migrate --diff      # preview the diff
buf config migrate             # apply
```

Key changes:

- **`buf.work.yaml` removed** → consolidated into the `modules:` list in `buf.yaml`
- All modules now share a common `deps`
- Plugin specification in `buf.gen.yaml` is split into `remote` / `local` / `protoc_builtin`
- Managed mode simplified to two top-level keys, `disable` / `override`
- Lint default is now **STANDARD** (v1 default was DEFAULT)
- New rule `PACKAGE_NO_IMPORT_CYCLE` added (auto-migration adds it to `except`; manual enablement recommended)

## Lint categories

| Category | Contents |
|---|---|
| `MINIMAL` | Minimal package consistency / directory structure checks |
| `BASIC` | MINIMAL + naming conventions + import control |
| `STANDARD` (default) | BASIC + `ENUM_VALUE_PREFIX`, `FILE_LOWER_SNAKE_CASE`, `SERVICE_SUFFIX`, `PROTOVALIDATE` |
| `COMMENTS` | Requires comments (7 rules) |
| `UNARY_RPC` | Prohibits streaming |

## Breaking categories (in order of strictness)

| Category | Use case |
|---|---|
| `FILE` (default) | File-level generated-code compatibility. For languages like Python/C++ where file layout affects output |
| `PACKAGE` | Package-level. Allows moving definitions between files within the same package |
| `WIRE_JSON` | Compatible with both wire (binary) and JSON encoding — the practical minimum recommendation |
| `WIRE` | Binary wire compatibility only |

```bash
buf breaking --against '.git#branch=main'           # compare against a git ref
buf breaking --against image.bin                    # compare against a prior image file
buf breaking --against buf.build/acme/petapis       # compare against a BSR module
```

## Buf Schema Registry (BSR)

- **Public**: [buf.build](https://buf.build/)
- **Module path**: `buf.build/<owner>/<module>` (e.g. `buf.build/googleapis/googleapis`)
- **Auth**: `buf registry login`; in CI use the `BUF_TOKEN` environment variable
- **Dependency resolution**: declare in `deps:` in `buf.yaml`, update `buf.lock` with `buf dep update`
- **Generated SDKs**: some modules can be installed via BSR with `go get` / `npm install`

## Remote plugins

Code generation runs on the BSR without installing a local plugin binary. Notable ones:

| Plugin | Purpose |
|---|---|
| `buf.build/protocolbuffers/go` | Generates Go message/enum types |
| `buf.build/connectrpc/go` | Connect-Go server/client |
| `buf.build/grpc/go` | gRPC-Go server/client |
| `buf.build/bufbuild/es` | TypeScript (`@bufbuild/protobuf`) |
| `buf.build/connectrpc/es` | Connect-ES |
| `buf.build/protocolbuffers/{java,python,kotlin,csharp,ruby,php,objc}` | Standard generators for each language |

## Connect

A gRPC-compatible RPC library family from bufbuild. The organization has been split off as `connectrpc`, with the `connectrpc.com/connect` package (migrated from the old `github.com/bufbuild/connect-go`).

- **Connect protocol**: a proprietary protocol running over HTTP/1.1, HTTP/2, and HTTP/3
- **Triple protocol support**: a single ServiceHandler speaks gRPC + gRPC-Web + Connect all at once
- **Generated output**: `protoc-gen-connect-go` produces type-safe `net/http`-based Handlers/Clients
- **Stable implementations**: Connect-Go / Connect-ES / Connect-Swift
- **Beta**: Connect-Kotlin / Connect-Python

The latest Connect-Go is **v1.19.2** (2026-04).

```go
import (
    "connectrpc.com/connect"
    petv1 "example.com/gen/pet/v1"
    "example.com/gen/pet/v1/petv1connect"
)

mux := http.NewServeMux()
mux.Handle(petv1connect.NewPetStoreServiceHandler(&petStore{}))
http.ListenAndServeTLS(":8443", "cert", "key", mux)
```

## CI integration (GitHub Actions)

**Recommended**: `bufbuild/buf-action@v1` (an all-in-one action that runs build / lint / format / breaking / push together and auto-posts a PR summary comment).

```yaml
name: buf
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  buf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bufbuild/buf-action@v1
        with:
          token: ${{ secrets.BUF_TOKEN }}     # omit if BSR push is not needed
```

`bufbuild/buf-setup-action` is **deprecated** (recommended to replace with `buf-action`). The individual actions `buf-lint-action` / `buf-breaking-action` / `buf-push-action` also exist but are unnecessary for new setups.

## Common mistakes made by AI agents

1. **Writing `buf.work.yaml` for v2** — removed in v2. Consolidate into `modules:` in `buf.yaml`
2. **Using `plugin: ...` in a v2 `buf.gen.yaml`** — v2 requires explicit separation into `remote:` / `local:` / `protoc_builtin:`
3. **Using `buf mod` in a new project** — deprecated. Use `buf config init` / `buf dep update`
4. **Deciding `WIRE` is sufficient for breaking checks** — if you use JSON encoding (gRPC-Web / Connect), `WIRE_JSON` or higher is the minimum recommendation
5. **Writing `DEFAULT` / `FILE_LAYOUT` / `STYLE_*` as lint categories** — these don't exist in current v2 (they're v1beta1-era names). Only `MINIMAL` / `BASIC` / `STANDARD` / `COMMENTS` / `UNARY_RPC` exist
6. **Importing `bufbuild/connect-go`** — already migrated to `connectrpc.com/connect`. The old path is no longer maintained
7. **Adopting `buf-setup-action` for new CI** — deprecated. Replace with `buf-action` alone

## References

- [CLI Installation](https://buf.build/docs/cli/installation/)
- [buf.yaml v2](https://buf.build/docs/configuration/v2/buf-yaml/)
- [buf.gen.yaml v2](https://buf.build/docs/configuration/v2/buf-gen-yaml/)
- [Lint rules](https://buf.build/docs/lint/rules/)
- [Breaking rules](https://buf.build/docs/breaking/rules/)
- [v1 → v2 migration](https://buf.build/docs/migration-guides/migrate-v2-config-files/)
- [Buf Schema Registry](https://buf.build/docs/bsr/)
- [Connect docs](https://connectrpc.com/docs/introduction)
- [bufbuild/buf-action](https://github.com/bufbuild/buf-action)
