---
reviewed: 2026-07-12
tags: [framework, python]
---

# FastAPI

A modern, high-performance web framework for building APIs with standard Python **type hints**. It stands on two libraries: **Starlette** (ASGI) for the web layer and **Pydantic** (v2) for data validation and serialization. The same type hints drive request parsing, validation, and **automatic OpenAPI / Swagger UI documentation**, so editor autocompletion and runtime checks come from one declaration. Created by Sebastián Ramírez (`tiangolo`).

Official: [fastapi.tiangolo.com](https://fastapi.tiangolo.com/)

## Positioning

- **Type-hint driven**: function signatures declare path/query/body params, and FastAPI validates and documents them
- **Standards-based**: generates OpenAPI + JSON Schema; interactive docs at `/docs` (Swagger UI) and `/redoc` (ReDoc)
- **ASGI / async-first**: built on Starlette, path operations can be `async def` or `def`
- Aimed at JSON APIs and services (contrast with Django/Flask full-stack apps)

## Versions

As of 2026-07, the latest stable is **`0.139.0`** (2026-07-01). FastAPI is still on the **0.x** line: before 1.0, a **minor** bump can contain breaking changes, so **pin the version** (e.g. `fastapi==0.139.0` or `fastapi~=0.139`) and read the [release notes](https://fastapi.tiangolo.com/release-notes/) before upgrading. Requires **Python >= 3.10**.

**Pydantic v2 is required.** v1 support was removed in 0.126.0, and the `pydantic.v1` shim was removed in 0.128.0. v1-era idioms (`@validator`, inner `class Config`, `.dict()`, `.parse_obj()`) no longer work on current versions.

## Installation

```bash
pip install "fastapi[standard]"   # recommended (quotes required)
pip install fastapi               # minimal, without standard extras
uv add "fastapi[standard]"        # with uv
```

The `standard` extra pulls in the pieces most projects need: `uvicorn[standard]` (the ASGI server), **`fastapi-cli`** (provides the `fastapi` command), `httpx` (for `TestClient`), `jinja2` (templates), `python-multipart` (form parsing), and `email-validator`. Without it, `pip install fastapi` gives you the library but **no `fastapi` CLI command**. See [uv](uv.md) for project/dependency management.

## Minimal app and running it

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}
```

```bash
fastapi dev main.py     # development: auto-reload, binds 127.0.0.1
fastapi run main.py     # production: no reload, binds 0.0.0.0
```

Interactive docs are served at `http://127.0.0.1:8000/docs` and `/redoc`. `fastapi dev` is a thin wrapper: internally the FastAPI CLI runs **Uvicorn**, so `fastapi dev main.py` is roughly `uvicorn main:app --reload` plus app auto-detection and dev/prod defaults.

## Path and query parameters

A function parameter whose name appears in the path string (`{item_id}`) is a **path parameter**; other scalar parameters become **query parameters**. Types are enforced and coerced:

```python
@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):  # item_id=path, q=query
    ...
```

The current recommended style attaches metadata/validation with **`Annotated`** rather than default-value assignment:

```python
from typing import Annotated
from fastapi import FastAPI, Path, Query

@app.get("/items/{item_id}")
async def read_items(
    item_id: Annotated[int, Path(title="The ID of the item", ge=0, le=1000)],
    q: Annotated[str | None, Query(max_length=50)] = None,
):
    ...
```

## Request body

Declare a Pydantic model as a parameter type. A model parameter is read from the JSON body; scalar parameters remain query params.

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str
    price: float
    tax: float | None = None

@app.post("/items/")
async def create_item(item: Item):
    return item
```

Field-level constraints live on the model via `pydantic.Field()`; `Query()` / `Path()` / `Body()` provide the same at the parameter level (e.g. `Annotated[int, Body(gt=0)]`). All of it flows into the OpenAPI schema.

## Dependency injection (`Depends`)

`Depends()` wires a callable's result into a path operation. The recommended form is `Annotated[X, Depends(...)]`:

```python
from typing import Annotated
from fastapi import Depends, FastAPI

def query_extractor(q: str | None = None):
    return q

@app.get("/items/")
async def read_query(q: Annotated[str | None, Depends(query_extractor)]):
    return {"q": q}
```

`yield` dependencies provide a value and run cleanup afterward (DB sessions, etc.). Their cleanup and background tasks run **after** all middleware completes.

## Async vs sync

Path operations may be `async def` or plain `def`. Official guidance:

- Use `async def` when you `await` an async library
- Use plain `def` when your libraries block (many DB drivers) — FastAPI runs `def` operations in an external threadpool so they don't block the event loop
- **"If you just don't know, use normal `def`."**

The inverse mistake matters: calling **synchronous blocking I/O inside an `async def`** blocks the event loop and hurts throughput. Don't reach for `def` on trivial pure-computation handlers for micro-optimization; `async def` is usually better unless you actually perform blocking I/O.

## Other key features

| Feature | Usage |
|---|---|
| `response_model` | `@app.get("/items/", response_model=list[Item])` — filters/validates/documents the response (also expressible as a return annotation) |
| `status_code` | `@app.post("/items/", status_code=201)`; constants in `fastapi.status` |
| `APIRouter` | Split routes into modules, combine with `app.include_router(router)` |
| `BackgroundTasks` | `background_tasks.add_task(fn, ...)` — runs after the response is sent |
| Middleware | `@app.middleware("http")` |
| Security | `fastapi.security` (`OAuth2PasswordBearer`, `OAuth2PasswordRequestForm`) as dependencies; JWT via an external lib (e.g. PyJWT) |

## Deployment

- Simplest production entry: **`fastapi run main.py`** — runs Uvicorn in production mode, binds `0.0.0.0`, reload off. The standard way to run inside a container
- Manual: `pip install "uvicorn[standard]"` then `uvicorn main:app --host 0.0.0.0 --port 80` (`main` = module, `app` = the `FastAPI` instance). **`--reload` is development-only**
- Alternative ASGI servers: Uvicorn (default), Hypercorn (HTTP/2), Granian

## Common AI Agent Mistakes

1. **Blocking I/O inside `async def`** — a synchronous DB/HTTP call in an `async def` blocks the event loop. Use `def` (threadpool) or an `await`-native library.
2. **Assuming Pydantic v1** — current FastAPI needs **Pydantic v2**. `@validator`, `class Config`, `.dict()`, and `.parse_obj()` are gone; use `field_validator`, `model_config`, `.model_dump()`, `.model_validate()`.
3. **`pip install fastapi` then `fastapi dev` fails** — the `fastapi` command ships in `fastapi-cli`, included only with `fastapi[standard]`.
4. **Old parameter style** — prefer `Annotated[int, Query(...)]` over `q: int = Query(default=...)`; the tutorial treats `Annotated` as the current recommendation.
5. **`response_model` mismatch** — the declared response schema filters the return value; extra fields are dropped and missing required fields raise. When both a `response_model` and a return annotation are given, `response_model` wins.
6. **Path vs query confusion** — names inside `{...}` are path params; other scalars are query params; a Pydantic model parameter is the request body.

## Comparison with other tools

| Framework | Positioning |
|---|---|
| FastAPI | Type-hint driven, async, auto OpenAPI. API-first |
| Flask | Minimal WSGI microframework; async and validation are add-ons |
| Django REST Framework | Batteries-included, tied to Django ORM/admin |
| Litestar | Similar type-driven ASGI framework; different DI/plugin model |
| [Hono](../js/hono.md) | The JS/TS-side equivalent for type-driven API frameworks |

## References

- [FastAPI documentation](https://fastapi.tiangolo.com/)
- [Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Concurrency and async / await](https://fastapi.tiangolo.com/async/)
- [FastAPI CLI](https://fastapi.tiangolo.com/fastapi-cli/)
- [Deployment](https://fastapi.tiangolo.com/deployment/manually/)
- [Migrate from Pydantic v1 to v2](https://fastapi.tiangolo.com/how-to/migrate-from-pydantic-v1-to-pydantic-v2/)
- [FastAPI on GitHub](https://github.com/fastapi/fastapi)
