---
reviewed: 2026-04-18
---

# Python

動的型付けスクリプト言語。AI エージェントが最も頻繁に読み書きする言語のひとつで、**依存管理** と **型ヒント** の現状を押さえておけば大半の落とし穴を避けられる。

公式: [docs.python.org](https://docs.python.org/3/) / [uv](https://docs.astral.sh/uv/) / [ruff](https://docs.astral.sh/ruff/)

## バージョンと EOL

| 系列 | リリース | ステータス（2026-04 時点） | EOL |
|---|---|---|---|
| 3.14 | 2025-10 | **Current**（bugfix） | 2030-10 |
| 3.13 | 2024-10 | bugfix | 2029-10 |
| 3.12 | 2023-10 | security-only | 2028-10 |
| 3.11 | 2022-10 | security-only | 2027-10 |
| 3.10 | 2021-10 | security-only | 2026-10 |
| 3.9  | 2020-10 | EOL | 2025-10 |

- 毎年 10 月にメジャーリリース。3.13 以降は **PEP 602 改定**で「フルサポート 2 年 + security-only 3 年 = **計 5 年**」。3.12 以前は「1.5 + 3.5 年」だった。
- 本番は 3.13 または 3.14 を推奨。3.10 は 2026-10 EOL のため移行を計画する。
- Windows は公式インストーラ同梱の **`py` ランチャー**で `py -3.14` / `py -3.13` を切り替えられる。Unix では `python3.14` のように versioned binary を直接呼ぶ。

## インストール / バージョン管理

| ツール | 用途 |
|---|---|
| **uv** (astral.sh, Rust 製) | ランタイム入手 + venv + パッケージ管理 + lockfile + ツール実行の統合。2026 デファクト |
| `mise` | 多言語対応。`mise.toml` で Python バージョン固定（`tools/mise.md`） |
| `pyenv` | shim ベースの古参。Unix で今も健在。Windows は `pyenv-win` |
| 公式 python.org | Windows は `py` launcher 同梱 |
| Docker Hub `python:3.14-slim` | 本番・CI の固定イメージ |

`uv python install 3.14` で Python ランタイム自体を取得できる。`uv` 単体で `pyenv` + `pip` + `virtualenv` + `poetry` + `pipx` をほぼ代替可能。

## 仮想環境

グローバル `site-packages` を汚染しないよう**必ず venv を使う**。Debian 系では PEP 668 により system Python への `pip install` がエラー (`externally-managed-environment`) になる。

```bash
# 標準 (venv モジュール)
python -m venv .venv
source .venv/bin/activate     # POSIX
.venv\Scripts\activate        # Windows

# uv (activate 不要)
uv venv
uv run python script.py
```

## パッケージ管理

2026 時点の推奨フロー:

| ツール | 位置付け |
|---|---|
| **uv** | 新規プロジェクトの第一候補。`uv add`/`uv sync`/`uv lock` |
| **Poetry** | 従来の有力選択肢。既存プロジェクトでの継続利用は可 |
| **Hatch** | PyPA 公式系。ビルド + 環境管理 |
| **pip-tools** | `pip-compile` で `requirements.txt` → lockfile |
| **pipx** / `uv tool` | CLI ツールの分離インストール |

`pip install` 直は lockfile なしで再現性を欠くため、ライブラリ開発以外では非推奨。`requirements.txt` は legacy だが今も有効。lockfile は `uv.lock` / `poetry.lock` が主流。

## pyproject.toml

PEP 621 で `[project]` テーブルが標準化され、ツール非依存のメタデータが定着。

```toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
  "httpx>=0.28",
  "pydantic>=2.10",
]

[project.optional-dependencies]
plot = ["matplotlib>=3.9"]

# PEP 735: dev 依存はビルド成果物に含めない
[dependency-groups]
test = ["pytest>=8", "pytest-asyncio"]
lint = ["ruff>=0.8", "mypy>=1.13"]
dev = [{ include-group = "test" }, { include-group = "lint" }]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
line-length = 100
target-version = "py313"

[tool.pytest.ini_options]
addopts = ["-ra", "--strict-markers"]
testpaths = ["tests"]
```

## 型ヒント

- **PEP 585 (3.9+)**: 組み込みジェネリクス `list[int]` / `dict[str, int]`。`from typing import List` は不要。
- **PEP 604 (3.10+)**: Union の `|` 構文。`X | Y`、`X | None`。
- **PEP 695 (3.12+)**: 型パラメータ新構文。`TypeVar` / `Generic` import 不要。

  ```python
  class Box[T]:
      def __init__(self, value: T) -> None:
          self.value = value

  def first[T](items: list[T]) -> T:
      return items[0]

  type Vec[T] = list[T]
  ```

- **PEP 696 (3.13+)**: `TypeVar` のデフォルト値。
- **PEP 705 (3.13+)**: `TypedDict` の `ReadOnly[...]`。
- **PEP 742 (3.13+)**: `TypeIs[T]` — `TypeGuard` と違い **else 側でも型を絞り込む** 双方向 narrowing。`typing_extensions>=4.10` で 3.12 以下にも提供。
- `from __future__ import annotations`: 全アノテーションを文字列遅延評価にする。3.14 以降は PEP 649/749（deferred evaluation）が入り、このインポートの必要性は下がる方向。

## 型チェッカー

| ツール | 位置付け |
|---|---|
| **mypy** | 公式系のリファレンス実装。`[tool.mypy]`、`strict = true` |
| **pyright** (Microsoft, TS 製) | 高速。VSCode の **Pylance** 拡張が内蔵 |
| **ty** (astral.sh, Rust 製) | 2025-12-16 ベータ公開。1.0 は 2026 中目標（要確認） |
| pyre (Meta) / pytype (Google) | 大規模 codebase 向け / メンテ停滞 |

VSCode なら Pylance が標準。CI では mypy か pyright を `pre-commit` / `lefthook` 経由で回す構成が多い。

## Lint / Format: ruff

**ruff** が 2026 デファクト。`black` + `isort` + `flake8` + `pydocstyle` + `pyupgrade` + `autoflake` を Rust 実装で統合し、数十倍高速。

```bash
ruff check .        # lint
ruff check --fix .  # 自動修正
ruff format .       # format (black 互換)
```

`[tool.ruff.lint]` セクションの `select = ["E", "F", "I", "UP", "B", "SIM"]` のようにルールを選択。black / pylint を個別に使う場面は減っている。

## テスト: pytest

```python
import pytest

@pytest.fixture
def client():
    return Client(base_url="http://localhost")

@pytest.mark.parametrize("a,b,expected", [(1, 2, 3), (0, 0, 0)])
def test_add(a: int, b: int, expected: int) -> None:
    assert a + b == expected

@pytest.mark.asyncio
async def test_fetch(client: Client) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
```

- プレーンな `def test_*` 関数で書ける。`assert` は pytest が rewrite して詳細な diff を出す。
- 組み込み fixture: `tmp_path` / `monkeypatch` / `capsys` / `caplog`。
- プラグイン: `pytest-xdist` (`-n auto` で並列)、`pytest-asyncio`、`pytest-cov`、`pytest-mock`。
- `conftest.py` に fixture を置くと配下で共有。
- 設定は `[tool.pytest.ini_options]`。

`unittest` (標準) は JUnit 系のボイラプレート多め。新規は pytest 一択。

## async / await

```python
import asyncio

async def fetch(url: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.text

async def main() -> None:
    # TaskGroup (3.11+) が structured concurrency の推奨形
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("https://a.example"))
        t2 = tg.create_task(fetch("https://b.example"))
    print(t1.result(), t2.result())

asyncio.run(main())
```

- `asyncio.run()` がエントリポイント。ネストは禁止。
- **TaskGroup (3.11+)** で子タスクをまとめて待つ。いずれかが失敗すれば他もキャンセルされ、例外は `ExceptionGroup` で集約。
- `asyncio.timeout(seconds)` (3.11+) はタイムアウト制御の推奨形。`asyncio.gather` + `asyncio.wait_for` の古い書き方は避ける。
- **anyio** は `asyncio` / `trio` 両対応の高水準ラッパ。FastAPI などで採用。

## エラーハンドリング

- **PEP 654 (3.11+)**: `ExceptionGroup` と `except*` 構文で複数同時例外を扱う。

  ```python
  try:
      async with asyncio.TaskGroup() as tg:
          ...
  except* TimeoutError as eg:
      log.warning("timeouts: %d", len(eg.exceptions))
  except* ValueError as eg:
      ...
  ```

- **PEP 758 (3.14+)**: `except` / `except*` の複数型で括弧不要: `except TimeoutError, ConnectionError:`。
- **PEP 765 (3.14+)**: `finally` から `return`/`break`/`continue` で抜けると `SyntaxWarning`（例外飲み込み防止）。
- ロギングは `logging.exception("msg")` で traceback 付きで出る。`print` より logger。

## 実行モード

| コマンド | 用途 |
|---|---|
| `python -m pkg` | パッケージの `__main__.py` を実行。CLI 起動の標準 |
| `python script.py` | スクリプト直接。`sys.path[0]` は script のディレクトリ |
| `python -I` | 分離モード。環境変数・user site を無視し再現性◎ |
| `python -W error` | warning を例外化 |
| `python -X faulthandler` | SEGV 時に traceback。`PYTHONFAULTHANDLER=1` でも可 |
| `uv run <cmd>` | 依存解決 + venv 起動を 1 コマンドで |

`PYTHONPATH` を不用意にいじると import がぶれる。プロジェクトは `pyproject.toml` の `[tool.setuptools.packages.find]` やビルド backend 側で解決する。

## パフォーマンス / GIL

- **PEP 703 (free-threaded CPython)**: 3.13 で experimental (`python3.13t`)、3.14 で **PEP 779 により "公式サポート"** へ昇格。GIL デフォルト無効化は 2028–2030 想定。
- **PEP 744 (JIT)**: 3.13 で experimental 導入、3.14 で Windows/macOS 配布バイナリに同梱（`PYTHON_JIT=1`）。
- **PEP 734 (subinterpreters)**: 3.14 で `concurrent.interpreters` 標準化。`concurrent.futures.InterpreterPoolExecutor` も同梱。CPU バウンドを GIL を跨いで並列化できる。

## 標準ライブラリの押さえどころ

| モジュール | 定番ポイント |
|---|---|
| `pathlib` | `Path("a")/"b"`、`.read_text()`、`.glob()`、3.14 で `.copy()`/`.move()` 追加 |
| `dataclasses` | `@dataclass(frozen=True, slots=True)`（slots は 3.10+） |
| `logging` | `logger = logging.getLogger(__name__)`。root logger 直叩きは避ける |
| `subprocess` | `run([...], check=True, capture_output=True, text=True)`。`shell=True` は避ける |
| `argparse` | 標準。`typer` / `click` は型ヒント・デコレータで補完性◎ |
| `json` | `json.loads` / `dumps(obj, indent=2)`。datetime は標準では未対応 |
| `contextlib` | `contextmanager` / `suppress` / `ExitStack` |
| `functools` | `@cache` (3.9+) / `@lru_cache(maxsize=...)` |

3.12 で `distutils` 削除、3.13 で PEP 594 により `cgi` / `telnetlib` / `aifc` / `imghdr` など **19 モジュールが削除**された。AI エージェントが書く過去の作法がそのまま落ちるので注意。

## AI エージェントがよくやるミス

1. **mutable default argument** — `def f(x=[])` は全呼び出しで同じリストを共有。`def f(x=None): x = x if x is not None else []`。
2. **`except:` / `except Exception:` の乱用** — 具体型を書く。`except BaseException:` は `KeyboardInterrupt` を握りつぶす。
3. **`subprocess.run(cmd, shell=True)`** — シェル injection の温床。**リスト形式で `shell=False`** が鉄則。
4. **`os.path.join` / 文字列結合でパス** — `pathlib.Path` を使う。OS 差を自動吸収。
5. **`==` と `is` の混同** — `is None` / `is True` は OK。文字列・整数は `==`。CPython の小整数キャッシュに依存しない。
6. **`print` デバッグを残す** — `logging.getLogger(__name__)` に置き換える。
7. **`from __future__ import annotations` を全ファイルで機械的に付ける** — 3.14+ では PEP 649 で必要性が下がる。新規コードは必要に応じて。
8. **`distutils` / 削除済みモジュール参照** — 3.12+ で `distutils` 不在、3.13+ で PEP 594 バッテリ削除。import エラー時はまず deprecation を疑う。
9. **循環 import / `sys.path.insert`** — パッケージ構造と `pyproject.toml` の `[tool.setuptools.packages]` で解く。
10. **CPython 前提の副作用 `__del__`** — refcount に依存すると PyPy / free-threaded で挙動変化。`with` / `contextmanager` で明示する。
11. **`asyncio.gather(*tasks)` 濫用** — 3.11+ は `TaskGroup` を使う。エラー集約と cancellation の整合が取れる。
12. **`requires-python` と構文のズレ** — `requires-python = ">=3.9"` なのに `match`（3.10+）や `Box[T]`（3.12+）を書く。リリース前に CI で下位バージョンも回す。
13. **f-string を書かず `%` / `.format`** — 新規コードは f-string 統一。
14. **`subprocess.run(...).returncode` を手動確認** — `check=True` を付ければ非 0 で `CalledProcessError`。

## トラブルシュート

### `externally-managed-environment` で `pip install` が拒否される

Debian 系の PEP 668 保護。必ず venv を作って使う（`python -m venv .venv` か `uv venv`）。

### `ModuleNotFoundError` だが `pip show` では入っている

複数 Python（system / pyenv / uv）が混在しており、想定と違う Python で実行している。`python -c "import sys; print(sys.executable)"` で使われている interpreter を確認する。

### 型チェックは通るが実行時に AttributeError

`from __future__ import annotations` で全アノテーションが文字列化され、`typing.get_type_hints()` が失敗する古いコードパターン。3.14+ の PEP 649 で改善される。`pydantic` など reflection 使う系は互換性を確認。

### `RuntimeError: asyncio.run() cannot be called from a running event loop`

Jupyter / IPython 内では既にイベントループが走っている。`await` を直接書くか、`nest_asyncio` で二重起動を許可する。

### ruff と black で format 差分が出る

ruff の format は black と**ほぼ**互換だが完全一致ではない。`[tool.ruff.format]` の設定で揃えるか、ruff 一本化する。

## 関連記事

- `tools/mise.md` — Python を含む多言語バージョン管理
- `tools/lefthook.md` — pre-commit で ruff / mypy を自動実行
- `languages/bash.md` — Python を呼び出すスクリプト側の落とし穴
- `standards/semver.md` — `requires-python` の記法と semver

## 参考

- [Python Documentation](https://docs.python.org/3/)
- [What's New in Python 3.14](https://docs.python.org/3/whatsnew/3.14.html)
- [What's New in Python 3.13](https://docs.python.org/3/whatsnew/3.13.html)
- [Python Developer's Guide: Versions](https://devguide.python.org/versions/)
- [PEP 621 (pyproject.toml)](https://peps.python.org/pep-0621/)
- [PEP 735 (dependency-groups)](https://peps.python.org/pep-0735/)
- [PEP 695 (type parameter syntax)](https://peps.python.org/pep-0695/)
- [PEP 703 (free-threaded CPython)](https://peps.python.org/pep-0703/)
- [PEP 734 (subinterpreters)](https://peps.python.org/pep-0734/)
- [uv documentation](https://docs.astral.sh/uv/)
- [ruff documentation](https://docs.astral.sh/ruff/)
- [pytest documentation](https://docs.pytest.org/)
