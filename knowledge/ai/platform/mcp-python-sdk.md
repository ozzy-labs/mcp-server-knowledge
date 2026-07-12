---
reviewed: 2026-07-12
tags: [library, python, ai-workflow]
aliases: [fastmcp, mcp-python]
---

# MCP Python SDK

`mcp` — the official Python SDK implementing both server and client sides of the Model Context Protocol. It ships a high-level **FastMCP** API (decorator-based) plus a low-level `Server`. It is the Python counterpart to [`mcp-typescript-sdk.md`](mcp-typescript-sdk.md) (the SDK this repository uses).

Official: [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) / [PyPI](https://pypi.org/project/mcp/)

## Two things called "FastMCP" (read this first)

This is the single biggest source of confusion:

| Import | What it is |
|---|---|
| `from mcp.server.fastmcp import FastMCP` | **The SDK-bundled FastMCP** — FastMCP 1.0, absorbed into the official `mcp` package in 2024. This article covers this one |
| `from fastmcp import FastMCP` (`pip install fastmcp`) | **Standalone FastMCP 2.0** — a separate project (PrefectHQ/`jlowin`, docs at [gofastmcp.com](https://gofastmcp.com)) that extends the idea with auth, proxying, OpenAPI generation, and more |

They are different packages. Use `mcp.server.fastmcp` for the official SDK; reach for standalone `fastmcp` only when you specifically want its extra features.

## Versions

As of 2026-07, the latest stable is **`mcp` 1.28.1** (2026-06-26). Requires **Python >= 3.10**. A **v2 is in beta** (`2.0.0b1`, 2026-06-30) aligned with the upcoming 2026-07-28 spec, but it is not for production — stay on the 1.28.x line.

## Installation

```bash
uv add mcp                 # minimal
uv add "mcp[cli]"          # with the `mcp` CLI tool
pip install "mcp[cli]"     # pip equivalent
```

The `[cli]` extra pulls in `typer` + `python-dotenv` (required for the `mcp dev` / `mcp install` commands). Other extras: `rich` (rich console output) and `ws` (`websockets`, for the WebSocket transport).

## Minimal server (FastMCP)

Type hints generate the JSON schema; the docstring becomes the description.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Demo")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b

@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"

@mcp.prompt(title="Code Review")
def review_code(code: str) -> str:
    return f"Please review this code:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="streamable-http")   # "stdio" | "sse" | "streamable-http"
```

## Server API

### Structured output

Return a Pydantic `BaseModel` (or `TypedDict` / `dataclass`) and the SDK emits `structuredContent` plus a matching `outputSchema`:

```python
from pydantic import BaseModel, Field

class WeatherData(BaseModel):
    temperature: float = Field(description="Temperature in Celsius")
    condition: str

@mcp.tool()
def get_weather(city: str) -> WeatherData:
    return WeatherData(temperature=22.5, condition="sunny")
```

### Context (logging, progress, resources)

Add a `ctx: Context[...]` parameter and the SDK injects it (omit the annotation and it is **not** injected):

```python
from mcp.server.fastmcp import Context
from mcp.server.session import ServerSession

@mcp.tool()
async def process(name: str, ctx: Context[ServerSession, None], steps: int = 5) -> str:
    await ctx.info(f"Starting: {name}")
    for i in range(steps):
        await ctx.report_progress(progress=(i + 1) / steps, total=1.0)
    return "done"
```

`Context` exposes `ctx.request_id`, logging (`info` / `debug` / `warning` / `error`), `report_progress`, and `read_resource`.

### Lifespan (typed startup/shutdown)

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def app_lifespan(server: FastMCP):
    db = await Database.connect()
    try:
        yield AppContext(db=db)
    finally:
        await db.disconnect()

mcp = FastMCP("My App", lifespan=app_lifespan)
# access inside a tool: ctx.request_context.lifespan_context.db
```

Images are returned with `mcp.server.fastmcp.Image`; prompts can return a `list[base.Message]` for multi-message templates.

## Client

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

params = StdioServerParameters(command="uv", args=["run", "server", "stdio"])

async with stdio_client(params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()                 # required before any call
        tools = await session.list_tools()
        result = await session.call_tool("add", arguments={"a": 5, "b": 3})
```

For remote servers use the Streamable HTTP client. **The current function is `streamable_http_client` (with underscores)**; the older `streamablehttp_client` is deprecated but still present:

```python
from mcp.client.streamable_http import streamable_http_client

async with streamable_http_client("http://localhost:8000/mcp") as (read, write, _):
    async with ClientSession(read, write) as session:
        await session.initialize()
```

## CLI (`mcp` command)

| Command | Purpose |
|---|---|
| `mcp dev server.py` | Launch the MCP Inspector for testing. `--with <pkg>` adds deps; `--with-editable <path>` mounts local code |
| `mcp install server.py` | Register the server into **Claude Desktop**'s config. `-v KEY=VALUE` (env), `-f .env`, `--name` |
| `mcp run server.py` | Run a server directly (FastMCP servers only, not low-level) |

Run via `uv run mcp dev ...`. `mcp install` is Claude Desktop-specific.

## Transports

`mcp.run(transport=...)` accepts the exact strings `"stdio"`, `"sse"`, or `"streamable-http"` (hyphen). **Streamable HTTP is recommended for production** — the docs suggest `stateless_http=True` and `json_response=True` for scalability. **SSE is legacy** (superseded by Streamable HTTP). To mount onto an existing ASGI app (Starlette / FastAPI), use `mcp.streamable_http_app()` / `mcp.sse_app()`.

## Comparison with the TypeScript SDK

| Aspect | Python (`mcp` 1.28.x) | TypeScript (`@modelcontextprotocol/sdk` 1.29.x) |
|---|---|---|
| High-level API | **FastMCP** (`@mcp.tool()` decorators) | **`McpServer`** (`registerTool()` / `registerResource()`) |
| Low-level API | `mcp.server.lowlevel.Server` | `Server` |
| Schema definition | Python **type hints + Pydantic** | **Standard Schema** (bring Zod v4 / Valibot / ArkType) |
| Transports | stdio / streamable-http / sse (+ `ws` extra) | stdio / Streamable HTTP (SSE legacy) |
| v2 status | beta (`2.0.0b1`) | beta (`2.0.0-beta.3`) |

The key difference: **Standard Schema is a TypeScript-only concept** — Python defines schemas from type hints and Pydantic, so don't look for a "bring your own validator" mechanism there.

## Common AI Agent Mistakes

1. **Using the deprecated `streamablehttp_client`** — the current name is `streamable_http_client` (underscores). Training data often emits the old name.
2. **Confusing the two FastMCPs** — `from mcp.server.fastmcp import FastMCP` (SDK) vs `from fastmcp import FastMCP` (standalone 2.0, `pip install fastmcp`). Different packages with different features.
3. **Choosing SSE for a new server** — prefer `streamable-http`; SSE is legacy.
4. **Wrong transport string** — it is `"streamable-http"` (hyphen), not `"streamable_http"` or `"http"`.
5. **Forgetting the `[cli]` extra** — `mcp dev` / `mcp install` need `typer`; install `"mcp[cli]"`.
6. **Omitting `await session.initialize()`** — required before any client call.
7. **Missing the `ctx: Context[...]` annotation** — without it the `Context` object is not injected.
8. **Trying to bring Zod / Standard Schema into Python** — Python uses type hints + Pydantic; Standard Schema is a TS-SDK feature.

## Related

- [`mcp-typescript-sdk.md`](mcp-typescript-sdk.md) — the TypeScript counterpart (used by this repository)
- [`mcp-protocol.md`](mcp-protocol.md) — the protocol itself (primitives, transports, spec revisions)
- [`../../languages/python/uv.md`](../../languages/python/uv.md) — recommended installer/runner (`uv add mcp`, `uv run mcp dev`)

## References

- [python-sdk on GitHub](https://github.com/modelcontextprotocol/python-sdk)
- [Rendered docs](https://modelcontextprotocol.github.io/python-sdk/)
- [PyPI `mcp`](https://pypi.org/project/mcp/)
- [Standalone FastMCP 2.0 (gofastmcp.com)](https://gofastmcp.com)
