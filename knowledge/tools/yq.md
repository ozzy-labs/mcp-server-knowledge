---
reviewed: 2026-05-04
tags: [data-cli, yaml, go]
---

# yq

A command-line tool for processing YAML / JSON / TOML / HCL / XML / INI / CSV / TSV / properties. It occupies a "`jq` for YAML" niche, but **there are two implementations with substantially different behavior**. This article covers the de facto standard **Mike Farah version (written in Go, `mikefarah/yq`)**. It extends the knowledge in `tools/jq.md` to YAML.

Official: [mikefarah.gitbook.io/yq](https://mikefarah.gitbook.io/yq) / [mikefarah/yq](https://github.com/mikefarah/yq)

## Beware of the two yq implementations

| Implementation | Language | Characteristics |
|---|---|---|
| **Mike Farah version** | Go | Distributed as a single binary. Supports multiple formats. **The modern standard** |
| kislyuk version | Python | A wrapper around jq. Installed via `pip install yq`. Different syntax and behavior |

Check whether `yq --version` reports `mikefarah/yq`. Old material or scripts written against the kislyuk version won't work with the Mike Farah version.

## Installation

```bash
brew install yq
mise use yq
sudo snap install yq
go install github.com/mikefarah/yq/v4@latest

# Official binary directly
curl -L https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -o /usr/local/bin/yq
chmod +x /usr/local/bin/yq
```

## Basic syntax

```bash
# Read
yq '.spec.replicas' deployment.yaml
yq '.containers[0].image' deployment.yaml
yq '.metadata.labels.app' deployment.yaml

# Chain with pipes
yq '.spec.template.spec | .containers[].name' deployment.yaml

# Array splat
yq '.[]' list.yaml

# Conditional extraction
yq '.[] | select(.status == "active") | .name' list.yaml
```

The same dot notation, pipes, and `select()` as `jq` work here.

## Rewriting (in-place)

```bash
# Assign a value (literal string)
yq -i '.image = "nginx:1.27"' deployment.yaml

# Update via pipe (transform existing value)
yq -i '.replicas |= . + 1' deployment.yaml

# Add a key
yq -i '.metadata.labels.env = "prod"' deployment.yaml

# Delete a key
yq -i 'del(.metadata.annotations)' deployment.yaml
```

**Forgetting `-i` just prints to stdout** without changing the file. `jq` has no in-place feature (it requires going through a temp file), so this is a strength of yq.

## eval and eval-all

| Subcommand | Purpose |
|---|---|
| `eval` / `e` (default) | Processes files one at a time, independently |
| `eval-all` / `ea` | Loads all inputs **simultaneously** and processes them across documents |

```bash
# Merge multiple files (last wins)
yq ea '. as $item ireduce ({}; . * $item)' base.yaml override.yaml

# Shorthand form (most commonly used)
yq ea '.[0] * .[1]' base.yaml override.yaml

# Process all entries in a multi-document YAML (--- separated)
yq ea '.[].name' multi-doc.yaml
```

Using `eval` like `yq '.'` on **multi-document YAML** processes **only the first document**. Use `ea` instead, or output everything with `-s`, or work around it with something like `yq '... | ...' all-docs.yaml`.

## Output format conversion

```bash
yq -o=json '.' config.yaml         # YAML → JSON
yq -o=yaml '.' config.json         # JSON → YAML (jq alternative)
yq -o=toml '.' config.yaml         # TOML (bidirectional support from v4.52+)
yq -o=props '.' config.yaml        # Java properties
yq -o=xml '.' config.yaml          # XML
yq -o=csv '.[]' list.yaml          # CSV (arrays only)
yq -o=tsv '.[]' list.yaml          # TSV
yq -p=toml -o=yaml '.' config.toml # TOML → YAML
yq -p=xml -o=yaml '.' config.xml   # XML → YAML (specify input with -p)
```

`-p` switches the input format, `-o` the output format. Chaining `--output-format json | jq` inside bash scripts is a standard pattern.

## Injecting environment variables

```bash
export IMAGE=nginx:1.27
yq -i '.image = strenv(IMAGE)' deployment.yaml

# When you want to preserve numbers or booleans
export REPLICAS=3
yq -i '.replicas = env(REPLICAS)' deployment.yaml
```

| Function | Return value |
|---|---|
| `strenv(VAR)` | As a string |
| `env(VAR)` | With type inference (numbers / bools are converted) |

Writing secrets directly as arguments leaves them in shell history, so always go through env variables.

## Merge operations

```bash
# Shallow merge (last wins)
yq ea '.[0] * .[1]' base.yaml override.yaml

# Deep merge
yq ea '.[0] *d .[1]' base.yaml override.yaml

# Concatenate arrays (default is to overwrite)
yq ea '.[0] *+ .[1]' base.yaml override.yaml
```

`*` modifiers:

| Symbol | Effect |
|---|---|
| `*` | Shallow merge |
| `*d` | Recursive (deep) merge |
| `*+` | Append arrays |
| `*?` | Do nothing on conflict |
| `*n` | Exclude nulls from being overwritten |

## Handling multi-document YAML

```bash
# Process k8s manifests one at a time
yq ea '.[] | select(.kind == "Deployment")' all.yaml

# Extract into separate files
yq -s '.kind + "-" + .metadata.name' all.yaml
# → generates Deployment-web.yml / Service-api.yml ...
```

The argument to `-s` is a template for the output filename (the extension is added automatically).

## Typical CI usage

```bash
# Lightweight rewrite without needing kustomize
yq -i '.image.tag = strenv(IMAGE_TAG)' values.yaml
helm upgrade --install api ./chart -f values.yaml

# Rewrite the image across all k8s manifests
yq -i 'select(.kind == "Deployment") | .spec.template.spec.containers[].image |= sub("^old-registry/"; "new-registry/")' all.yaml
```

## Common mistakes AI agents make

1. **Expecting kislyuk-version syntax** — syntax like `yq -y .` that assumes a jq wrapper doesn't work with the Mike Farah version. Check the implementation with `yq --version`
2. **Forgetting `-i` and only getting stdout output** — you think you rewrote the file, but nothing changed
3. **Processing multi-document files with `eval`** — for all entries separated by `---`, use `eval-all` (`ea`)
4. **Differences in boolean / null representation** — the old YAML 1.1 trap where `true` / `yes` / `y` / `on` are all treated as boolean true. Use `!!str` to force a string
5. **Comments disappearing** — yq tries to preserve comment positions, but they can get detached when the structure changes. Manage important comments in a separate file
6. **Confusing `strenv` and `env`** — use `env()` when you want conversion to a number or boolean, and `strenv()` when you want it inserted as a string
7. **Quoting in PowerShell** — single quotes like `'.foo.bar'` don't work, so use a `--quote='..'` pattern, or go through bash
8. **Out-of-range access on array `[]`** — `yq '.list[10]'` returns null (it does not error). Combine with `select` for conditional access

## Related

- [`tools/jq.md`](jq.md) — a similarly-minded tool for JSON; piping yq output into jq is a common pattern
- [`tools/yamlfmt.md`](yamlfmt.md) — formatting
- [`tools/yamllint.md`](yamllint.md) — static validation

## References

- [yq Documentation (Mike Farah)](https://mikefarah.gitbook.io/yq)
- [mikefarah/yq (GitHub)](https://github.com/mikefarah/yq)
- [Operators Reference](https://mikefarah.gitbook.io/yq/operators)
