---
reviewed: 2026-05-04
tags: [go, security, ci]
---

# govulncheck

Go セキュリティチームが開発する **公式の脆弱性検出 CLI**。`go.sum` の依存にある CVE を機械的に列挙するのではなく、**コールグラフ追跡で実際に到達する脆弱関数のみ** Affected として報告するため、汎用 CVE スキャナよりも誤検出が劇的に少ない。

公式: [go.dev/security/vuln](https://go.dev/security/vuln/) / [pkg.go.dev/golang.org/x/vuln/cmd/govulncheck](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck) / [GitHub](https://github.com/golang/vuln)

データソースは [vuln.go.dev](https://vuln.go.dev/)（Go vulnerability database）。GitHub Advisory / NVD / Go パッケージメンテナからの直接報告を Go チームがトリアージし、OSV 形式で配信する。Go チームは **severity ラベルを付けない方針**（文脈依存と判断）。

## インストール

```bash
go install golang.org/x/vuln/cmd/govulncheck@latest
```

Module mode 必須（GOPATH 非対応）。

## 基本コマンド

```bash
# カレントモジュールをソースモードで再帰スキャン
govulncheck ./...

# テストファイルも対象に含める
govulncheck -test ./...

# 詳細出力（コールスタック含む）
govulncheck -show=traces,verbose,color ./...

# JSON / SARIF / OpenVEX 出力
govulncheck -format=json ./...
govulncheck -format=sarif ./... > report.sarif
govulncheck -format=openvex ./...

# コンパイル済みバイナリのスキャン
govulncheck -mode=binary ./bin/myapp

# スキャン精度（symbol / package / module）
govulncheck -scan=symbol ./...

# 別の DB を使う
govulncheck -db=https://internal-vuln.example.com ./...
```

### 主要フラグ

| フラグ | 役割 |
|---|---|
| `-mode source\|binary\|extract` | スキャン対象。`extract` はバイナリの最小情報 blob を抽出 |
| `-scan symbol\|package\|module` | 解析の精度。symbol が最高精度（既定相当） |
| `-show traces,verbose,color` | カンマ区切り。`traces` で完全コールスタック |
| `-format text\|json\|sarif\|openvex` | 出力形式 |
| `-test` | テストコードも対象 |
| `-tags` | カンマ区切りビルドタグ |
| `-C <dir>` | 作業ディレクトリ変更 |
| `-db <url>` | カスタム DB（OSV スキーマ準拠） |

### Exit code の罠

テキスト出力では脆弱性 1 件以上で非 0 終了。**`-format=json` / `-format=sarif` / `-format=openvex` 使用時は脆弱性検出有無に関わらず 0 を返す**。CI で fail させたい場合は別途 jq 等で判定が必要。

## ソースモード vs バイナリモード

| 項目 | ソース（既定） | バイナリ |
|---|---|---|
| 入力 | Go ソース | コンパイル済みバイナリ |
| コールグラフ | あり | なし |
| 精度 | 高（実到達のみ報告） | 低（依存全列挙になりがち） |
| 用途 | 開発・CI | 配布物の事後チェック |

**ソースモードを優先**。バイナリモードは「ソースが手元にない配布バイナリ」の場合のみ。

## 出力フォーマット

```text
Vulnerability #1: GO-2021-0113
  Due to improper index calculation, ...
  More info: https://pkg.go.dev/vuln/GO-2021-0113
  Module: golang.org/x/text
    Found in: golang.org/x/text@v0.3.5
    Fixed in: golang.org/x/text@v0.3.7
    Call stacks in your code:
      main.go:12:29: vuln.tutorial.main calls golang.org/x/text/language.Parse
```

ID 体系は `GO-YYYY-NNNN`、詳細 URL は `https://pkg.go.dev/vuln/<ID>`。

`=== Informational ===` 区切りで「import はしているがコールスタック無し」の脆弱性を別出し（exit code に影響しない）。

## CI 統合（GitHub Actions）

### 公式 Action

```yaml
- uses: golang/govulncheck-action@v1
  with:
    go-version-input: stable
    go-package: ./...
```

主要 input: `go-version-input` / `go-version-file` / `go-package` / `output-format` / `output-file` / `repo-checkout`。

> **注意**: `output-format` を `json` / `sarif` にすると **脆弱性があっても success を返す**（公式 README 明記）。Code Scanning へ流す場合は別ステップで `github/codeql-action/upload-sarif` を呼ぶ運用が標準。

### SARIF → Code Scanning 連携

```yaml
- name: Run govulncheck
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck -format=sarif -scan=symbol ./... > results.sarif
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
```

**重要**: SARIF を Code Scanning に流す際は `-mode=source`（ソースモード）で実行すること。バイナリモードはソース行番号がなく SARIF 表示が破綻する。

### 直接 fail させる素朴なパターン

```yaml
- name: govulncheck
  run: |
    go install golang.org/x/vuln/cmd/govulncheck@latest
    govulncheck ./...        # text モードなので脆弱性検出で非 0 終了
```

## VS Code 統合（Go 拡張）

設定キー `go.diagnostic.vulncheck` に 2 値:

- `"Imports"`: gopls が import グラフ全体を `go.mod` 上で診断（軽量だが偽陽性あり）
- `"Off"`: 無効

加えて `gopls.ui.codelenses.run_govulncheck: true` で `go.mod` に「Run govulncheck」コードレンズが現れ、フル解析を on-demand 実行できる。コマンドパレット **`Go: Toggle Vulncheck`** でも切替可。

```jsonc
"go.diagnostic.vulncheck": "Imports",
"gopls": {
  "ui.codelenses": {
    "run_govulncheck": true
  }
}
```

## 制限・落とし穴

- **`reflect` 経由の呼び出しは解析対象外**（false negative の可能性）
- 関数ポインタ・interface 経由の呼び出しは保守的に解析（false positive の可能性）
- **GOPATH モード非対応** — Go modules 必須
- バイナリモードは精度低・依存全列挙になりがち
- 直接依存に CVE があってもコールスタックが無ければ Informational 扱い（テキストモードで非 0 にならない）
- 個別の発見を「無視（silence）」する公式機能は**無い**
- DB へのリクエストには **既知の module path のみ送信**、コードは送信されない（[privacy](https://vuln.go.dev/privacy.html)）

## 直近の変更

- **v1.1.1 (2024-05)**: SARIF 出力 `-format=sarif`
- **v1.1.2 (2024-06)**: OpenVEX 出力 `-format=openvex`
- **v1.1.3 (2024-07)**: Go 1.18 未満バイナリの標準ライブラリ脆弱性チェック対応
- **v1.1.4 (2025-01)**: 大規模プログラムで最大 15% 高速化、JSON に SBOM メッセージ追加
- **v1.2.0 / v1.3.0 (2026-04)**: Go directive を 1.25 に引き上げ、依存更新中心（GitHub Release ノート未作成）

## AI エージェントがよくやるミス

1. **`-format=json` で fail を期待** — JSON / SARIF / OpenVEX は脆弱性ありでも exit 0。CI で必ず fail させたいなら text モードか jq での判定が必要
2. **`-mode=binary` で SARIF 出力** — ソース行番号が無く Code Scanning 表示が壊れる。SARIF は `-mode=source` 必須
3. **`go.sum` の CVE 一覧と混同** — govulncheck は実際に到達するもののみ Affected として報告。Informational セクションを「すべて修正必須」と誤解しない
4. **silence 機能を探す** — 公式には無い。誤検出を回避したい場合は `reflect` 経由などのコメントで根拠を残し、PR で議論する
5. **GOPATH モードで実行** — エラー終了。Module mode で実行する
6. **`golang/govulncheck-action` のメンテ状況を信頼しすぎる** — 公式 Action だが更新頻度は低い。手動セットアップ（`go install` + 直接実行）が現場では確実

## 参考

- [Go vulnerability management](https://go.dev/security/vuln/)
- [govulncheck CLI reference](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck)
- [Tutorial](https://go.dev/doc/tutorial/govulncheck)
- [Editor integration](https://go.dev/doc/security/vuln/editor)
- [govulncheck-action](https://github.com/golang/govulncheck-action)
- [vuln.go.dev](https://vuln.go.dev/)
