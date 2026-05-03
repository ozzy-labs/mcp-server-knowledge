---
reviewed: 2026-04-18
tags: [lint, yaml, github, go]
---

# actionlint

GitHub Actions ワークフローファイル（`.github/workflows/*.yaml`）の静的解析ツール。構文エラー・式の型・shellcheck 連携・未知の runner やアクションを検出する。Go 製の単一バイナリ。

公式: [github.com/rhysd/actionlint](https://github.com/rhysd/actionlint)

## インストール

```bash
# mise
mise use actionlint@1

# Homebrew
brew install actionlint

# Go
go install github.com/rhysd/actionlint/cmd/actionlint@latest

# ワンライナー
bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
```

## 基本的な使い方

```bash
# リポジトリ内の全ワークフロー
actionlint

# 特定ファイル
actionlint .github/workflows/ci.yaml

# 色付き・詳細
actionlint -color

# 設定ファイル指定
actionlint -config-file .github/actionlint.yaml
```

## 検出対象

| カテゴリ | 例 |
|---|---|
| YAML / Workflow 構文 | `jobs.*` に `run-on:`（typo、`runs-on` が正） |
| 式の型 | `${{ github.event.number }}` が number 型なのに文字列結合 |
| 式の参照 | 存在しない output / secret / variable の参照 |
| `runs-on` | 未知の runner ラベル（`ubuntu-late` 等） |
| `uses` | 存在しない action、タグ未指定 |
| shell 記述 | `run:` 内のシェルスクリプト（shellcheck 経由） |
| needs グラフ | 循環依存、存在しない job |
| if 条件 | 型不整合、未使用ブランチ |
| matrix | 存在しないキー参照 |

## shellcheck 連携

`run:` ブロックを shellcheck に流して shell スクリプトを検証する。shellcheck がインストールされていれば自動的に連携する:

```yaml
- run: |
    if [ $BAR = "foo" ]; then  # shellcheck が「$BAR は空で展開されうる」警告
      echo matched
    fi
```

無効化: `actionlint -shellcheck=`（空指定）。

## pyflakes 連携

`shell: python` や `with: actions/github-script` の `script` 内 Python を pyflakes で検証できる（環境にインストールされていれば自動）。

## 設定 `.github/actionlint.yaml`

```yaml
self-hosted-runner:
  labels:
    - my-self-hosted
    - gpu

config-variables:
  - ENV_NAME
  - REGION

paths:
  .github/workflows/deploy.yaml:
    ignore:
      - 'job "build" needs.*'  # 一時的に抑止
```

## 個別抑制

### ファイル単位

```yaml
# actionlint: shellcheck-disable=SC2086
```

### ワークフロー冒頭

```yaml
# actionlint-disable
```

行末インラインのサポートは限定的なので、`.github/actionlint.yaml` の `paths` で範囲指定するのが実務的。

## pre-commit 連携（lefthook）

```yaml
pre-commit:
  commands:
    actionlint:
      glob: ".github/workflows/*.{yaml,yml}"
      run: actionlint
```

ワークフローファイルに変更がない限りは走らないので高速。

## CI での使い方

```yaml
jobs:
  lint-workflows:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: reviewdog/action-actionlint@v1
        with:
          reporter: github-pr-review
```

`reviewdog/action-actionlint` は PR コメントに直接指摘を付ける。生コマンド呼び出しも可能:

```yaml
- run: |
    bash <(curl https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
    ./actionlint -color
```

## よく捕まえるミス

1. **`on:` を文字列で書いてしまう** — `on: push` は OK だが、イベントに条件を付ける場合は object 形式が必要
2. **secrets / vars のタイポ** — `${{ secrets.NMP_TOKEN }}` → `NPM_TOKEN`
3. **`needs: [a]` で a が存在しない** — job id の typo
4. **fork PR で `secrets` を参照** — `pull_request` では secrets が空
5. **未知の runner** — `ubuntu-latest-large` 等の organization-custom runner は設定ファイルで宣言
6. **action の version pinning 漏れ** — `uses: actions/checkout`（タグなし）で警告

## トラブルシュート

### 既存ワークフローで大量エラーが出る

`paths.<workflow>.ignore` で既知のパターンを一時除外し、段階的に潰す。

### self-hosted runner ラベルが「未知」と出る

`.github/actionlint.yaml` の `self-hosted-runner.labels` に追加。

### organization の custom variable が未定義扱い

`config-variables` に列挙。

### shellcheck が走らない

shellcheck が PATH にない。`mise use shellcheck@0.11` でインストール。

## 他ツールとの比較

| 観点 | actionlint | reviewdog/action-actionlint | GitHub UI |
|---|---|---|---|
| 検出精度 | 高 | actionlint と同じ | 基本的な構文のみ |
| 実行環境 | ローカル + CI | CI（PR コメント付き） | 保存時 |
| shellcheck 連携 | あり | あり | なし |
| 式の型チェック | あり | あり | なし |

実質、ワークフロー品質を担保するなら actionlint 一択。本リポジトリも lefthook pre-commit で運用。
