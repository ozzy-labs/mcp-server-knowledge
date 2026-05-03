---
reviewed: 2026-05-04
tags: [data-cli, yaml, go]
---

# yq

YAML / JSON / TOML / HCL / XML / INI / CSV / TSV / properties を扱うコマンドライン処理ツール。`jq` の YAML 版的な位置付けだが、**実装が 2 つあり挙動が大きく違う**。本記事では事実上の標準である **Mike Farah 版（Go 製、`mikefarah/yq`）** を扱う。`tools/jq.md` の知識を YAML に拡張する。

公式: [mikefarah.gitbook.io/yq](https://mikefarah.gitbook.io/yq) / [mikefarah/yq](https://github.com/mikefarah/yq)

## 2 種類の yq に注意

| 実装 | 言語 | 特徴 |
|---|---|---|
| **Mike Farah 版** | Go | バイナリ単体配布。複数フォーマット対応。**現代の標準** |
| kislyuk 版 | Python | jq のラッパー。`pip install yq` で入る。構文・挙動が異なる |

`yq --version` で `mikefarah/yq` と出るかを確認する。kislyuk 版を期待して書かれた古い資料・スクリプトは Mike Farah 版で動かない。

## インストール

```bash
brew install yq
mise use yq
sudo snap install yq
go install github.com/mikefarah/yq/v4@latest

# 公式バイナリ直接
curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/local/bin/yq
chmod +x /usr/local/bin/yq
```

## 基本構文

```bash
# 読み取り
yq '.spec.replicas' deployment.yaml
yq '.containers[0].image' deployment.yaml
yq '.metadata.labels.app' deployment.yaml

# パイプで連鎖
yq '.spec.template.spec | .containers[].name' deployment.yaml

# 配列の splat
yq '.[]' list.yaml

# 条件抽出
yq '.[] | select(.status == "active") | .name' list.yaml
```

`jq` と同じ dot 記法・パイプ・`select()` が使える。

## 書き換え (in-place)

```bash
# 値を代入（リテラル文字列）
yq -i '.image = "nginx:1.27"' deployment.yaml

# パイプで更新（既存値を加工）
yq -i '.replicas |= . + 1' deployment.yaml

# キー追加
yq -i '.metadata.labels.env = "prod"' deployment.yaml

# キー削除
yq -i 'del(.metadata.annotations)' deployment.yaml
```

`-i` を**忘れると stdout に出るだけ**でファイルは変わらない。`jq` には in-place 機能がない（一時ファイル経由が必要）ので、yq の強み。

## eval と eval-all

| サブコマンド | 用途 |
|---|---|
| `eval` / `e`（既定） | ファイルを 1 つずつ独立処理 |
| `eval-all` / `ea` | 全入力を **同時に**読み込み、ドキュメント横断で処理 |

```bash
# 複数ファイルをマージ（後勝ち）
yq ea '. as $item ireduce ({}; . * $item)' base.yaml override.yaml

# 簡略形（最も使う）
yq ea '.[0] * .[1]' base.yaml override.yaml

# 複数ドキュメント YAML（--- 区切り）の全件処理
yq ea '.[].name' multi-doc.yaml
```

**複数ドキュメント YAML** で `yq '.'` のように `eval` を使うと **最初のドキュメントしか処理されない**。`ea` を使うか、`-s` で全部出すか、`yq '... | ...' all-docs.yaml` のように工夫する。

## 出力フォーマット変換

```bash
yq -o=json '.' config.yaml         # YAML → JSON
yq -o=yaml '.' config.json         # JSON → YAML（jq 代替）
yq -o=toml '.' config.yaml         # TOML（v4.52+ で双方向対応）
yq -o=props '.' config.yaml        # Java properties
yq -o=xml '.' config.yaml          # XML
yq -o=csv '.[]' list.yaml          # CSV（配列のみ）
yq -o=tsv '.[]' list.yaml          # TSV
yq -p=toml -o=yaml '.' config.toml # TOML → YAML
yq -p=xml -o=yaml '.' config.xml   # XML → YAML（-p で入力指定）
```

`-p` で入力フォーマット、`-o` で出力フォーマットを切替。bash スクリプト内で `--output-format json | jq` の連鎖が定石。

## 環境変数の注入

```bash
export IMAGE=nginx:1.27
yq -i '.image = strenv(IMAGE)' deployment.yaml

# 数値や bool を保持したい場合
export REPLICAS=3
yq -i '.replicas = env(REPLICAS)' deployment.yaml
```

| 関数 | 戻り値 |
|---|---|
| `strenv(VAR)` | 文字列として |
| `env(VAR)` | 型推論あり（数値 / bool は変換） |

シークレットを引数に直接書くのは履歴に残るので、必ず env 経由にする。

## マージ操作

```bash
# シャローマージ（後勝ち）
yq ea '.[0] * .[1]' base.yaml override.yaml

# 深いマージ
yq ea '.[0] *d .[1]' base.yaml override.yaml

# 配列を結合（既定は上書き）
yq ea '.[0] *+ .[1]' base.yaml override.yaml
```

`*` の修飾子:

| 記号 | 効果 |
|---|---|
| `*` | シャローマージ |
| `*d` | 再帰的（deep）マージ |
| `*+` | 配列を append |
| `*?` | 衝突時は何もしない |
| `*n` | null を上書き対象外に |

## 複数ドキュメント YAML の扱い

```bash
# k8s manifest をひとつずつ処理
yq ea '.[] | select(.kind == "Deployment")' all.yaml

# 別ファイルとして取り出す
yq -s '.kind + "-" + .metadata.name' all.yaml
# → Deployment-web.yml / Service-api.yml ... が生成される
```

`-s` の引数は出力ファイル名のテンプレート（拡張子は自動付与）。

## CI 連携の典型例

```bash
# kustomize 不要の軽い書き換え
yq -i '.image.tag = strenv(IMAGE_TAG)' values.yaml
helm upgrade --install api ./chart -f values.yaml

# k8s manifest の image を全部書き換え
yq -i 'select(.kind == "Deployment") | .spec.template.spec.containers[].image |= sub("^old-registry/"; "new-registry/")' all.yaml
```

## AI エージェントがよくやるミス

1. **kislyuk 版の構文を期待する** — `jq` ラッパー前提の `yq -y .` のような構文は Mike Farah 版では動かない。`yq --version` で実装を確認
2. **`-i` を忘れて stdout に出るだけ** — ファイル書き換えと思ったら何も変わっていない
3. **複数ドキュメントを `eval` で処理** — `---` 区切りの全件は `eval-all` (`ea`)
4. **boolean / null の表現差** — `true` / `yes` / `y` / `on` はすべて bool true として扱われる旧 YAML 1.1 の罠。`!!str` で文字列強制
5. **コメントが消える** — yq はコメント位置の保存を試みるが、構造変更で外れることがある。重要なコメントは別ファイルで管理
6. **`strenv` と `env` の混同** — 数値や bool に変換したいなら `env()`、文字列で入れたいなら `strenv()`
7. **PowerShell でのクオート** — `'.foo.bar'` のシングルクォートが効かないので `--quote='..'` パターンを使う、または bash 経由
8. **配列の `[]` を範囲外アクセス** — `yq '.list[10]'` は null を返す（エラーにならない）。条件付きアクセスには `select` を併用

## 関連

- [`tools/jq.md`](jq.md) — JSON 用の同思想ツール。yq の出力を jq に流すパターン頻出
- [`tools/yamlfmt.md`](yamlfmt.md) — フォーマット
- [`tools/yamllint.md`](yamllint.md) — 静的検証

## 参考

- [yq Documentation (Mike Farah)](https://mikefarah.gitbook.io/yq)
- [mikefarah/yq (GitHub)](https://github.com/mikefarah/yq)
- [Operators Reference](https://mikefarah.gitbook.io/yq/operators)
