---
reviewed: 2026-05-04
tags: [data-cli, rust, fast]
aliases: [rg]
---

# ripgrep

`grep` 互換の高速検索ツール（バイナリ名 `rg`）。Rust 製で、`.gitignore` を既定で尊重し、並列ファイル探索 + SIMD 加速で `grep -r` / `ag` / `ack` を大きく上回る速度を出す。AI エージェントがコードベースを探索するときの第一選択。`grep` 知識のままだと `--type` の名前体系・正規表現エンジン・ignore ファイル挙動で誤りやすいので押さえておく。

公式: [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) / [User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)

## インストール

```bash
brew install ripgrep
mise use ripgrep
cargo install ripgrep
sudo apt install ripgrep              # Debian / Ubuntu
sudo dnf install ripgrep              # Fedora
winget install BurntSushi.ripgrep.MSVC
```

## 主要オプション

| フラグ | 用途 |
|---|---|
| `-i` | 大文字小文字無視 |
| `-S` | smart case（パターンに大文字があれば case-sensitive） |
| `-w` | 単語境界マッチ |
| `-v` | 反転マッチ |
| `-n` | 行番号表示（既定オン） |
| `-l` | マッチしたファイル名のみ |
| `-c` | マッチ数のみ |
| `-A N` / `-B N` / `-C N` | 後ろ / 前 / 前後 N 行のコンテキスト |
| `-t <type>` / `-T <type>` | 言語タイプで絞る / 除外 |
| `-g '<glob>'` | glob で絞る（`!` で除外） |
| `--no-ignore` | `.gitignore` 等を無視 |
| `--hidden` | 隠しファイルも対象 |
| `-z` | gz / bz2 / xz 等の圧縮ファイル内も検索 |
| `-F` | リテラル文字列（regex 無効） |
| `-P` | PCRE2 エンジンで実行 |
| `-U` / `--multiline` | 複数行マッチを許可 |
| `--files` | パターン無しで対象ファイル一覧を表示 |
| `--json` | 構造化 JSON 出力 |
| `--vimgrep` | Vim quickfix 形式 |
| `-a` / `--text` | バイナリ判定をスキップ |
| `--debug` | 設定ロード状況を表示 |

## ignore ファイルの優先順位

```text
.rgignore     ← 最優先（ripgrep 固有）
.ignore       ← 言語非依存
.gitignore    ← 最弱
```

加えて `.git/info/exclude` と `core.excludesFile` も見る。上位ファイルの除外ルールを下位の `!pattern` で**ホワイトリスト**復活できる。**無視を全部切る**には `--no-ignore`、隠しファイルも含めるなら `--no-ignore --hidden -uuu` を使う。

```bash
rg -uuu pattern   # -u を 3 回で「ignore + hidden + binary」全解除
```

`-u` の段階:

| 回数 | 効果 |
|---|---|
| `-u` | `.gitignore` / `.ignore` を無視 |
| `-uu` | + 隠しファイル |
| `-uuu` | + バイナリファイル |

## ファイルタイプ

```bash
rg -t py 'def main'        # Python のみ
rg -T js 'TODO'            # JavaScript 以外
rg --type-list             # 全タイプ一覧
```

`grep` の `--include='*.py'` と違い、**事前定義された type 名**を使う（`py`, `js`, `ts`, `rs`, `go`, `md`, `yaml`, `toml` 等）。カスタム追加は `--type-add`:

```bash
rg --type-add 'web:*.{html,css,js}' -t web 'class='
```

## 設定ファイル

`RIPGREP_CONFIG_PATH=~/.config/ripgrep/rc` のように環境変数で指定する。**フラグ 1 行 1 つ**:

```text
# ~/.config/ripgrep/rc
--smart-case
--max-columns=200
--type-add=web:*.{html,css,js}
--colors=line:fg:yellow
```

エスケープ機構が無いので、引用符を含むパターンは書きにくい。CLI 引数は config を**上書き**する。`--no-config` で完全無効化。

## パターンエンジン

