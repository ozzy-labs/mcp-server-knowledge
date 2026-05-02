---
reviewed: 2026-05-03
---

# chezmoi

複数マシン間で dotfiles を同期する Go 製ツール。bare git / GNU Stow / yadm よりも豊富な機能を持ち、**Go テンプレート / 暗号化 / パスワードマネージャ統合 / スクリプト実行**を備える。`~/.local/share/chezmoi` を **source directory** として、そこから `$HOME` 配下にファイルを apply するモデル。新マシンの初期化が 1 コマンドで完了する点が運用上の強み。

公式: [chezmoi.io](https://www.chezmoi.io/)

## インストール

```bash
# 1 行で「インストール + dotfiles 取得 + apply」まで
sh -c "$(curl -fsLS https://get.chezmoi.io)" -- init --apply <github-user>

# 個別インストール
brew install chezmoi
mise use chezmoi
sh -c "$(curl -fsLS https://get.chezmoi.io)"   # ~/bin にバイナリ取得のみ
```

## 動作モデル

```text
[ source dir ]                  [ home dir ]
~/.local/share/chezmoi/   ─→    ~/
  dot_zshrc                       .zshrc
  dot_config/git/config           .config/git/config
  private_dot_ssh/config          .ssh/config (mode 0600)
  encrypted_private_dot_aws/      .aws/ (decrypted)
```

source dir は **通常の git リポジトリ**。リモート（GitHub 等）に push して、別マシンで `chezmoi init <repo>` で取得する。

## ファイル名規約（attribute prefix）

| プレフィックス | 効果 |
|---|---|
| `dot_<name>` | `.<name>` として apply |
| `private_<name>` | パーミッション 0600 |
| `readonly_<name>` | パーミッション 0400 |
| `executable_<name>` | 実行ビット付与 |
| `encrypted_<name>` | age / gpg で暗号化済み（apply 時に復号） |
| `symlink_<name>` | シンボリックリンクとして展開 |
| `run_once_<name>.sh` | 一度だけ実行されるスクリプト |
| `run_onchange_<name>.sh` | 内容変化時に再実行 |
| `run_<name>.sh` | apply のたびに実行 |
| `<name>.tmpl` | Go テンプレートとして処理 |

組み合わせ可: `private_executable_dot_ssh_login.sh.tmpl` → 実行可・0600・テンプレ処理・`~/.ssh_login` に配置。

## 主要コマンド

```bash
chezmoi init <repo>           # source dir を初期化（既存 repo を clone も可）
chezmoi init --apply          # init + apply を一括
chezmoi add ~/.zshrc          # 既存ファイルを source dir に取り込む
chezmoi apply                 # source dir → home に反映
chezmoi diff                  # 変更プレビュー
chezmoi update                # source dir を git pull → apply
chezmoi status                # 差分のあるファイル一覧
chezmoi cd                    # source dir に cd（subshell）
chezmoi managed               # 管理対象ファイル一覧
chezmoi unmanaged             # 管理外の dotfile 候補
chezmoi merge ~/.zshrc        # 3-way merge（変更が衝突したとき）
chezmoi edit ~/.zshrc         # source 側を $EDITOR で開く
chezmoi re-add                # ローカル変更を source dir に取り込む
chezmoi forget ~/.zshrc       # 管理対象から外す
chezmoi destroy ~/.zshrc      # 削除（home 側も消す、慎重に）
```

`chezmoi apply --dry-run -v` で安全に確認できる。

## テンプレート

Go の `text/template` を使う。`.chezmoi.toml.tmpl`（後述）で変数を定義し、各ファイルから参照する。

### マシン別分岐

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

### 組み込み変数（`.chezmoi.*`）

| 変数 | 内容 |
|---|---|
| `.chezmoi.os` | `darwin` / `linux` / `windows` |
| `.chezmoi.arch` | `amd64` / `arm64` 等 |
| `.chezmoi.hostname` | ホスト名 |
| `.chezmoi.username` | ユーザー名 |
| `.chezmoi.homeDir` | `$HOME` |
| `.chezmoi.osRelease.id` | `ubuntu` / `fedora` 等（Linux） |
| `.chezmoi.kernel.osrelease` | カーネル版 |

### ユーザー変数

`~/.config/chezmoi/chezmoi.toml`:

```toml
[data]
role = "work"
email = "alice@example.com"
```

`.chezmoi.toml.tmpl` で対話初期化:

```text
{{- $email := promptStringOnce . "email" "Email" -}}
[data]
email = {{ $email | quote }}
```

`chezmoi init` 時に**プロンプトで値を尋ねて**保存する。複数マシンで共通の dotfiles を保ちつつ、マシンごとの値（メール・名前・トークン）だけ分離できる。

## 暗号化

```bash
# age を使う
chezmoi init --apply --encryption=age
# ~/.config/chezmoi/chezmoi.toml に key パスが記録される

# 機密ファイルを追加
chezmoi add --encrypt ~/.aws/credentials
# → encrypted_private_dot_aws/credentials.age として source dir に保存
```

age（推奨）または gpg をサポート。鍵自体は **source dir 外**に置く（OS のキーストアや 1Password 等）。

## パスワードマネージャ統合

テンプレートから直接シークレットを取れる:

```text
{{- $token := bitwarden "item" "GitHub" -}}
{{- /* 1Password */ -}}
{{- $token := onepassword "GitHub Token" -}}
```

サポート: 1Password / Bitwarden / LastPass / pass / KeePassXC / Vault / Doppler 他多数。

## スクリプト実行

```bash
# run_onchange_install-packages.sh
#!/usr/bin/env bash
brew bundle --file=~/Brewfile

# run_once_setup-shell.sh
#!/usr/bin/env bash
chsh -s $(which zsh)
```

`run_onchange_*` はファイル内容のハッシュが変わった時のみ再実行。Brewfile 更新時のパッケージ自動同期に使う定石。

## 新マシン bootstrap

リモート repo を `<github-user>/dotfiles` という命名にしておくと:

```bash
sh -c "$(curl -fsLS https://get.chezmoi.io)" -- init --apply <github-user>
```

の 1 コマンドで `chezmoi binary 取得 → repo clone → apply` が完了。OS / 役割の分岐はテンプレが担当。

## bare git / Stow / yadm との比較

| 観点 | chezmoi | bare git | GNU Stow | yadm |
|---|---|---|---|---|
| 設置 | `chezmoi apply` でコピー | git checkout | symlink | git checkout |
| マシン差分 | テンプレ + 変数 | branch / submodule で工夫 | host-specific package | template + alt files |
| 暗号化 | age / gpg 内蔵 | git-crypt 別途 | なし | gpg / git-crypt |
| パスワードマネージャ | ネイティブ統合 | なし | なし | なし |
| スクリプト | run_once / run_onchange | フック自作 | なし | bootstrap script |
| 学習曲線 | 中（Go テンプレ） | 低 | 低 | 中 |
| 元ファイル変更 | source dir のみ | 直接編集 | 直接編集 | 直接編集 |

シンプルさを最優先するなら bare git / Stow、機密情報やマシン差分が多いなら chezmoi が抜群に強い。

## AI エージェントがよくやるミス

1. **`~/.zshrc` を直接編集する** — chezmoi 管理下では source dir 側を編集する。`chezmoi edit ~/.zshrc` か `chezmoi cd` で source へ
2. **`chezmoi apply` 前に `chezmoi diff` を見ない** — 既存ファイルが上書きされる可能性。最初は dry-run で確認
3. **`run_once_*` を編集して再実行を期待** — `run_once_*` は**実行記録がローカル状態に残る**ので、内容変えても再実行されない。`run_onchange_*` を使う
4. **暗号鍵を source dir にコミット** — age/gpg の秘密鍵は **絶対に repo に入れない**。OS のキーストア管理
5. **ローカル変更を `chezmoi re-add` し忘れて apply で消える** — apply は source dir → home の片方向。ローカル変更は `re-add` で source 側に取り込む
6. **テンプレでクオートを忘れる** — `{{ .data.token }}` は文字列を裸で出す。YAML / JSON では `{{ .data.token | quote }}` が安全
7. **`.chezmoiignore` で home 側のパスを書く** — このファイルは **source dir のパス**で書く。`dot_zshrc` のように attribute prefix 付きで指定する場合がある

## 関連

- [`languages/bash.md`](../languages/bash.md) — `run_*` スクリプトの基礎
- [`tools/mise.md`](mise.md) — マシンごとの開発ツール install を mise 側に寄せると chezmoi が薄くなる

## 参考

- [chezmoi Documentation](https://www.chezmoi.io/)
- [chezmoi on GitHub](https://github.com/twpayne/chezmoi)
- [How-To Guides](https://www.chezmoi.io/user-guide/command-overview/)
