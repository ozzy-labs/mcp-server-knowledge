---
reviewed: 2026-05-04
tags: [data-cli, json, fast]
---

# jq

A command-line filter for processing JSON. The JSON equivalent of `grep` / `sed` / `awk`. Essential for formatting API responses, extracting values from config files, and pulling values in CI scripts. A single binary written in C.

Official: [jqlang.org](https://jqlang.org/) / [manual](https://jqlang.org/manual/)

The latest version is **1.8.1** (2025-07-01). 1.8.0 (2025-06-01) brought a major update: new functions like `trim/0`, several security fixes, and some breaking changes (e.g. `indices/1` / `index/1` / `rindex/1` switched to code-point-based indexing).

## Installation

```bash
# Homebrew
brew install jq

# apt
sudo apt install jq

# mise
mise use aqua:jqlang/jq@latest

# Windows
winget install jqlang.jq
```

## Basic usage

```bash
# Pretty print
echo '{"a":1,"b":2}' | jq
# → {
#     "a": 1,
#     "b": 2
#   }

# Extract a single field
echo '{"name":"alice","age":30}' | jq '.name'
# → "alice"

# Extract as a string (no quotes)
echo '{"name":"alice"}' | jq -r '.name'
# → alice
```

## Filter syntax basics

| Filter | Meaning |
|---|---|
| `.` | The whole input |
| `.foo` | Field `foo` |
| `.foo.bar` | Nesting |
| `.[0]` | Index 0 of an array |
| `.[0:3]` | Slice |
| `.[]` | Expand an array (pipe each element) |
| `.foo // "default"` | Fallback if the value is null |
| `.foo?` | Turn errors into null (optional access) |
| `length` | Length |
| `keys` / `values` | Object keys / values |
| `map(f)` | Apply `f` to each array element |
| `select(cond)` | Filter by condition |
| `sort` / `sort_by(.x)` | Sort |
| `group_by(.x)` | Grouping |
| `unique` / `unique_by(.x)` | Deduplicate |
| `min` / `max` / `min_by(.x)` | Min / max |
| `add` | Combine array elements (sum for numbers, concatenation for strings) |

## Typical pipelines

```bash
# Extract only name from an array
echo '[{"name":"a"},{"name":"b"}]' | jq -r '.[].name'

# Same, using map
echo '[{"name":"a"},{"name":"b"}]' | jq -r 'map(.name) | .[]'

# Rebuild an object
echo '{"a":1,"b":2,"c":3}' | jq '{x: .a, y: .b}'

# Filter by condition
echo '[{"n":1},{"n":5},{"n":3}]' | jq '.[] | select(.n > 2)'

# Aggregation
echo '[{"type":"a","v":10},{"type":"b","v":20},{"type":"a","v":30}]' \
  | jq 'group_by(.type) | map({type: .[0].type, sum: map(.v) | add})'
```

## Common examples

### Combining with the gh CLI

```bash
# List titles of open PRs
gh pr list --json number,title --jq '.[] | "\(.number) \(.title)"'

# Count PRs with an incomplete review
gh pr list --json reviewDecision \
  | jq '[.[] | select(.reviewDecision != "APPROVED")] | length'

# Issues with a given label, as CSV
gh issue list --label bug --json number,title \
  | jq -r '.[] | [.number, .title] | @csv'
```

### List dependencies from package.json

```bash
jq -r '.dependencies | keys[]' package.json
```

### Env var substitution + file update

```bash
jq '.version = "1.2.3"' package.json > tmp.json && mv tmp.json package.json
```

### Joining and flattening arrays

```bash
echo '[[1,2],[3,4]]' | jq 'add'                  # → [1,2,3,4]
echo '[1,[2,[3]]]' | jq '[.. | numbers]'          # → [1,2,3]
```

## String manipulation

```bash
echo '"hello"' | jq 'length'             # → 5
echo '"hello"' | jq 'ascii_upcase'       # → "HELLO"
echo '"a,b,c"' | jq 'split(",")'         # → ["a","b","c"]
echo '["a","b"]' | jq 'join("-")'        # → "a-b"
echo '"  x  "' | jq 'trim'                            # → "x" (jq 1.8+)
echo '"  x  "' | jq 'ltrimstr(" ") | rtrimstr(" ")'   # older-style approach
```

## Format conversion

```bash
# CSV output
echo '[{"a":1,"b":2},{"a":3,"b":4}]' | jq -r '.[] | [.a, .b] | @csv'

# TSV
echo '[{"a":1,"b":2}]' | jq -r '.[] | [.a, .b] | @tsv'

# Raw string (quotes removed, escapes resolved)
echo '"hello\nworld"' | jq -r '.'

# URL encode
echo '"hello world"' | jq -r '@uri'

# base64
echo '"hello"' | jq -r '@base64'
```

## Error handling

```bash
# A missing key does not error: jq '.missing'
# → returns null (with `-e`, exits non-zero)

# optional
echo '{}' | jq '.foo?'                   # → null
echo '{}' | jq 'try .foo catch "err"'    # → null (succeeds since the key doesn't exist)

# -e (exit code)
jq -e '.success' response.json >/dev/null || exit 1
```

## Variables and bindings

```bash
# External variables
echo '{"a":1}' | jq --arg name "alice" '. + {name: $name}'
echo '{"a":1}' | jq --argjson n 42 '.a = $n'

# Internal binding
echo '[1,2,3]' | jq '. as $arr | $arr | length'
```

## Conditionals

```bash
echo '5' | jq 'if . > 3 then "big" else "small" end'

# Pattern-like matching
echo '{"t":"a","v":1}' | jq '
  if .t == "a" then .v * 2
  elif .t == "b" then .v + 10
  else .v
  end
'
```

## Function definitions

```bash
# Inline
echo '5' | jq 'def double: . * 2; double'

# Loading from a file
jq -f script.jq data.json
```

## Relation to Claude Code / MCP

- Used in Claude Code **statusline script** examples to extract `.model.display_name` / `.context_window.used_percentage` (see `ai/agents/claude-code.md`)
- Frequently used to process the output of `gh <cmd> --json ...`
- Also used to format output when debugging MCP servers with `npx @modelcontextprotocol/inspector`

## Troubleshooting

### Forgot `-r` and got quoted output

```bash
# Forgot to add it
echo '{"x":"hello"}' | jq '.x'     # → "hello"
# raw
echo '{"x":"hello"}' | jq -r '.x'  # → hello
```

`-r` is required when capturing into a shell variable.

### Crashes on nested null

```bash
# If any part of .a.b.c is null: Cannot index null with ...
# → add `?`
jq '.a?.b?.c?'
# or use // for a fallback
jq '(.a.b.c) // "default"'
```

### Slow on large data

jq 1.7 / 1.8 include performance improvements (`bsearch/1`, `unique/0`, string repetition, etc.). `--stream` mode also enables incremental processing (for huge JSON):

```bash
jq --stream 'select(.[0][0] == "users") | .[1]' huge.json
```

### Behaves differently on Windows

Single quotes aren't interpreted by Command Prompt. Use PowerShell or WSL, or put the filter in a file with `-f script.jq`.

## Comparison with other tools

| Aspect | jq | yq (mikefarah) | gron |
|---|---|---|---|
| Target | JSON | YAML/JSON/XML | JSON → grep-able form |
| Language | C | Go | Go |
| Speed | Fast | Fast | Fast |
| Learning cost | Medium | jq-compatible | Low |
| File update | Via copy | In-place with `-i` | — |

For YAML, use `yq` (`mikefarah/yq` is the mainstream choice, with jq-compatible syntax). For grep-friendly output, use gron (enumerates JSON in dot notation).