| モード | エンジン | 特徴 |
|---|---|---|
| 既定 | Rust regex | 高速・線形時間保証。lookaround / 後方参照は **使えない** |
| `-F` | リテラル | 文字列そのまま検索（最速） |
| `-P` | PCRE2 | lookaround / 後方参照 / 名前付きキャプチャ可 |

```bash
# Rust regex では不可
rg 'foo(?=bar)' src/         # ← エラー

# PCRE2 で可能
rg -P 'foo(?=bar)' src/
```

`(?=...)` `(?!...)` `(?<=...)` `(?<!...)` `\1` `(?P<name>...)` などは `-P` 必須。

## 出力フォーマット

```bash
# JSON 出力（jq 等で後処理）
rg --json 'TODO' | jq -r '
  select(.type == "match")
  | "\(.data.path.text):\(.data.line_number) \(.data.lines.text)"
'

# Vim quickfix
rg --vimgrep 'TODO'

# ファイル一覧のみ
rg --files -t py        # py 拡張子のファイル
```

## stdin / パイプ

```bash
cat large.log | rg -A 2 'ERROR'
git diff | rg '^\+.*TODO'         # 追加行の TODO だけ
```

stdin が tty でないと自動的に line buffered モードになる。

## 並列度

ripgrep は CPU コア数に応じて自動的に並列化する。`-j N` で明示的に制限可能（巨大リポでメモリ抑制したいときなど）。

## `grep` / `ag` / `git grep` との比較

| 観点 | ripgrep | grep | ag (silver searcher) | git grep |
|---|---|---|---|---|
| `.gitignore` 尊重 | 既定 | 無し | 既定 | 既定（git index 限定） |
| 並列 | 自動 | 無し | 並列 | 並列（一部） |
| Unicode | 既定 | ロケール依存 | 限定 | 限定 |
| Lookaround | `-P` で対応 | `-P` で対応（GNU） | 不可 | 不可 |
| バイナリ自動判定 | あり | あり | あり | あり |
| 圧縮ファイル | `-z` | `zgrep` で別 | 限定 | 不可 |
| 速度 | 最速 | 遅め | 速い | 速い |

`git grep` はワーキングツリーのみで OK な場合に有用（インデックス時間ゼロ）、それ以外は ripgrep が概ね上位互換。

## AI エージェントがよくやるミス

1. **lookaround を使ってパースエラー** — Rust regex には lookaround が無い。`-P` を付ける、または `--engine pcre2`
2. **`.gitignore` で対象ファイルが消える** — `node_modules/` 配下を読みたいのに見つからない、`dist/` を読めない等。`--no-ignore` または `-uu` で外す
3. **`-t` の type 名を勘違い** — `--include` 風に `'*.py'` を `-t` に渡すとエラー。type 名は `--type-list` で確認
4. **`-g` を引用しない** — シェルが先に展開してしまう。`-g '!*.test.ts'` のようにシングルクォート必須
5. **`-l` の用途を `--files-without-match` と混同** — `-l` はマッチがあったファイル、`--files-without-match` はマッチが無かったファイル
6. **複数行検索で `-U` 忘れ** — 既定はラインベース。改行を跨ぐパターンには `-U` または `(?s)` 等を併用
7. **巨大バイナリで `-a` を多用** — メモリと時間を浪費する。バイナリは別ツール（`strings` 等）で扱う
8. **設定ファイルが効かない** — `RIPGREP_CONFIG_PATH` が未設定。`rg --debug` で読み込み状況を確認

## 関連

- [`tools/jq.md`](jq.md) — `--json` 出力の後処理
- [`tools/ast-grep.md`](ast-grep.md) — 構造ベース検索が必要な場合の選択肢
- [`languages/bash.md`](../languages/bash.md) — シェルからの呼び出し基礎

## 参考

- [BurntSushi/ripgrep (GitHub)](https://github.com/BurntSushi/ripgrep)
- [User Guide](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)
- [FAQ](https://github.com/BurntSushi/ripgrep/blob/master/FAQ.md)
