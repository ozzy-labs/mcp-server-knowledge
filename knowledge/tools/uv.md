---
reviewed: 2026-05-03
tags: [package, version-manager, python, rust, fast]
---

# uv

Astral 製の Python パッケージ・プロジェクトマネージャ。Rust で書かれており、`pip` / `pip-tools` / `pipx` / `poetry` / `pyenv` / `twine` / `virtualenv` を 1 つに統合する。`pip` 比 10-100 倍速をうたう。Python 自体のインストールから依存解決、CLI ツール管理、ビルド・publish まで担う。`languages/python.md` の依存・バージョン管理項を実務レベルで補完する。

公式: [docs.astral.sh/uv](https://docs.astral.sh/uv/)

## インストール

```bash
# 公式スクリプト（推奨。Python 不要、Rust 不要）
curl -LsSf https://astral.sh/uv/install.sh | sh

# Homebrew
brew install uv

# mise
mise use uv

# pipx（隔離）
pipx install uv

# WinGet
winget install --id=astral-sh.uv -e

# Docker
docker run ghcr.io/astral-sh/uv
```

アップデートはスタンドアロン版なら `uv self update`、Homebrew なら `brew upgrade uv`。

## 何を置き換えるか

| 旧ツール | 役割 | uv での代替 |
|---|---|---|
| `pip` | パッケージインストール | `uv pip install` または `uv add` |
| `pip-tools` | requirements ロック | `uv lock` / `uv sync` |
| `virtualenv` / `venv` | 仮想環境作成 | `uv venv` |
| `pyenv` | Python バージョン管理 | `uv python install` |
| `pipx` | CLI ツールインストール | `uv tool install` / `uvx` |
| `poetry` | プロジェクト + lock + publish | `uv init` / `uv add` / `uv build` / `uv publish` |
| `twine` | publish | `uv publish` |

## プロジェクト管理（推奨フロー）

```bash
uv init my-app          # pyproject.toml + .python-version + src/ を生成
cd my-app
uv add httpx            # 依存追加 → uv.lock 更新 → .venv 同期
uv add --dev pytest     # 開発依存
uv remove httpx
uv sync                 # uv.lock を読んで .venv を一致させる（CI / 別マシンで）
uv lock                 # 依存解決して uv.lock を更新（インストールはしない）
uv run pytest           # プロジェクト環境でコマンド実行（自動同期付き）
uv tree                 # 依存ツリー表示
```

`uv add` は `pyproject.toml` の `[project]` を更新し、`uv.lock` を再生成し、`.venv` を同期する 3 段を一気にこなす。`pyproject.toml` を手で編集した場合は `uv sync` で追従する。

### `pyproject.toml` の uv 関連セクション

```toml
[project]
name = "my-app"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["httpx>=0.27"]

[dependency-groups]
dev = ["pytest>=8", "ruff"]

[tool.uv]
dev-dependencies = []   # legacy。dependency-groups.dev に移行推奨

[tool.uv.workspace]
members = ["packages/*"]
```

`[dependency-groups]` は PEP 735 の標準。`uv add --group test pytest` のように増やせる。

## CLI ツール（pipx 代替）

```bash
uv tool install ruff          # 永続インストール（PATH に登録）
uv tool list
uv tool upgrade ruff
uv tool uninstall ruff

uvx ruff check .              # 一時実行（uv tool run の alias）
uvx --from "rich[jupyter]" python    # extras 指定
```

`uvx` は引数解決が速いので、CI で「lint だけ走らせる」「フォーマッタを 1 回だけ動かす」用途に最適。グローバル汚染を避けながら、`pip install` のキャッシュも共有する。

## Python バージョン管理（pyenv 代替）

```bash
uv python install 3.12 3.13     # 複数バージョン一括
uv python list                  # インストール済み + 利用可能
uv python pin 3.13              # .python-version に書き込む
uv python dir                   # インストール先（uninstall 時に使う）
```

プロジェクトに `.python-version` があれば `uv run` / `uv sync` が自動でそれに合わせる。`requires-python` と整合しないと弾かれる。

## スクリプト実行（PEP 723）

ファイル先頭にメタデータを書けば、依存付きスクリプトが**ワンファイル**で動く:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx", "rich"]
# ///

import httpx
from rich import print
print(httpx.get("https://example.com"))
```

```bash
uv run script.py        # 依存を解決して隔離環境で実行
```

`uv add --script script.py httpx` でメタデータを更新できる。`requirements.txt` を作らずに 1 ファイルで完結する用途に強い。

## ワークスペース（monorepo）

```toml
# ルート pyproject.toml
[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/legacy"]
```

各 member は独立した `pyproject.toml` を持ち、ルートで `uv sync` / `uv run` するとすべての member の依存が解決される。member 間の依存は `workspace = true` で表現:

```toml
[project]
dependencies = ["my-core"]

[tool.uv.sources]
my-core = { workspace = true }
```

## キャッシュとロックファイル

- グローバルキャッシュ: `~/.cache/uv/`（macOS/Linux）/ `%LocalAppData%\uv\cache`（Windows）
- `uv cache clean` で削除可
- `uv.lock` は **必ずコミットする**。OS / アーキ横断の universal lockfile（`requirements.txt` と違い、複数プラットフォームを 1 ファイルでカバー）

## CI でのパターン

```yaml
- uses: actions/checkout@v6
- uses: astral-sh/setup-uv@v5
  with:
    enable-cache: true
- run: uv sync --frozen        # uv.lock を更新せず厳密一致
- run: uv run pytest
```

`--frozen` は CI 必須（lockfile を更新させない）。`--no-sync` はインストールスキップ。

## ビルドと publish

```bash
uv build                         # sdist + wheel を dist/ に生成
uv publish --token $PYPI_TOKEN   # PyPI へ
uv publish --trusted-publishing automatic   # Trusted Publishers (OIDC)
```

PyPI も Trusted Publishers (OIDC) に対応しており、`UV_PUBLISH_TOKEN` を持たずに GitHub Actions から publish できる。

## AI エージェントがよくやるミス

1. **`pip install` を実行してしまう** — uv プロジェクトでは `uv add` を使う。`pip` を直接呼ぶと `pyproject.toml` / `uv.lock` から外れる
2. **`uv sync --frozen` を CI で忘れる** — lockfile を更新する `uv sync`（既定）と区別する。CI で `uv.lock` が書き換わると差分検出 / レビューが乱れる
3. **`requirements.txt` を併用してしまう** — `uv export` で生成は可能だが、ソース・オブ・トゥルースは `pyproject.toml` + `uv.lock`
4. **`activate` を呼んでから `python` を直接実行** — `.venv` を activate せずに `uv run` を使うのが uv 流。複数 Python バージョンが混在しても安全
5. **`uv tool install` と `uvx` を混同** — install は永続、`uvx` は一時。CI の lint / format は `uvx` で十分
6. **`requires-python` と `.python-version` の不一致** — `uv run` 時にエラーになる。`uv python pin` で揃える
7. **monorepo で member ごとに `uv sync` を回す** — ルートで 1 回でよい。重複インストールが起きる

## 関連

- [`languages/python.md`](../languages/python.md) — 言語側の前提
- [`tools/mise.md`](mise.md) — mise から `mise use uv` で導入する場合
- [`tools/pnpm.md`](pnpm.md) — Node.js 側の対応物（思想が似ている）

## 参考

- [uv Documentation](https://docs.astral.sh/uv/)
- [uv on GitHub](https://github.com/astral-sh/uv)
- [PEP 723 — inline script metadata](https://peps.python.org/pep-0723/)
- [PEP 735 — dependency groups](https://peps.python.org/pep-0735/)
