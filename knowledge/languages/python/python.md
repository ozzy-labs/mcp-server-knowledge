---
reviewed: 2026-05-04
tags: [python]
---

# Python

Dynamically typed scripting language. One of the languages AI agents read and write most often — understanding the current state of **dependency management** and **type hints** avoids most pitfalls.

Official: [docs.python.org](https://docs.python.org/3/) / [uv](https://docs.astral.sh/uv/) / [ruff](https://docs.astral.sh/ruff/)

## Versions and EOL

| Series | Release | Status (as of 2026-05) | EOL |
|---|---|---|---|
| 3.14 | 2025-10 | **Current** (bugfix) | 2030-10 |
| 3.13 | 2024-10 | bugfix | 2029-10 |
| 3.12 | 2023-10 | security-only | 2028-10 |
| 3.11 | 2022-10 | security-only | 2027-10 |
| 3.10 | 2021-10 | security-only | 2026-10 |
| 3.9  | 2020-10 | EOL | 2025-10 |

- A major release ships every October. From 3.13 onward, under the **revised PEP 602**, the lifecycle is "2 years full support + 3 years security-only = **5 years total**." 3.12 and earlier used "1.5 + 3.5 years."
- 3.13 or 3.14 is recommended for production. 3.10 reaches EOL in 2026-10, so plan a migration.
- On Windows, the **`py` launcher** bundled with the official installer switches versions via `py -3.14` / `py -3.13`. On Unix, call versioned binaries directly, e.g. `python3.14`.

## Installation / version management

| Tool | Purpose |
|---|---|
| **uv** (astral.sh, written in Rust) | Unifies runtime acquisition + venv + package management + lockfile + tool execution. The 2026 de facto standard |
| `mise` | Multi-language support. Pin the Python version via `mise.toml` (`tools/mise.md`) |
| `pyenv` | Veteran shim-based tool. Still active on Unix. `pyenv-win` for Windows |
| Official python.org | Windows installer bundles the `py` launcher |
| Docker Hub `python:3.14-slim` | Pinned image for production/CI |

`uv python install 3.14` fetches the Python runtime itself. `uv` alone can largely replace `pyenv` + `pip` + `virtualenv` + `poetry` + `pipx`.

## Virtual environments

**Always use a venv** to avoid polluting the global `site-packages`. On Debian-based systems, PEP 668 makes `pip install` into the system Python fail with `externally-managed-environment`.

```bash
# Standard (venv module)
python -m venv .venv
source .venv/bin/activate     # POSIX
.venv\Scripts\activate        # Windows

# uv (no activation needed)
uv venv
uv run python script.py
```

## Package management

The recommended flow as of 2026:

| Tool | Position |
|---|---|
| **uv** | First choice for new projects. `uv add`/`uv sync`/`uv lock` |
| **Poetry** | Traditional leading choice. Fine to keep using on existing projects |
| **Hatch** | Official PyPA lineage. Build + environment management |
| **pip-tools** | `pip-compile` turns `requirements.txt` into a lockfile |
| **pipx** / `uv tool` | Isolated installs for CLI tools |

Using `pip install` directly lacks a lockfile and reproducibility, so it's discouraged outside library development. `requirements.txt` is legacy but still valid. `uv.lock` / `poetry.lock` are the mainstream lockfiles.

## pyproject.toml

PEP 621 standardized the `[project]` table, establishing tool-agnostic metadata.

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

# PEP 735: dev dependencies are excluded from build artifacts
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

## Type hints

- **PEP 585 (3.9+)**: Built-in generics like `list[int]` / `dict[str, int]`. `from typing import List` is no longer needed.
- **PEP 604 (3.10+)**: The `|` union syntax. `X | Y`, `X | None`.
- **PEP 695 (3.12+)**: New type parameter syntax. No need to import `TypeVar` / `Generic`.

  ```python
  class Box[T]:
      def __init__(self, value: T) -> None:
          self.value = value

  def first[T](items: list[T]) -> T:
      return items[0]

  type Vec[T] = list[T]
  ```

- **PEP 696 (3.13+)**: Default values for `TypeVar`.
- **PEP 705 (3.13+)**: `ReadOnly[...]` for `TypedDict`.
- **PEP 742 (3.13+)**: `TypeIs[T]` — unlike `TypeGuard`, this provides bidirectional narrowing that **also narrows the type in the else branch**. Available on 3.12 and below via `typing_extensions>=4.10`.
- `from __future__ import annotations`: makes all annotations lazily evaluated as strings. From 3.14 onward, PEP 649/749 (deferred evaluation) reduces the need for this import.

## Type checkers

| Tool | Position |
|---|---|
| **mypy** | The official reference implementation. `[tool.mypy]`, `strict = true` |
| **pyright** (Microsoft, written in TS) | Fast. Bundled inside the **Pylance** VSCode extension |
| **ty** (astral.sh, written in Rust) | Public beta released 2025-12-16. 1.0 targeted for 2026 (to be confirmed) |
| pyre (Meta) / pytype (Google) | For large codebases / maintenance has stalled |

Pylance is the default in VSCode. In CI, running mypy or pyright via `pre-commit` / `lefthook` is common.

## Lint / format: ruff

**ruff** is the 2026 de facto standard. It integrates `black` + `isort` + `flake8` + `pydocstyle` + `pyupgrade` + `autoflake` in a Rust implementation, dozens of times faster.

```bash
ruff check .        # lint
ruff check --fix .  # auto-fix
ruff format .       # format (black-compatible)
```

Select rules via the `[tool.ruff.lint]` section, e.g. `select = ["E", "F", "I", "UP", "B", "SIM"]`. Using black / pylint individually is becoming less common.

## Testing: pytest

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

- Write tests as plain `def test_*` functions. pytest rewrites `assert` to produce detailed diffs.
- Built-in fixtures: `tmp_path` / `monkeypatch` / `capsys` / `caplog`.
- Plugins: `pytest-xdist` (parallelize with `-n auto`), `pytest-asyncio`, `pytest-cov`, `pytest-mock`.
- Placing fixtures in `conftest.py` shares them across the directory.
- Configure via `[tool.pytest.ini_options]`.

`unittest` (standard library) has more JUnit-style boilerplate. pytest is the clear choice for new code.

## async / await

```python
import asyncio

async def fetch(url: str) -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        return resp.text

async def main() -> None:
    # TaskGroup (3.11+) is the recommended form of structured concurrency
    async with asyncio.TaskGroup() as tg:
        t1 = tg.create_task(fetch("https://a.example"))
        t2 = tg.create_task(fetch("https://b.example"))
    print(t1.result(), t2.result())

asyncio.run(main())
```

- `asyncio.run()` is the entry point. Nesting it is forbidden.
- **TaskGroup (3.11+)** waits on child tasks as a group. If one fails, the others are cancelled and exceptions are aggregated into an `ExceptionGroup`.
- `asyncio.timeout(seconds)` (3.11+) is the recommended way to control timeouts. Avoid the older `asyncio.gather` + `asyncio.wait_for` pattern.
- **anyio** is a high-level wrapper supporting both `asyncio` and `trio`, used by frameworks like FastAPI.

## Error handling

- **PEP 654 (3.11+)**: `ExceptionGroup` and the `except*` syntax handle multiple simultaneous exceptions.

  ```python
  try:
      async with asyncio.TaskGroup() as tg:
          ...
  except* TimeoutError as eg:
      log.warning("timeouts: %d", len(eg.exceptions))
  except* ValueError as eg:
      ...
  ```

- **PEP 758 (3.14+)**: Parentheses are no longer required for multiple types in `except` / `except*`: `except TimeoutError, ConnectionError:`.
- **PEP 765 (3.14+)**: A `SyntaxWarning` is raised when `return`/`break`/`continue` exits from within `finally` (prevents exception swallowing).
- For logging, `logging.exception("msg")` includes the traceback. Prefer a logger over `print`.

## Execution modes

| Command | Purpose |
|---|---|
| `python -m pkg` | Runs the package's `__main__.py`. The standard way to launch a CLI |
| `python script.py` | Runs a script directly. `sys.path[0]` is the script's directory |
| `python -I` | Isolated mode. Ignores environment variables and user site, good for reproducibility |
| `python -W error` | Turns warnings into exceptions |
| `python -X faulthandler` | Prints a traceback on SEGV. Also settable via `PYTHONFAULTHANDLER=1` |
| `uv run <cmd>` | Resolves dependencies and launches the venv in one command |

Carelessly tweaking `PYTHONPATH` destabilizes imports. Resolve project layout via `[tool.setuptools.packages.find]` in `pyproject.toml` or the build backend instead.

## Performance / GIL

- **PEP 703 (free-threaded CPython)**: experimental in 3.13 (`python3.13t`), promoted to **"officially supported" via PEP 779** in 3.14. GIL-disabled-by-default is expected around 2028–2030.
- **PEP 744 (JIT)**: introduced experimentally in 3.13, bundled into the Windows/macOS distribution binaries in 3.14 (`PYTHON_JIT=1`).
- **PEP 734 (subinterpreters)**: `concurrent.interpreters` standardized in 3.14. `concurrent.futures.InterpreterPoolExecutor` is also included. Enables parallelizing CPU-bound work across the GIL.

## Standard library essentials

| Module | Key points |
|---|---|
| `pathlib` | `Path("a")/"b"`, `.read_text()`, `.glob()`; `.copy()`/`.move()` added in 3.14 |
| `dataclasses` | `@dataclass(frozen=True, slots=True)` (slots available from 3.10+) |
| `logging` | `logger = logging.getLogger(__name__)`. Avoid calling the root logger directly |
| `subprocess` | `run([...], check=True, capture_output=True, text=True)`. Avoid `shell=True` |
| `argparse` | Standard. `typer` / `click` complement it well with type hints and decorators |
| `json` | `json.loads` / `dumps(obj, indent=2)`. datetime is not supported by default |
| `contextlib` | `contextmanager` / `suppress` / `ExitStack` |
| `functools` | `@cache` (3.9+) / `@lru_cache(maxsize=...)` |

`distutils` was removed in 3.12, and in 3.13 PEP 594 removed **19 modules** including `cgi` / `telnetlib` / `aifc` / `imghdr`. Watch out — older patterns AI agents write can break outright.

## Common mistakes AI agents make

1. **Mutable default arguments** — `def f(x=[])` shares the same list across all calls. Use `def f(x=None): x = x if x is not None else []`.
2. **Overusing bare `except:` / `except Exception:`** — write specific exception types. `except BaseException:` swallows `KeyboardInterrupt`.
3. **`subprocess.run(cmd, shell=True)`** — a breeding ground for shell injection. The rule is **list form with `shell=False`**.
4. **Building paths with `os.path.join` / string concatenation** — use `pathlib.Path` instead, which absorbs OS differences automatically.
5. **Confusing `==` with `is`** — `is None` / `is True` are fine. Use `==` for strings and integers; don't rely on CPython's small-integer cache.
6. **Leaving `print` debugging in place** — replace with `logging.getLogger(__name__)`.
7. **Mechanically adding `from __future__ import annotations` to every file** — its necessity decreases in 3.14+ due to PEP 649. Add it only when needed in new code.
8. **Referencing `distutils` / removed modules** — `distutils` is gone from 3.12+, and PEP 594 batteries were removed in 3.13+. Suspect deprecation first when hitting import errors.
9. **Circular imports / `sys.path.insert`** — resolve via package structure and `[tool.setuptools.packages]` in `pyproject.toml`.
10. **CPython-dependent side effects in `__del__`** — relying on refcounting changes behavior on PyPy / free-threaded builds. Make cleanup explicit with `with` / `contextmanager`.
11. **Overusing `asyncio.gather(*tasks)`** — use `TaskGroup` on 3.11+ for consistent error aggregation and cancellation.
12. **Mismatch between `requires-python` and syntax used** — e.g. declaring `requires-python = ">=3.9"` while using `match` (3.10+) or `Box[T]` (3.12+). Run CI against the lower-bound version before release.
13. **Using `%` / `.format` instead of f-strings** — standardize new code on f-strings.
14. **Manually checking `subprocess.run(...).returncode`** — add `check=True` to raise `CalledProcessError` on nonzero exit.

## Troubleshooting

### `pip install` refused with `externally-managed-environment`

PEP 668 protection on Debian-based systems. Always create and use a venv (`python -m venv .venv` or `uv venv`).

### `ModuleNotFoundError` even though `pip show` says it's installed

Multiple Pythons (system / pyenv / uv) coexist, and you're running the wrong interpreter. Check which interpreter is in use with `python -c "import sys; print(sys.executable)"`.

### Type checking passes but `AttributeError` at runtime

An older code pattern where `from __future__ import annotations` stringifies all annotations, causing `typing.get_type_hints()` to fail. This improves with PEP 649 in 3.14+. Check compatibility for reflection-heavy libraries like `pydantic`.

### `RuntimeError: asyncio.run() cannot be called from a running event loop`

An event loop is already running inside Jupyter / IPython. Write `await` directly, or allow double-starting via `nest_asyncio`.

### Format differences between ruff and black

ruff's formatter is **nearly** but not perfectly compatible with black. Align settings under `[tool.ruff.format]`, or standardize on ruff alone.

## Related articles

- `tools/mise.md` — Multi-language version management including Python
- `tools/lefthook.md` — Automatically running ruff / mypy via pre-commit
- `languages/bash.md` — Pitfalls on the scripting side when invoking Python
- `standards/semver.md` — `requires-python` notation and semver

## References

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
