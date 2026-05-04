---
reviewed: 2026-05-04
tags: [go, language]
---

# Go

Google 発のシステムプログラミング言語。並行処理（goroutine / channel）、シンプルな型システム、強力な標準ライブラリ、静的バイナリ単一ファイル配布で知られる。CLI / サーバー / 分散システム / DevOps ツールチェーンで広く採用される。

公式: [go.dev](https://go.dev/) / [Specification](https://go.dev/ref/spec) / [Modules Reference](https://go.dev/ref/mod) / [Standard library](https://pkg.go.dev/std)

## バージョン状況（2026-05 時点）

- 最新安定版: **Go 1.26.0**（2026-02 リリース）
- サポート対象: 「最新 2 リリース」のみ → **1.25 と 1.26**
- リリースサイクル: 約 6 か月ごと

`go` バイナリは公式インストーラ / Homebrew / mise（aqua 経由）/ apt 等で導入可能。複数バージョンを切り替えるなら mise / asdf を推奨。

## モジュール（go.mod / go.sum / go.work）

### 主要ディレクティブ

| ディレクティブ | 役割 |
|---|---|
| `module <path>` | モジュールパス（必須・1 つのみ） |
| `go <version>` | **最小必須** Go バージョン（1.21+ で厳密化） |
| `toolchain go<version>` | 推奨ツールチェーン（go 行より新しい場合のみ有効） |
| `require <mod> <ver>` | 依存。`// indirect` は間接依存 |
| `replace <a> => <b>` | 置換（メインモジュールのみ）。ローカルパスも可 |
| `exclude <mod> <ver>` | バージョン除外 |
| `retract <ver>` | 公開済みバージョンの取消し宣言 |
| `tool <pkg>` | (1.24+) ツール依存。`tools.go` の blank import 不要に |
| `ignore <dir>` | (1.25+) 特定ディレクトリ無視 |

### 主要コマンド

```bash
go mod init example.com/myapp
go mod tidy                    # 不要依存削除＋不足追加（最頻用）
go mod download                # キャッシュへプリフェッチ
go mod why example.com/x       # なぜ必要か説明
go mod graph                   # 依存グラフ
go mod verify                  # チェックサム検証
go mod vendor                  # vendor/ 生成
```

### Toolchain ディレクティブ（1.21+）

`go.mod` に `go 1.21.0` と `toolchain go1.24.0` を 2 段で書く。`GOTOOLCHAIN` で挙動を制御:

| 値 | 挙動 |
|---|---|
| `auto`（既定） | ローカル版で開始 → go.mod の要求が上ならダウンロード |
| `local` | バンドル版を強制 |
| `path` | PATH 検索のみ（ダウンロードなし） |

`go get go@1.24.0 toolchain@go1.24.5` で更新。`go get toolchain@none` で行削除。

### Workspace（go.work）

ローカル multi-module 開発用。`go work init` / `go work use ./mod-a ./mod-b`。**CI にはコミットしないのが慣例**（`GOWORK=off` で無効化）。

### モジュール関連環境変数

| 変数 | 役割 |
|---|---|
| `GOPROXY` | モジュール取得プロキシ（既定: `https://proxy.golang.org,direct`） |
| `GOSUMDB` | チェックサム DB（既定: `sum.golang.org`、`off` で無効） |
| `GOPRIVATE` | プライベートモジュールパターン（GOPROXY と GOSUMDB 双方をスキップ） |
| `GONOPROXY` / `GONOSUMDB` | 個別スキップ |
| `GO111MODULE` | `on`（既定 1.16+） |
| `GOWORK` | go.work のパス、`off` で無効 |
| `GOAUTH` (1.24+) | プライベート GOPROXY 認証プロバイダ |

### Major version path（v2+）

メジャー v2 以降はモジュールパス末尾に `/v2`, `/v3` 必須:

```go
// go.mod
module example.com/x/v2

// import
import "example.com/x/v2/sub"
```

タグは `vX.Y.Z` 形式（leading `v` 必須）。Pseudo-version: `v0.0.0-YYYYMMDDhhmmss-commit`。

## 言語の直近主要追加

### Go 1.22（2024-02）

- **`for` ループ変数の per-iteration スコープ化**（最重要セマンティクス変更）。goroutine ループ閉包の罠を解消
- **`for i := range 10`**: range over int
- `math/rand/v2` — 標準ライブラリ初の v2
- `net/http.ServeMux` のパターン強化: `mux.HandleFunc("GET /items/{id}", h)`、`r.PathValue("id")`

### Go 1.23（2024-08）

- **range-over-func**: `func(yield func(K, V) bool)` 形式のイテレータを `for k, v := range iter {}` で消費
- 新パッケージ: `iter`, `unique`, `structs`
- `slices`/`maps` にイテレータ系（`All`, `Values`, `Backward`, `Collect`, `Sorted`, `Chunk`）

### Go 1.24（2025-02）

- **ジェネリック型エイリアス**: `type MyMap[K, V any] = map[K]V`
- `go.mod` の **`tool` ディレクティブ**: `tools.go` の blank import 不要に
- `os.Root` / `os.OpenRoot`: ディレクトリ脱出を防ぐ FS アクセス
- `runtime.AddCleanup`（`SetFinalizer` の改善版）
- `testing.B.Loop` — ベンチマーク新標準
- JSON `omitzero` タグ
- Swiss Tables ベースの新 map 実装
- TLS で X25519MLKEM768（ポスト量子）デフォルト有効
- `crypto/mlkem`, `crypto/hkdf`, `crypto/pbkdf2`, `crypto/sha3`

### Go 1.25（2025-08）

- `testing/synctest` 正式公開（仮想時間テスト）
- `encoding/json/v2` 実験的（`GOEXPERIMENT=jsonv2`）
- `sync.WaitGroup.Go(func())` 追加
- Linux cgroup CPU 制限を検出して `GOMAXPROCS` 自動設定
- `go vet` に `waitgroup` / `hostport` アナライザー
- `go.mod` に `ignore` ディレクティブ
- DWARF5 デフォルト

## エラーハンドリング

```go
// 生成
err := errors.New("not found")
err := fmt.Errorf("read %s: %w", path, cause)  // %w でラップ

// 検査
errors.Is(err, fs.ErrNotExist)         // sentinel 比較（ツリー深掘り）
var pe *fs.PathError
errors.As(err, &pe)                    // 型抽出（target は **T）
errors.Unwrap(err)

// 結合（1.20+）
errors.Join(err1, err2)
```

### sentinel error vs typed error

```go
// sentinel
var ErrNotFound = errors.New("not found")
return ErrNotFound

// typed
type PathError struct{ Op, Path string; Err error }
func (e *PathError) Error() string { return e.Op + " " + e.Path + ": " + e.Err.Error() }
func (e *PathError) Unwrap() error { return e.Err }
```

panic / recover はライブラリ境界では使わない。**初期化時の不変条件違反**や HTTP ハンドラ内の防御に限定。

## ジェネリクス（1.18+）

```go
func Map[S ~[]E1, E1, E2 any](s S, f func(E1) E2) []E2 {
    r := make([]E2, len(s))
    for i, v := range s { r[i] = f(v) }
    return r
}

type Set[T comparable] map[T]struct{}
func (s Set[T]) Add(v T) { s[v] = struct{}{} }
```

### 型制約

| 構文 | 意味 |
|---|---|
| `any` | `interface{}` のエイリアス |
| `comparable` | `==`/`!=` 可能な型 |
| `int \| string` | 型 union |
| `~int` | 基底型が int の全名前付き型 |
| `cmp.Ordered` (1.21+) | `<` 等で順序付け可能（`constraints.Ordered` の標準版） |

## 同期・並行

### sync の主要型

```go
var mu sync.Mutex            // Lock / Unlock / TryLock(1.18+)
var rw sync.RWMutex
var once sync.Once           // Do(f)
var wg sync.WaitGroup        // Add / Done / Wait / Go(1.25+)
var pool = sync.Pool{New: func() any { return new(bytes.Buffer) }}
var m sync.Map               // Load / Store / Range / Clear(1.23+)

// Once 系ヘルパ（1.21+）
init := sync.OnceValue(func() *Config { return loadConfig() })
cfg := init()
```

### errgroup（`golang.org/x/sync/errgroup`）

```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10)
for _, u := range urls {
    u := u
    g.Go(func() error { return fetch(ctx, u) })
}
if err := g.Wait(); err != nil { return err }
```

最初のエラーで ctx をキャンセル、`Wait()` が最初のエラーを返す。

### context.Context

```go
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()                              // 必須

ctx, cancel := context.WithCancelCause(parent)
cancel(errors.New("custom reason"))
context.Cause(ctx)                          // 取り出し

ctx2 := context.WithoutCancel(parent)       // 1.21+
stop := context.AfterFunc(ctx, cleanup)     // 1.21+
```

ベストプラクティス:

- 第 1 引数で受け取り、構造体に格納しない
- `nil` を渡さず `context.TODO()`
- `WithValue` はリクエストスコープのデータのみ（オプション引数禁止）

### channel パターン

- **unbuffered** (`make(chan T)`): 送受同期、ハンドオフ
- **buffered** (`make(chan T, n)`): n 件まで非同期
- `close(ch)` + `v, ok := <-ch` で完了検知
- `select { case v := <-c1: ... case <-ctx.Done(): ... }` でキャンセル統合
- 単方向: `chan<- T` / `<-chan T` で API 制約

`go test -race` で data race 検出（CI で必須）。

## テスト

### 標準パターン（テーブルドリブン + サブテスト + Parallel）

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

### ヘルパー

| API | 用途 |
|---|---|
| `t.Run(name, f)` | サブテスト |
| `t.Parallel()` | 並列化（`Setenv`/`Chdir` と併用不可） |
| `t.Helper()` | スタックの当該フレームをスキップ |
| `t.Cleanup(f)` | LIFO で後始末 |
| `t.TempDir()` | 自動削除される一時ディレクトリ |
| `t.Setenv(k, v)` | テスト後に元に戻る環境変数 |

### ベンチマーク（1.24+ 推奨形）

```go
func BenchmarkX(b *testing.B) {
    for b.Loop() {  // タイマー自動制御＋最適化抑止
        Work()
    }
}
```

### Fuzzing（1.18+）

```go
func FuzzReverse(f *testing.F) {
    f.Add("hello")
    f.Fuzz(func(t *testing.T, s string) {
        if Reverse(Reverse(s)) != s { t.Fatal("not idempotent") }
    })
}
```

### `go test` 主要フラグ

| フラグ | 用途 |
|---|---|
| `-run <regexp>` | テスト名フィルタ |
| `-v` | 詳細出力 |
| `-race` | データ競合検出 |
| `-cover` / `-coverprofile=c.out` | カバレッジ |
| `-count N` | 繰返し（キャッシュ無効化に `-count=1`） |
| `-bench <regexp>` / `-benchmem` / `-benchtime=10s` | ベンチマーク |
| `-fuzz <regexp>` / `-fuzztime=10s` | ファジング |
| `-shuffle on` | 順序シャッフル |
| `-failfast` | 最初の失敗で停止 |
| `-json` | machine-readable |

## 周辺ツール（記事リンク）

| ツール | 用途 | 記事 |
|---|---|---|
| gopls | 公式 Language Server | [`languages/go/gopls.md`](gopls.md) |
| golangci-lint | linter aggregator | [`languages/go/golangci-lint.md`](golangci-lint.md) |
| govulncheck | 公式脆弱性スキャナ | [`languages/go/govulncheck.md`](govulncheck.md) |
| GoReleaser | クロスコンパイル + リリース自動化 | [`languages/go/goreleaser.md`](goreleaser.md) |
| Cobra | CLI フレームワーク | [`languages/go/cobra.md`](cobra.md) |
| Buf | Protobuf / gRPC ツールチェーン | [`tools/buf.md`](../../tools/buf.md) |

## トレンド（2025-2026）

- **構造化ログは `log/slog` がデファクト**: 新規プロジェクトの標準採用が増加。`zap` は `slog.Handler` ブリッジを公開
- **依存最小化志向**: `gorilla/mux` → `net/http.ServeMux`(1.22+)、`logrus` → `slog`、testify を避けて `testing` + `go-cmp` 派が増加
- **イテレータ**: 1.23 の range-over-func で関数チェーン的な書き方が広がる
- **PGO**: 1.21 デフォルト有効化以降、`default.pgo` を置くだけで最適化される
- **FIPS 140-3 / ポスト量子暗号**: 1.24 で標準対応、規制業界の Go 採用が拡大

## AI エージェントがよくやるミス

1. **`go.mod` の `go` 行を勝手に上げる** — 最小必須バージョンの宣言なので、CI / 配布先の Go 互換を壊す可能性。`toolchain` 行で済むなら `go` 行は触らない
2. **`for` ループ変数を `tt := tt` でシャドウ** — 1.22+ では不要。古い Go との互換維持目的でなければ削除する
3. **`context.Background()` を関数内で生成** — 第 1 引数で受け取って伝播するのが原則。HTTP ハンドラなら `r.Context()`
4. **`errors.Is/As` を使わず `==` で比較** — ラップされた error を見落とす。`%w` でラップしたら必ず `Is` / `As` で検査
5. **`defer cancel()` 忘れ** — `WithTimeout` / `WithCancel` の戻り値 cancel を呼ばないと goroutine リーク
6. **`go test` をキャッシュなしで回したがる** — 既定でファイル変更が無ければスキップされる。強制したいときだけ `-count=1`
7. **goroutine の起動だけして待たない** — `sync.WaitGroup` / `errgroup` / channel で必ず join

## 参考

- [Effective Go](https://go.dev/doc/effective_go)
- [Go Specification](https://go.dev/ref/spec)
- [Modules Reference](https://go.dev/ref/mod)
- [Toolchain](https://go.dev/doc/toolchain)
- [Release notes](https://go.dev/doc/devel/release)
- [The Go Blog](https://go.dev/blog/)
