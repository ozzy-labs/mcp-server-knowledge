---
reviewed: 2026-05-04
tags: [go, language]
---

# Go

A systems programming language from Google. Known for concurrency (goroutines / channels), a simple type system, a powerful standard library, and single-binary static distribution. Widely adopted for CLIs, servers, distributed systems, and DevOps toolchains.

Official: [go.dev](https://go.dev/) / [Specification](https://go.dev/ref/spec) / [Modules Reference](https://go.dev/ref/mod) / [Standard library](https://pkg.go.dev/std)

## Version status (as of 2026-05)

- Latest stable: **Go 1.26.0** (released 2026-02)
- Supported: "latest 2 releases" only → **1.25 and 1.26**
- Release cycle: roughly every 6 months

The `go` binary can be installed via the official installer / Homebrew / mise (via aqua) / apt, etc. If you need to switch between multiple versions, mise / asdf is recommended.

## Modules (go.mod / go.sum / go.work)

### Key directives

| Directive | Role |
|---|---|
| `module <path>` | Module path (required, exactly one) |
| `go <version>` | **Minimum required** Go version (strictly enforced since 1.21+) |
| `toolchain go<version>` | Preferred toolchain (only effective if newer than the `go` line) |
| `require <mod> <ver>` | Dependency. `// indirect` marks an indirect dependency |
| `replace <a> => <b>` | Replacement (main module only). Local paths allowed |
| `exclude <mod> <ver>` | Version exclusion |
| `retract <ver>` | Declares retraction of a published version |
| `tool <pkg>` | (1.24+) Tool dependency. No longer needs a blank import in `tools.go` |
| `ignore <dir>` | (1.25+) Ignore a specific directory |

### Key commands

```bash
go mod init example.com/myapp
go mod tidy                    # Remove unused deps + add missing ones (most common)
go mod download                # Prefetch into cache
go mod why example.com/x       # Explain why it's needed
go mod graph                   # Dependency graph
go mod verify                  # Verify checksums
go mod vendor                  # Generate vendor/
```

### Toolchain directive (1.21+)

Write `go 1.21.0` and `toolchain go1.24.0` in `go.mod` as two separate lines. Controlled via `GOTOOLCHAIN`:

| Value | Behavior |
|---|---|
| `auto` (default) | Start with the local version → download if go.mod requires newer |
| `local` | Force the bundled version |
| `path` | PATH lookup only (no download) |

Update with `go get go@1.24.0 toolchain@go1.24.5`. Remove the line with `go get toolchain@none`.

### Workspace (go.work)

For local multi-module development. `go work init` / `go work use ./mod-a ./mod-b`. **Convention is to not commit it to CI** (disable with `GOWORK=off`).

### Module-related environment variables

| Variable | Role |
|---|---|
| `GOPROXY` | Module fetch proxy (default: `https://proxy.golang.org,direct`) |
| `GOSUMDB` | Checksum DB (default: `sum.golang.org`, `off` to disable) |
| `GOPRIVATE` | Private module patterns (skips both GOPROXY and GOSUMDB) |
| `GONOPROXY` / `GONOSUMDB` | Individual skip overrides |
| `GO111MODULE` | `on` (default since 1.16+) |
| `GOWORK` | Path to go.work, `off` to disable |
| `GOAUTH` (1.24+) | Auth provider for private GOPROXY |

### Major version path (v2+)

For major version 2 and above, the module path must end with `/v2`, `/v3`:

```go
// go.mod
module example.com/x/v2

// import
import "example.com/x/v2/sub"
```

Tags use the `vX.Y.Z` format (leading `v` required). Pseudo-version: `v0.0.0-YYYYMMDDhhmmss-commit`.

## Recent major language additions

### Go 1.22 (2024-02)

- **Per-iteration scoping of `for` loop variables** (the most significant semantic change). Eliminates the goroutine-loop-closure pitfall
- **`for i := range 10`**: range over int
- `math/rand/v2` — the standard library's first v2
- Enhanced `net/http.ServeMux` patterns: `mux.HandleFunc("GET /items/{id}", h)`, `r.PathValue("id")`

### Go 1.23 (2024-08)

- **range-over-func**: consume iterators of the form `func(yield func(K, V) bool)` via `for k, v := range iter {}`
- New packages: `iter`, `unique`, `structs`
- Iterator-related additions to `slices`/`maps` (`All`, `Values`, `Backward`, `Collect`, `Sorted`, `Chunk`)

### Go 1.24 (2025-02)

- **Generic type aliases**: `type MyMap[K, V any] = map[K]V`
- **`tool` directive** in `go.mod`: no longer needs a blank import in `tools.go`
- `os.Root` / `os.OpenRoot`: FS access that prevents directory escape
- `runtime.AddCleanup` (an improved version of `SetFinalizer`)
- `testing.B.Loop` — new standard for benchmarks
- JSON `omitzero` tag
- New Swiss Tables–based map implementation
- X25519MLKEM768 (post-quantum) enabled by default for TLS
- `crypto/mlkem`, `crypto/hkdf`, `crypto/pbkdf2`, `crypto/sha3`

### Go 1.25 (2025-08)

- `testing/synctest` reaches stable release (virtual-time testing)
- `encoding/json/v2` experimental (`GOEXPERIMENT=jsonv2`)
- `sync.WaitGroup.Go(func())` added
- Detects Linux cgroup CPU limits and auto-sets `GOMAXPROCS`
- `waitgroup` / `hostport` analyzers added to `go vet`
- `ignore` directive added to `go.mod`
- DWARF5 by default

## Error handling

```go
// Creation
err := errors.New("not found")
err := fmt.Errorf("read %s: %w", path, cause)  // wrap with %w

// Inspection
errors.Is(err, fs.ErrNotExist)         // sentinel comparison (walks the tree)
var pe *fs.PathError
errors.As(err, &pe)                    // type extraction (target is **T)
errors.Unwrap(err)

// Combining (1.20+)
errors.Join(err1, err2)
```

### Sentinel error vs typed error

```go
// sentinel
var ErrNotFound = errors.New("not found")
return ErrNotFound

// typed
type PathError struct{ Op, Path string; Err error }
func (e *PathError) Error() string { return e.Op + " " + e.Path + ": " + e.Err.Error() }
func (e *PathError) Unwrap() error { return e.Err }
```

Don't use panic / recover at library boundaries. Reserve them for **invariant violations at initialization time** or as a defensive measure inside HTTP handlers.

## Generics (1.18+)

```go
func Map[S ~[]E1, E1, E2 any](s S, f func(E1) E2) []E2 {
    r := make([]E2, len(s))
    for i, v := range s { r[i] = f(v) }
    return r
}

type Set[T comparable] map[T]struct{}
func (s Set[T]) Add(v T) { s[v] = struct{}{} }
```

### Type constraints

| Syntax | Meaning |
|---|---|
| `any` | Alias for `interface{}` |
| `comparable` | Types supporting `==`/`!=` |
| `int \| string` | Type union |
| `~int` | All named types whose underlying type is int |
| `cmp.Ordered` (1.21+) | Orderable via `<` etc. (standard version of `constraints.Ordered`) |

## Synchronization and concurrency

### Key sync types

```go
var mu sync.Mutex            // Lock / Unlock / TryLock(1.18+)
var rw sync.RWMutex
var once sync.Once           // Do(f)
var wg sync.WaitGroup        // Add / Done / Wait / Go(1.25+)
var pool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
var m sync.Map               // Load / Store / Range / Clear(1.23+)

// Once helpers (1.21+)
init := sync.OnceValue(func() *Config { return loadConfig() })
cfg := init()
```

### errgroup (`golang.org/x/sync/errgroup`)

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10)
for _, u := range urls {
    u := u
    g.Go(func() error { return fetch(ctx, u) })
}
if err := g.Wait(); err != nil { return err }
```

Cancels the ctx on the first error; `Wait()` returns the first error.

### context.Context

```go
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()                              // required

