---
reviewed: 2026-05-03
tags: [test, bash]
---

# bats (bats-core)

Bash 3.2+ で動く TAP 準拠のテストフレームワーク。`.bats` ファイル内に `@test` ブロックを書き、`run` でコマンドを実行して終了コードや出力を assert する。AI エージェントがシェルスクリプトを書くなら、`shellcheck` でも捕まえられない**動作面の回帰**を防ぐ唯一現実的な手段。`languages/bash.md` と組で使う。

公式: [bats-core.readthedocs.io](https://bats-core.readthedocs.io/en/stable/) / [bats-core/bats-core](https://github.com/bats-core/bats-core)

## インストール

```bash
# npm
npm install -g bats

# Homebrew
brew install bats-core

# mise
mise use bats

# git submodule（リポジトリ内に固定したい場合）
git submodule add https://github.com/bats-core/bats-core.git test/bats
git submodule add https://github.com/bats-core/bats-support.git test/test_helper/bats-support
git submodule add https://github.com/bats-core/bats-assert.git test/test_helper/bats-assert
```

ヘルパライブラリ（後述）も同時に入れるのが定石。

## 最小例

```bash
# tests/hello.bats
#!/usr/bin/env bats

@test "echo hello" {
  result=$(echo "hello")
  [ "$result" = "hello" ]
}

@test "false fails" {
  run false
  [ "$status" -eq 1 ]
}
```

```bash
bats tests/hello.bats           # 単一ファイル
bats -r tests/                  # 再帰
bats --tap tests/               # TAP 出力（CI 連携）
bats -j 4 tests/                # 4 並列
bats --filter 'echo' tests/     # 名前パターンで絞る
```

## `run` と特殊変数

`run <command>` で実行すると、以下の変数が自動セットされる:

| 変数 | 内容 |
|---|---|
| `$status` | 終了コード |
| `$output` | stdout + stderr の結合（既定で merge） |
| `$stderr` | stderr のみ（`run --separate-stderr` 時） |
| `$lines[]` | `$output` を行で分割した配列 |
| `$stderr_lines[]` | `$stderr` の行配列 |

```bash
@test "ls reports files" {
  run ls /tmp
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -gt 0 ]
}
```

`run` の前に `set -e` 等を付けると意図せず止まることがあるので、Bats では原則使わない。

## 主要フック

| フック | タイミング |
|---|---|
| `setup` | **各 `@test` の前**（同ファイル内） |
| `teardown` | 各 `@test` の後（成功・失敗どちらも） |
| `setup_file` | ファイル先頭で 1 回 |
| `teardown_file` | ファイル末尾で 1 回 |
| `setup_suite` | スイート全体で 1 回（`setup_suite.bash` を別途配置） |
| `teardown_suite` | スイート末尾で 1 回 |

```bash
setup() {
  TMP=$(mktemp -d)
}

teardown() {
  rm -rf "$TMP"
}

@test "creates a file" {
  touch "$TMP/file"
  [ -f "$TMP/file" ]
}
```

`setup_suite` のみ命名が特殊で、`tests/setup_suite.bash` という**専用ファイル**に書く必要がある（同名関数を `.bats` に書いても呼ばれない）。

## ヘルパライブラリ

```bash
# tests/test_helper.bash
load 'test_helper/bats-support/load'
load 'test_helper/bats-assert/load'
load 'test_helper/bats-file/load'
```

```bash
# tests/foo.bats
load test_helper

@test "fails with helpful message" {
  run my-command
  assert_success
  assert_output --partial "expected substring"
  refute_line "should not appear"
  assert_file_exists /tmp/output.log
}
```

| ライブラリ | 用途 |
|---|---|
| `bats-support` | 他ヘルパの基盤（共通エラー出力等） |
| `bats-assert` | `assert_success` / `assert_failure` / `assert_output` / `assert_line` / `refute_*` |
| `bats-file` | `assert_file_exists` / `assert_file_not_executable` / `assert_dir_exists` |
| `bats-mock` | コマンドのモック化 |

素の `[ ... ]` よりエラーメッセージが圧倒的に親切（失敗時に diff 風に出る）。

## `skip` と `bats run` のタグ

```bash
@test "wip feature" {
  skip "not implemented yet"
  ...
}

@test "linux only" {
  [ "$(uname)" = "Linux" ] || skip "linux only"
  ...
}
```

タグ機能（v1.10+）:

```bash
# bats file:tag テスト名
@test "needs network" {
  # bats test_tags=network,slow
  ...
}
```

```bash
bats --filter-tags 'network' tests/   # network タグのみ
bats --filter-tags '!slow' tests/     # slow を除外
```

## 並列実行と分離

```bash
bats -j 4 tests/
```

`setup_file` / `teardown_file` を使うと並列で衝突しやすいので、`BATS_RUN_TMPDIR` や `BATS_FILE_TMPDIR` を使ってファイル単位で隔離する。

| 変数 | 内容 |
|---|---|
| `BATS_TEST_TMPDIR` | テスト単位の tmpdir |
| `BATS_FILE_TMPDIR` | ファイル単位の tmpdir |
| `BATS_SUITE_TMPDIR` | スイート単位の tmpdir |
| `BATS_TEST_NAME` | 実行中のテスト名 |
| `BATS_TEST_FILENAME` | テストファイルのパス |

これらは終了時に自動削除される（`--no-tempdir-cleanup` で残せる）。

## CI 連携

```yaml
- uses: actions/checkout@v6
- run: |
    sudo apt-get install -y bats
    bats --tap -r tests/
```

`--tap` を `mocha-tap` 等のレポーターに食わせると JUnit XML 化できる。GitHub Actions なら `bats-action` という公式アクションも使える。

## CLI ツールのテスト例

```bash
# tests/cli.bats
load test_helper

setup() {
  cd "$BATS_FILE_TMPDIR"
}

@test "cli --help shows usage" {
  run bin/mycli --help
  assert_success
  assert_output --partial "Usage:"
}

@test "cli rejects unknown flags" {
  run bin/mycli --bogus
  assert_failure 64
  assert_line --partial "unknown option"
}
```

## AI エージェントがよくやるミス

1. **`run` を使わずに直接コマンド実行** — 直接実行だと終了コード非ゼロでテストが即落ちる。回避には `run` で捕捉してから assert する
2. **`set -e` を `setup` に書く** — `run` の挙動と相性が悪く、誤検出が増える。Bats 内では `set -e` を使わない
3. **`$output` が改行混じりで等値比較できない** — `assert_output --partial` か `[[ "$output" == *"foo"* ]]` を使う
4. **`setup_suite` を `.bats` 内に書いて呼ばれない** — `tests/setup_suite.bash` という専用ファイルに置く
5. **テスト名に変数展開を期待する** — `@test "$VAR"` は展開されない（リテラル文字列のみ）
6. **並列で `BATS_TMPDIR` をハードコード** — 並列実行時は `BATS_TEST_TMPDIR` / `BATS_FILE_TMPDIR` を使う
7. **`assert_*` が動かない** — `load test_helper` を忘れている。または submodule 取得忘れ
8. **`bash` 4 専用構文を使って 3.2 で落ちる** — Bats は Bash 3.2+ サポート。`mapfile` / `${var^^}` 等は 3.2 では動かない

## 関連

- [`languages/bash.md`](../languages/bash.md) — テスト対象の言語
- [`tools/shellcheck.md`](shellcheck.md) — 静的解析。Bats は動的テストなので併用が前提
- [`tools/shfmt.md`](shfmt.md) — `.bats` ファイルもフォーマット可能（`-ln bats` を使う実装は無いので `-ln bash`）

## 参考

- [bats-core Documentation](https://bats-core.readthedocs.io/en/stable/)
- [bats-core on GitHub](https://github.com/bats-core/bats-core)
- [bats-assert](https://github.com/bats-core/bats-assert)
- [bats-file](https://github.com/bats-core/bats-file)
- [bats-mock](https://github.com/grayhemp/bats-mock)
