---
reviewed: 2026-05-10
tags: [standards, infrastructure]
---

# ソフトウェア配信・配布方法

ツールやアプリケーションをユーザーの環境へ届けるための主要な手法。OS レベル、言語ランタイムレベル、直接配布の 3 階層に大別される。

公式ドキュメントやリポジトリの README では、これらが複数併記されることが多い（例: `brew`, `npm`, `curl | sh` のすべてを提供）。

## OS パッケージマネージャー (System level)

OS のファイルシステム全体を管理し、依存関係を解決しながらインストールする。システム全体の安定性を重視する場合に最適。

### 代表的な OS 向けツール

| ツール | 対象 OS | 特徴 |
|---|---|---|
| `apt` | Debian / Ubuntu | Linux の標準。`/usr/bin` 等に配置。原則 root 権限が必要。 |
| `Homebrew` | macOS / Linux | ユーザーディレクトリ配下（`/opt/homebrew` 等）に配置。Mac 開発のデファクト。 |
| `WinGet` | Windows | Microsoft 公式。GitHub やストアからバイナリを取得・管理する。 |
| `apk` / `dnf` | Alpine / Fedora | 各ディストリビューション固有。コンテナ内では `apk` が多用される。 |

## 言語別パッケージマネージャー (Runtime level)

特定のプログラミング言語のエコシステムに特化した配布方法。開発ツール（CLI）の配布に多用され、その言語のランタイムが必要。

### 言語別の主要ツール

| ツール | 言語 | 特徴 |
|---|---|---|
| `npm` / `pnpm` | JavaScript | `npm install -g` でグローバル配置。`npx` で一時実行が可能。 |
| `uv` | Python | `uv tool install`（pipx 互換）でツールごとに孤立した環境を作成する。 |
| `go install` | Go | ソースを取得し、ローカルでビルドして `GOBIN` に配置する。高速。 |
| `cargo install` | Rust | ソースからビルドするためインストールに時間がかかるが、最適化される。 |

## 直接配布 (Direct distribution)

パッケージマネージャーを介さず、ビルド済みバイナリやスクリプトを直接提供する。

### 手法

- **GitHub Releases**: 特定 OS / アーキテクチャ向けにビルド済みバイナリ（`.deb`, `.rpm`, `.zip`, `.tar.gz`）を配布。CI での利用に適している。
- **Installer Scripts**: `curl -fsSL https://... | sh` 形式。依存関係が少なく即座に導入できるが、パイプライン実行のセキュリティリスクに注意。
- **Mise (aqua)**: バイナリ配布を抽象化して管理するツール。`mise use aqua:cli/cli` のように宣言的にバージョンを固定できる。

## 選定基準

| 観点 | 推奨手法 | 理由 |
|---|---|---|
| **一般ユーザー (Non-dev)** | OS パッケージマネージャー | OS の更新サイクルに乗れ、管理が容易なため。 |
| **Node.js 開発者** | `npm` / `pnpm` | 既に環境があり、導入障壁が低いため。 |
| **Rust ツール** | `cargo install` / 直接バイナリ | [`ripgrep`](../tools/ripgrep.md) や `fd` など。単一バイナリで配布されることが多い。 |
| **Python ツール** | `uv` / `pipx` | グローバルな Python 環境の汚染（競合）を避けるため。 |
| **CI / 自動化環境** | 直接バイナリ / `mise` | インストール速度、再現性、権限管理のしやすさが重要。 |

## AI エージェントがよくやるミス

1. **`sudo` の不適切な使用** — `npm install -g` や `brew install` で不要な `sudo` を付けて権限エラーを誘発する。
2. **システム環境の破壊** — Python ツールを `pip install` でシステム Python に直接入れ、OS 管理のパッケージと衝突させる。
3. **アーキテクチャの誤認** — バイナリを `curl` で落とす際、`x86_64` と `arm64`（Apple Silicon 等）を判別せずに固定 URL を使う。
4. **環境変数の反映漏れ** — インストール後に `~/.local/bin` や `~/go/bin` にパスを通す必要があるが、それを考慮せずに実行を試みる。

## 参考

- [Homebrew Documentation](https://docs.brew.sh/)
- [npm Docs: Downloading and installing packages globally](https://docs.npmjs.com/downloading-and-installing-packages-globally)
- [uv: Installing tools](https://docs.astral.sh/uv/guides/tools/)
- [GitHub CLI: Installation](https://cli.github.com/manual/)