ctx, cancel := context.WithCancelCause(parent)
cancel(errors.New("custom reason"))
context.Cause(ctx)                          // retrieve it

ctx2 := context.WithoutCancel(parent)       // 1.21+
stop := context.AfterFunc(ctx, cleanup)     // 1.21+
```

Best practices:

- Accept it as the first parameter; don't store it in a struct
- Never pass `nil`; use `context.TODO()`
- Use `WithValue` only for request-scoped data (never for optional arguments)

### Channel patterns

- **unbuffered** (`make(chan T)`): synchronous send/receive, handoff
- **buffered** (`make(chan T, n)`): asynchronous up to n items
- Detect completion with `close(ch)` + `v, ok := <-ch`
- Integrate cancellation with `select { case v := <-c1: ... case <-ctx.Done(): ... }`
- Unidirectional: `chan<- T` / `<-chan T` for API constraints

Use `go test -race` to detect data races (mandatory in CI).

## Testing

### Standard pattern (table-driven + subtests + Parallel)

```go
func TestFoo(t *testing.T) {
    tests := []struct{ name string; in, want int }{
        {"a", 1, 2},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            t.Parallel()
            if got := Foo(tt.in); got != tt.want {
                t.Errorf("got %d, want %d", got, tt.want)
            }
        })
    }
}
```

### Helpers

| API | Purpose |
|---|---|
| `t.Run(name, f)` | Subtest |
| `t.Parallel()` | Parallelize (not usable with `Setenv`/`Chdir`) |
| `t.Helper()` | Skip this frame in the stack trace |
| `t.Cleanup(f)` | LIFO cleanup |
| `t.TempDir()` | Auto-deleted temp directory |
| `t.Setenv(k, v)` | Environment variable restored after the test |

### Benchmarks (recommended form since 1.24+)

```go
func BenchmarkX(b *testing.B) {
    for b.Loop() {  // automatic timer control + prevents optimization
        Work()
    }
}
```

### Fuzzing (1.18+)

```go
func FuzzReverse(f *testing.F) {
    f.Add("hello")
    f.Fuzz(func(t *testing.T, s string) {
        if Reverse(Reverse(s)) != s { t.Fatal("not idempotent") }
    })
}
```

### Key `go test` flags

| Flag | Purpose |
|---|---|
| `-run <regexp>` | Filter by test name |
| `-v` | Verbose output |
| `-race` | Data race detection |
| `-cover` / `-coverprofile=c.out` | Coverage |
| `-count N` | Repeat (use `-count=1` to disable caching) |
| `-bench <regexp>` / `-benchmem` / `-benchtime=10s` | Benchmarking |
| `-fuzz <regexp>` / `-fuzztime=10s` | Fuzzing |
| `-shuffle on` | Shuffle order |
| `-failfast` | Stop on first failure |
| `-json` | Machine-readable output |

## Related tooling (article links)

| Tool | Purpose | Article |
|---|---|---|
| gopls | Official Language Server | [`languages/go/gopls.md`](gopls.md) |
| golangci-lint | Linter aggregator | [`languages/go/golangci-lint.md`](golangci-lint.md) |
| govulncheck | Official vulnerability scanner | [`languages/go/govulncheck.md`](govulncheck.md) |
| GoReleaser | Cross-compilation + release automation | [`languages/go/goreleaser.md`](goreleaser.md) |
| Cobra | CLI framework | [`languages/go/cobra.md`](cobra.md) |
| Buf | Protobuf / gRPC toolchain | [`tools/buf.md`](../../tools/buf.md) |

## Trends (2025-2026)

- **Structured logging: `log/slog` is now the de facto standard**: increasingly the default choice for new projects. `zap` exposes a `slog.Handler` bridge
- **Dependency minimization**: `gorilla/mux` → `net/http.ServeMux` (1.22+), `logrus` → `slog`, and a growing preference for `testing` + `go-cmp` over testify
- **Iterators**: range-over-func in 1.23 is spreading function-chain-style code
- **PGO**: since becoming enabled by default in 1.21, simply dropping in `default.pgo` yields optimization
- **FIPS 140-3 / post-quantum cryptography**: standard support since 1.24, driving broader Go adoption in regulated industries

## Common mistakes AI agents make

1. **Bumping the `go` line in `go.mod` without being asked** — it declares the minimum required version, and doing so can break Go compatibility with CI / distribution targets. Don't touch the `go` line if the `toolchain` line would suffice
2. **Shadowing the `for` loop variable with `tt := tt`** — unnecessary since 1.22+. Remove it unless compatibility with older Go is a deliberate goal
3. **Creating `context.Background()` inside a function** — the principle is to accept it as the first parameter and propagate it. For HTTP handlers, use `r.Context()`
4. **Comparing errors with `==` instead of `errors.Is/As`** — this misses wrapped errors. Always inspect with `Is` / `As` when wrapping with `%w`
5. **Forgetting `defer cancel()`** — failing to call the cancel function returned by `WithTimeout` / `WithCancel` leaks goroutines
6. **Wanting to run `go test` without caching** — by default, tests are skipped when no files changed. Only force it with `-count=1` when actually needed
7. **Starting goroutines without waiting on them** — always join with `sync.WaitGroup` / `errgroup` / a channel

## References

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Specification](https://go.dev/ref/spec)
- [Modules Reference](https://go.dev/ref/mod)
- [Toolchain](https://go.dev/doc/toolchain)
- [Release notes](https://go.dev/doc/devel/release)
- [The Go Blog](https://go.dev/blog/)
