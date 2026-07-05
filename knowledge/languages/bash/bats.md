---
reviewed: 2026-05-04
tags: [test, bash]
---

# bats (bats-core)

A TAP-compliant test framework that runs on Bash 3.2+. You write `@test` blocks inside `.bats` files, run commands with `run`, and assert on exit codes and output. If an AI agent is writing shell scripts, this is the only practical way to catch **behavioral regressions** that `shellcheck` can't. Used together with `languages/bash.md`.

Official: [bats-core.readthedocs.io](https://bats-core.readthedocs.io/en/stable/) / [bats-core/bats-core](https://github.com/bats-core/bats-core)

## Installation

```bash
# npm
npm install -g bats

# Homebrew
brew install bats-core

# mise
mise use bats

# git submodule (to pin inside the repo)
git submodule add https://github.com/bats-core/bats-core.git test/bats
git submodule add https://github.com/bats-core/bats-support.git test/test_helper/bats-support
git submodule add https://github.com/bats-core/bats-assert.git test/test_helper/bats-assert
```

Standard practice is to install the helper libraries (below) at the same time.

## Minimal example

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
bats tests/hello.bats           # single file
bats -r tests/                  # recursive
bats --tap tests/               # TAP output (for CI integration)
bats -j 4 tests/                # 4-way parallel
bats --filter 'echo' tests/     # filter by name pattern
```

## `run` and special variables

Running via `run <command>` automatically sets the following variables:

| Variable | Content |
|---|---|
| `$status` | Exit code |
| `$output` | Combined stdout + stderr (merged by default) |
| `$stderr` | stderr only (with `run --separate-stderr`) |
| `$lines[]` | `$output` split into an array by line |
| `$stderr_lines[]` | `$stderr` split into a line array |

```bash
@test "ls reports files" {
  run ls /tmp
  [ "$status" -eq 0 ]
  [ "${#lines[@]}" -gt 0 ]
}
```

Adding `set -e` etc. before `run` can cause unintended aborts, so as a rule don't use it inside Bats.

For commands involving pipes, `run` alone only captures the exit code of the last command, so route it through `bats_pipe` (v1.10+):

```bash
@test "grep finds match" {
  run bats_pipe echo "hello world" \| grep -o world
  [ "$status" -eq 0 ]
  [ "$output" = "world" ]
}
```

## Key hooks

| Hook | Timing |
|---|---|
| `setup` | **Before each `@test`** (within the same file) |
| `teardown` | After each `@test` (whether it passes or fails) |
| `setup_file` | Once at the start of the file |
| `teardown_file` | Once at the end of the file |
| `setup_suite` | Once for the whole suite (placed separately in `setup_suite.bash`) |
| `teardown_suite` | Once at the end of the suite |
| `bats::on_failure` | On test or `setup*` failure (v1.12+) |

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

`setup_suite` alone has special naming: it must be written in a **dedicated file** called `tests/setup_suite.bash` (a same-named function written inside a `.bats` file will not be called).

## Version requirements and dynamic test registration

```bash
# Require a minimum version at the top of the file (v1.7+)
bats_require_minimum_version 1.13.0

# Load system-wide shared libraries (looks at BATS_LIB_PATH)
bats_load_library bats-support
bats_load_library bats-assert

# Dynamic test registration (v1.11+) — for generating tests in a loop
for case in alpha beta gamma; do
  bats_test_function --description "handles $case" -- run_case "$case"
done

run_case() {
  run my-cli "$1"
  [ "$status" -eq 0 ]
}
```

## Helper libraries

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

| Library | Purpose |
|---|---|
| `bats-support` | Foundation for other helpers (shared error output, etc.) |
| `bats-assert` | `assert_success` / `assert_failure` / `assert_output` / `assert_line` / `refute_*` |
| `bats-file` | `assert_file_exists` / `assert_file_not_executable` / `assert_dir_exists` |
| `bats-mock` | Mocking commands |

Error messages are dramatically friendlier than plain `[ ... ]` (diff-style output on failure).

## `skip` and `bats run` tags

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

Tag feature (v1.10+):

```bash
# bats file:tag test name
@test "needs network" {
  # bats test_tags=network,slow
  ...
}
```

```bash
bats --filter-tags 'network' tests/      # only the network tag
bats --filter-tags '!slow' tests/        # exclude slow
bats --negative-filter 'integration' .   # exclude by name match (v1.13+)
```

If any test carries the `bats:focus` tag (v1.9+), only that test runs (to prevent it from being accidentally left in CI, the exit code is 1 while a focus tag remains):

```bash
# bats test_tags=bats:focus
@test "only this one" { ... }
```

## Parallel execution and isolation

```bash
bats -j 4 tests/
bats --abort tests/   # stop on first failure (v1.13+)
```

`setup_file` / `teardown_file` are prone to collisions under parallel execution, so use `BATS_RUN_TMPDIR` or `BATS_FILE_TMPDIR` to isolate per file.

| Variable | Content |
|---|---|
| `BATS_TEST_TMPDIR` | Per-test tmpdir |
| `BATS_FILE_TMPDIR` | Per-file tmpdir |
| `BATS_SUITE_TMPDIR` | Per-suite tmpdir |
| `BATS_TEST_NAME` | Name of the running test |
| `BATS_TEST_FILENAME` | Path of the test file |

These are automatically deleted on exit (use `--no-tempdir-cleanup` to keep them).

## CI integration

```yaml
- uses: actions/checkout@v6
- run: |
    sudo apt-get install -y bats
    bats --tap -r tests/
```

Feeding `--tap` into a reporter like `mocha-tap` can convert it to JUnit XML. On GitHub Actions you can also use the official `bats-action`.

## Example: testing a CLI tool

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

## Common mistakes AI agents make

1. **Running a command directly without `run`** — a direct run fails the test immediately on a nonzero exit code. Avoid this by capturing with `run` and asserting afterward
2. **Putting `set -e` in `setup`** — this interacts badly with `run`'s behavior and increases false detections. Don't use `set -e` inside Bats
3. **Trying to equality-compare `$output` when it contains embedded newlines** — use `assert_output --partial` or `[[ "$output" == *"foo"* ]]`
4. **Writing `setup_suite` inside a `.bats` file so it never gets called** — it must live in the dedicated file `tests/setup_suite.bash`
5. **Expecting variable expansion in test names** — `@test "$VAR"` is not expanded (literal string only)
6. **Hardcoding `BATS_TMPDIR` under parallel execution** — use `BATS_TEST_TMPDIR` / `BATS_FILE_TMPDIR` when running in parallel
7. **`assert_*` doesn't work** — forgot `load test_helper`, or forgot to fetch the submodules
8. **Using Bash-4-only syntax and it breaks on 3.2** — Bats supports Bash 3.2+. Things like `mapfile` / `${var^^}` don't work on 3.2

## Related

- [`languages/bash/bash.md`](bash.md) — the language under test
- [`languages/bash/shellcheck.md`](shellcheck.md) — static analysis. Bats does dynamic testing, so using both together is assumed
- [`languages/bash/shfmt.md`](shfmt.md) — `.bats` files can also be formatted (there's no implementation with `-ln bats`, so use `-ln bash`)

## References

- [bats-core Documentation](https://bats-core.readthedocs.io/en/stable/)
- [bats-core on GitHub](https://github.com/bats-core/bats-core)
- [bats-assert](https://github.com/bats-core/bats-assert)
- [bats-file](https://github.com/bats-core/bats-file)
- [bats-mock](https://github.com/grayhemp/bats-mock)
