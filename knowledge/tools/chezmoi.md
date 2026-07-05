---
reviewed: 2026-05-04
tags: [go]
---

# chezmoi

A Go-based tool for synchronizing dotfiles across multiple machines. It has richer features than bare git / GNU Stow / yadm, with **Go templates / encryption / password manager integration / script execution**. Its model uses `~/.local/share/chezmoi` as the **source directory**, from which files are applied to `$HOME`. The operational strength is that bootstrapping a new machine completes in a single command.

Official: [chezmoi.io](https://www.chezmoi.io/)

## Installation

```bash
# One line: "install + fetch dotfiles + apply"
sh -c "$(curl -fsLS https://get.chezmoi.io)" -- init --apply <github-user>

# Individual install
brew install chezmoi
mise use chezmoi
sh -c "$(curl -fsLS https://get.chezmoi.io)"   # fetch binary to ~/bin only
```

## Operating model

```text
[ source dir ]                  [ home dir ]
~/.local/share/chezmoi/   ─→    ~/
  dot_zshrc                       .zshrc
  dot_config/git/config           .config/git/config
  private_dot_ssh/config          .ssh/config (mode 0600)
  encrypted_private_dot_aws/      .aws/ (decrypted)
```

The source dir is a **normal git repository**. Push it to a remote (e.g. GitHub), then fetch it on another machine with `chezmoi init <repo>`.

## Filename convention (attribute prefixes)

| Prefix | Effect |
|---|---|
| `dot_<name>` | Applied as `.<name>` |
| `private_<name>` | Permission 0600 |
| `readonly_<name>` | Permission 0400 |
| `executable_<name>` | Grants executable bit |
| `encrypted_<name>` | Already encrypted with age / gpg (decrypted on apply) |
| `symlink_<name>` | Expanded as a symlink |
| `run_once_<name>.sh` | Script that runs only once |
| `run_onchange_<name>.sh` | Re-runs when content changes |
| `run_<name>.sh` | Runs on every apply |
| `<name>.tmpl` | Processed as a Go template |

Can be combined: `private_executable_dot_ssh_login.sh.tmpl` → executable, 0600, template-processed, placed at `~/.ssh_login`.

## Key commands

```bash
chezmoi init <repo>           # initialize source dir (can also clone an existing repo)
chezmoi init --apply          # init + apply in one step
chezmoi add ~/.zshrc          # bring an existing file into the source dir
chezmoi apply                 # apply source dir → home
chezmoi diff                  # preview changes
chezmoi update                # git pull the source dir → apply
chezmoi status                # list files with differences
chezmoi cd                    # cd into source dir (subshell)
chezmoi managed               # list managed files
chezmoi unmanaged             # list unmanaged dotfile candidates
chezmoi merge ~/.zshrc        # 3-way merge (when changes conflict)
chezmoi edit ~/.zshrc         # open the source-side file in $EDITOR
chezmoi re-add                # pull local changes into the source dir
chezmoi forget ~/.zshrc       # remove from managed set
chezmoi destroy ~/.zshrc      # delete (removes the home-side file too, use with care)
```

`chezmoi apply --dry-run -v` lets you check safely.

## Templates

Uses Go's `text/template`. Define variables in `.chezmoi.toml.tmpl` (described below) and reference them from each file.

### Per-machine branching

```bash
# dot_zshrc.tmpl
{{ if eq .chezmoi.os "darwin" }}
export PATH="/opt/homebrew/bin:$PATH"
{{ else if eq .chezmoi.os "linux" }}
export PATH="$HOME/.local/bin:$PATH"
{{ end }}

{{ if eq .role "work" }}
source ~/.config/zsh/work.zsh
{{ end }}
```

### Built-in variables (`.chezmoi.*`)

| Variable | Content |
|---|---|
| `.chezmoi.os` | `darwin` / `linux` / `windows` |
| `.chezmoi.arch` | `amd64` / `arm64` etc. |
| `.chezmoi.hostname` | Hostname |
| `.chezmoi.username` | Username |
| `.chezmoi.homeDir` | `$HOME` |
| `.chezmoi.osRelease.id` | `ubuntu` / `fedora` etc. (Linux) |
| `.chezmoi.kernel.osrelease` | Kernel version |

### User variables

`~/.config/chezmoi/chezmoi.toml`:

```toml
[data]
role = "work"
email = "alice@example.com"
```

Interactive initialization via `.chezmoi.toml.tmpl`:

```text
{{- $email := promptStringOnce . "email" "Email" -}}
[data]
email = {{ $email | quote }}
```

During `chezmoi init`, values are **prompted for** and saved. This lets you keep common dotfiles across multiple machines while isolating only the per-machine values (email, name, tokens).

## Encryption

```bash
# using age
chezmoi init --apply --encryption=age
# key path is recorded in ~/.config/chezmoi/chezmoi.toml

# add a secret file
chezmoi add --encrypt ~/.aws/credentials
# → saved to the source dir as encrypted_private_dot_aws/credentials.age
```

Supports age (recommended) or gpg. Keep the key itself **outside the source dir** (OS keystore, 1Password, etc.).

## Password manager integration

Secrets can be pulled directly from templates:

```text
{{- $token := bitwarden "item" "GitHub" -}}
{{- /* 1Password */ -}}
{{- $token := onepassword "GitHub Token" -}}
```

Supported: 1Password / Bitwarden / LastPass / pass / KeePassXC / Vault / Doppler, and many more.

## Script execution

```bash
# run_onchange_install-packages.sh
#!/usr/bin/env bash
brew bundle --file=~/Brewfile

# run_once_setup-shell.sh
#!/usr/bin/env bash
chsh -s $(which zsh)
```

`run_onchange_*` only re-runs when the hash of the file's content changes. A standard pattern for auto-syncing packages when the Brewfile is updated.

## Bootstrapping a new machine

If you name the remote repo `<github-user>/dotfiles`:

```bash
sh -c "$(curl -fsLS https://get.chezmoi.io)" -- init --apply <github-user>
```

This single command completes "fetch chezmoi binary → clone repo → apply." OS / role branching is handled by templates.

## Comparison with bare git / Stow / yadm

| Aspect | chezmoi | bare git | GNU Stow | yadm |
|---|---|---|---|---|
| Deployment | copy via `chezmoi apply` | git checkout | symlink | git checkout |
| Per-machine differences | templates + variables | worked around via branch / submodule | host-specific package | template + alt files |
| Encryption | age / gpg built in | git-crypt separately | none | gpg / git-crypt |
| Password manager | native integration | none | none | none |
| Scripts | run_once / run_onchange | custom hooks | none | bootstrap script |
| Learning curve | medium (Go templates) | low | low | medium |
| Editing source files | source dir only | direct edit | direct edit | direct edit |

If simplicity is the top priority, choose bare git / Stow; if you have heavy secrets or many per-machine differences, chezmoi is by far the strongest choice.

## Common mistakes AI agents make

1. **Editing `~/.zshrc` directly** — under chezmoi management, edit the source-dir side instead. Use `chezmoi edit ~/.zshrc` or `chezmoi cd` to reach the source
2. **Not checking `chezmoi diff` before `chezmoi apply`** — existing files may get overwritten. Check with a dry run first
3. **Editing `run_once_*` and expecting it to re-run** — `run_once_*` keeps **its execution record in local state**, so changing the content does not trigger a re-run. Use `run_onchange_*` instead
4. **Committing the encryption key into the source dir** — age/gpg private keys must **never** go into the repo. Manage them via the OS keystore
5. **Forgetting `chezmoi re-add` for local changes, losing them on apply** — apply is one-directional, source dir → home. Local changes must be pulled back into the source with `re-add`
6. **Forgetting to quote in templates** — `{{ .data.token }}` emits the string bare. In YAML / JSON, `{{ .data.token | quote }}` is the safe form
7. **Writing home-side paths in `.chezmoiignore`** — this file must use **source-dir paths**. Sometimes you need to specify them with the attribute prefix, e.g. `dot_zshrc`

## Related

- [`languages/bash/bash.md`](../languages/bash/bash.md) — basics of `run_*` scripts
- [`tools/mise.md`](mise.md) — pushing per-machine dev tool installs to mise keeps chezmoi thinner

## References

- [chezmoi Documentation](https://www.chezmoi.io/)
- [chezmoi on GitHub](https://github.com/twpayne/chezmoi)
- [How-To Guides](https://www.chezmoi.io/user-guide/command-overview/)
