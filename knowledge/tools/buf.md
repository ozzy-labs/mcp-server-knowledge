---
reviewed: 2026-05-04
tags: [go, protobuf, grpc, codegen]
---

# Buf

Protobuf ツールチェーンを統合した CLI。`protoc` を直接呼ぶ代わりに、依存解決・lint・breaking change 検出・format・コード生成・スキーマレジストリ連携を 1 つの CLI で完結させる。Buf Schema Registry (BSR) と組み合わせると **npm / pip 風の Protobuf 依存管理**が可能になる。

公式: [buf.build/docs](https://buf.build/docs/) / [GitHub](https://github.com/bufbuild/buf)

最新は **v1.69.0**（2026-04 時点）。CLI バージョンは v1 系を維持しつつ、設定スキーマは v2 が現行（v2 は CLI v1.32.0 / 2024-05 で導入）。

## インストール

```bash
brew install bufbuild/buf/buf                         # macOS / Linux
npm install @bufbuild/buf                             # Node 経由
go install github.com/bufbuild/buf/cmd/buf@latest     # Go
scoop install buf                                     # Windows
winget install bufbuild.buf                           # Windows
docker run --rm -v "$(pwd):/workspace" -w /workspace bufbuild/buf lint
```

## 主要コマンド

| コマンド | 用途 |
|---|---|
| `buf build` | `.proto` を Buf イメージ / FileDescriptorSet にコンパイル |
| `buf lint` | スタイル / 構造ルール（40+）チェック |
| `buf format` | proto ファイル整形 |
| `buf breaking` | 過去バージョンとの破壊的変更検出（60+ ルール） |
| `buf generate` | ローカル / リモートプラグインでコード生成 |
| `buf curl` | gRPC / gRPC-Web / Connect エンドポイントを HTTP 風に呼び出し |
| `buf convert` | binary ⇔ JSON 変換 |
| `buf dep update` / `buf dep prune` / `buf dep graph` | 依存解決（v2） |
| `buf push` | BSR にモジュールを公開 |
| `buf export` | BSR モジュールをローカルに展開 |
| `buf config init` | v2 で初期化 |
| `buf config migrate` | v1 設定 → v2 自動移行（`--diff` で事前確認） |
| `buf registry login` | BSR 認証 |
| `buf lsp serve` | LSP サーバー（エディタ統合） |

`buf mod init` / `buf mod update` / `buf mod prune` は v1 名で、v2 では `buf config init` / `buf dep update` / `buf dep prune` に置換された（旧名は deprecated 警告付きで動作）。

## 設定ファイル

### `buf.yaml`（v2）

```yaml
version: v2
modules:
  - path: proto
    name: buf.build/acme/petapis      # BSR モジュール名（任意）
    excludes: [proto/legacy]
deps:
  - buf.build/googleapis/googleapis
  - buf.build/bufbuild/protovalidate
lint:
  use: [STANDARD]                     # 既定: STANDARD
  except: [PACKAGE_NO_IMPORT_CYCLE]
  service_suffix: Service
  enum_zero_value_suffix: _UNSPECIFIED
breaking:
  use: [FILE]                         # 既定: FILE
  ignore_unstable_packages: true
```

### `buf.gen.yaml`（v2）

```yaml
version: v2
inputs:
  - directory: .
plugins:
  - remote: buf.build/protocolbuffers/go    # BSR ホスト型（推奨）
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/connectrpc/go
    out: gen/go
    opt: paths=source_relative
  - local: protoc-gen-go                    # ローカルバイナリ
    out: gen/go
  - protoc_builtin: cpp                     # protoc 内蔵
    out: gen/cpp
```

`buf.lock` は依存ロック（自動生成）。

## v1 → v2 移行

2024-05 の CLI v1.32.0 で v2 設定が導入された。新規プロジェクトは v2 が標準。

```bash
buf config migrate --diff      # 差分確認
buf config migrate             # 適用
```

主な変更:

- **`buf.work.yaml` 廃止** → `buf.yaml` の `modules:` リストに統合
- 全モジュールが共通の `deps` を共有
- `buf.gen.yaml` のプラグイン指定が `remote` / `local` / `protoc_builtin` に分離
- Managed mode が `disable` / `override` の 2 トップレベルキーに簡略化
- lint 既定が **STANDARD**（v1 は DEFAULT）
- 新ルール `PACKAGE_NO_IMPORT_CYCLE` 追加（自動移行時は `except` に追加され、手動有効化推奨）

## Lint カテゴリ

| カテゴリ | 内容 |
|---|---|
| `MINIMAL` | パッケージ整合・ディレクトリ構造の最低限 |
| `BASIC` | MINIMAL + 命名規則 + import 制御 |
| `STANDARD`（既定） | BASIC + `ENUM_VALUE_PREFIX`, `FILE_LOWER_SNAKE_CASE`, `SERVICE_SUFFIX`, `PROTOVALIDATE` |
| `COMMENTS` | コメント必須化（7 ルール） |
| `UNARY_RPC` | streaming 禁止 |

## Breaking カテゴリ（厳格度順）

| カテゴリ | 用途 |
|---|---|
| `FILE`（既定） | ファイル単位の生成コード互換性。Python / C++ などファイル構成が出力に影響する言語向け |
| `PACKAGE` | パッケージ単位。同一 package 内のファイル間移動を許容 |
| `WIRE_JSON` | wire（binary）と JSON エンコーディングの両互換 — 実用上の最低推奨 |
| `WIRE` | binary wire 互換のみ |

```bash
buf breaking --against '.git#branch=main'           # git ref と比較
buf breaking --against image.bin                    # 過去のイメージファイル
buf breaking --against buf.build/acme/petapis       # BSR モジュール
```

## Buf Schema Registry (BSR)

- **パブリック**: [buf.build](https://buf.build/)
- **モジュールパス**: `buf.build/<owner>/<module>`（例: `buf.build/googleapis/googleapis`）
- **認証**: `buf registry login`、CI では `BUF_TOKEN` 環境変数
- **依存解決**: `buf.yaml` の `deps:` に宣言、`buf dep update` で `buf.lock` 更新
- **Generated SDKs**: 一部モジュールは BSR 経由で `go get` / `npm install` 可能

## リモートプラグイン

ローカルに plugin バイナリを入れずに BSR 上で生成が走る。主要なもの:

| Plugin | 用途 |
|---|---|
| `buf.build/protocolbuffers/go` | Go の message / enum 生成 |
| `buf.build/connectrpc/go` | Connect-Go サーバ / クライアント |
| `buf.build/grpc/go` | gRPC-Go サーバ / クライアント |
| `buf.build/bufbuild/es` | TypeScript（`@bufbuild/protobuf`） |
| `buf.build/connectrpc/es` | Connect-ES |
| `buf.build/protocolbuffers/{java,python,kotlin,csharp,ruby,php,objc}` | 各言語標準 |

## Connect

bufbuild 発の gRPC 互換 RPC ライブラリ群。組織は `connectrpc` に分離されており、`connectrpc.com/connect` パッケージ（旧 `github.com/bufbuild/connect-go` から移行）。

- **Connect protocol**: HTTP/1.1, HTTP/2, HTTP/3 で動く独自プロトコル
- **3 プロトコル同時対応**: 1 つの ServiceHandler が gRPC + gRPC-Web + Connect を全部喋る
- **生成物**: `protoc-gen-connect-go` が `net/http` ベースの型安全 Handler / Client を出力
- **安定実装**: Connect-Go / Connect-ES / Connect-Swift
- **ベータ**: Connect-Kotlin / Connect-Python

最新の Connect-Go は **v1.19.2**（2026-04）。

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

## CI 統合（GitHub Actions）

**推奨**: `bufbuild/buf-action@v1`（統合アクション、build / lint / format / breaking / push を一括実行、PR サマリーコメント自動投稿）。

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
          token: ${{ secrets.BUF_TOKEN }}     # BSR push 不要なら省略可
```

`bufbuild/buf-setup-action` は **deprecated**（`buf-action` への置き換え推奨）。個別アクション `buf-lint-action` / `buf-breaking-action` / `buf-push-action` も存在するが新規導入では不要。

## AI エージェントがよくやるミス

1. **`buf.work.yaml` を v2 で書く** — v2 では廃止。`buf.yaml` の `modules:` に統合する
2. **`plugin: ...` を v2 の `buf.gen.yaml` で使う** — v2 では `remote:` / `local:` / `protoc_builtin:` のいずれかに明示分離
3. **`buf mod` を新規プロジェクトで使う** — deprecated。`buf config init` / `buf dep update` を使う
4. **breaking を `WIRE` で十分と判断** — JSON エンコーディング（gRPC-Web / Connect）を使うなら `WIRE_JSON` 以上が最低推奨
5. **lint カテゴリに `DEFAULT` / `FILE_LAYOUT` / `STYLE_*` を書く** — 現行 v2 には存在しない（v1beta1 時代の名前）。`MINIMAL` / `BASIC` / `STANDARD` / `COMMENTS` / `UNARY_RPC` のみ
6. **`bufbuild/connect-go` を import する** — `connectrpc.com/connect` に移行済み。古い path はメンテされない
7. **CI で `buf-setup-action` を新規採用** — deprecated。`buf-action` 単体に置き換える

## 参考

- [CLI Installation](https://buf.build/docs/cli/installation/)
- [buf.yaml v2](https://buf.build/docs/configuration/v2/buf-yaml/)
- [buf.gen.yaml v2](https://buf.build/docs/configuration/v2/buf-gen-yaml/)
- [Lint rules](https://buf.build/docs/lint/rules/)
- [Breaking rules](https://buf.build/docs/breaking/rules/)
- [v1 → v2 migration](https://buf.build/docs/migration-guides/migrate-v2-config-files/)
- [Buf Schema Registry](https://buf.build/docs/bsr/)
- [Connect docs](https://connectrpc.com/docs/introduction)
- [bufbuild/buf-action](https://github.com/bufbuild/buf-action)
