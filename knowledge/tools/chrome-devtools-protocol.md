---
reviewed: 2026-06-07
tags: [specification, testing]
---

# Chrome DevTools Protocol (CDP)

A JSON-RPC protocol for instrumenting, inspecting, debugging, and profiling Blink-based browsers such as Chromium / Chrome / Edge. It started as the front-end/backend boundary of Chrome DevTools and is now the common foundation for Puppeteer, Playwright, Lighthouse, Selenium, various headless automation tools, and AI browser agents. **WebDriver BiDi** is being standardized at the W3C as a cross-browser successor, but CDP remains the dominant low-level API for Chromium-based browsers.

Official: [chromedevtools.github.io/devtools-protocol](https://chromedevtools.github.io/devtools-protocol/) / Source: [ChromeDevTools/devtools-protocol](https://github.com/ChromeDevTools/devtools-protocol)

## Versions

| Version | Positioning |
|---|---|
| **stable 1.3** | The stable version since Chrome 64. A subset of the full protocol that avoids API changes |
| **tip-of-tree (tot)** | Tracks the Chromium development version. No compatibility guarantee |
| **v8-inspector** | The V8-side protocol used for Node.js debugging |

Type definitions are continuously updated to track Chromium via the npm [`devtools-protocol`](https://www.npmjs.com/package/devtools-protocol) package.

## Architecture

- **JSON-RPC over WebSocket**. Clients send `{ id, method, params }` and receive `{ id, result }` / `{ method, params }` (events)
- A browser has multiple **targets** (page, iframe, dedicated/shared/service worker, browser), and each target exposes its own inspector endpoint
- `Target.attachToTarget` obtains a **sessionId**, which is attached to subsequent messages for routing
- **Flatten mode** (`Target.attachToTarget({ flatten: true })`) is the modern recommendation. Instead of the older approach of wrapping messages via `Target.sendMessageToTarget`, the `sessionId` is attached directly to messages on the top-level connection. Both Puppeteer and Playwright adopt this

## Connection methods

| Method | Launch option | Characteristics |
|---|---|---|
| **TCP / WebSocket** | `--remote-debugging-port=<port>` (`0` for a random port) | Comes with an HTTP discovery endpoint. Risk of network exposure |
| **stdio pipe** | `--remote-debugging-pipe` | Read on FD 3 / write on FD 4. Safer since no port is opened. Puppeteer's `pipe: true` |

### HTTP discovery endpoints (port-based connections only)

| Path | Content |
|---|---|
| `GET /json/version` | Browser and protocol info, plus the browser-level `webSocketDebuggerUrl` |
| `GET /json` / `GET /json/list` | List of targets. Each target includes a `webSocketDebuggerUrl` |
| `PUT /json/new?<url>` | Create a new target. **From Chrome 127, PUT is required instead of GET** |
| `GET /json/protocol` | The protocol definition JSON exposed by that build |

### Chrome 136 security change

From Chrome 136 (2025) onward, `--remote-debugging-port` / `--remote-debugging-pipe` are **disabled by default when using the default user data directory**. When launching for debugging purposes, **always also pass `--user-data-dir=<separate directory>`**. This is a tradeoff to prevent exfiltration of existing users' cookies/sessions.

## Key domains

| Domain | Purpose |
|---|---|
| `Page` | Lifecycle, navigation, screenshots, PDF |
| `Runtime` | JS expression evaluation, console, promises, exceptions |
| `DOM` | DOM tree retrieval/manipulation |
| `Network` | Monitoring requests/responses, headers, timing |
| `Fetch` | Intercepting/modifying/fulfilling requests (network tampering) |
| `Target` | Target lifecycle and attach |
| `Browser` | Window, download, and permission control |
| `Input` | Mouse, keyboard, and touch simulation |
| `Debugger` | JS debugger (breakpoints, stepping) |
| `Performance` | Retrieving Web Vitals / metrics |
| `Tracing` | Capturing traces in chrome://tracing format (input for Perfetto / Lighthouse) |
| `Emulation` | Emulating devices, geolocation, locale |
| `Storage` | Cookies / IndexedDB / Cache |
| `Security` | Certificates, mixed content |

## Minimal usage example (Node.js + chrome-remote-interface)

```bash
# Launch for debugging with a separate profile
google-chrome \
  --headless=new \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/cdp-profile \
  about:blank
```

```js
import CDP from 'chrome-remote-interface';

const client = await CDP();
const { Page, Runtime, DOM, Network } = client;

await Promise.all([Page.enable(), Network.enable(), Runtime.enable()]);

await Page.navigate({ url: 'https://example.com' });
await Page.loadEventFired();

const { result } = await Runtime.evaluate({
  expression: 'document.title',
  returnByValue: true,
});
console.log(result.value); // -> "Example Domain"

const { root } = await DOM.getDocument();
console.log('rootNodeId =', root.nodeId);

await client.close();
```

[`chrome-remote-interface`](https://github.com/cyrus-and/chrome-remote-interface) is a thin, low-level Node.js wrapper. Combining it with the `devtools-protocol` type-definition npm package adds types to domain methods.

### Escape hatch from Playwright

Playwright is centered on its own protocol, but on Chromium you can call raw CDP via `CDPSession`:

```ts
const session = await context.newCDPSession(page);
await session.send('Network.enable');
session.on('Network.requestWillBeSent', (e) => console.log(e.request.url));
```

## Representative clients

| Client | Relationship |
|---|---|
| **Chrome DevTools** | The front-end itself is a CDP client. CDP is the boundary between front-end and backend |
| **Puppeteer** | CDP by default. WebDriver BiDi became production-ready in v23+, and **BiDi became the default in v24+** |
| **Playwright** | Centered on its own protocol. On Chromium, you can drop down to raw CDP via `newCDPSession` |
| **Lighthouse** | Audits by combining Tracing / Performance / Network / Emulation |
| **Selenium 4** | W3C WebDriver Classic + BiDi. **Direct CDP support was removed in 4.29.0+**, unifying on BiDi |
| **chromedp** (Go) / **PyChromeDevTools / pychrome** (Python) | Implementations exist in multiple languages |
| **AI browser agents** | browser-use, Anthropic's Computer Use browser tool, and remote browsers such as Steel.dev / Browserbase internally use Puppeteer, Playwright, or raw CDP |

In the npm ecosystem, the common combination is `chrome-remote-interface` (low-level) / `puppeteer-core` (high-level) / `devtools-protocol` (type definitions).

## Relationship with WebDriver BiDi

| Aspect | Status (as of 2026-06) |
|---|---|
| Standardization | Editor's Draft at the W3C Browser Testing and Tools WG. Not yet a Recommendation |
| Chrome / Edge | Implemented since ChromeDriver 106 (2022). Being incrementally extended. **CDP remains the default at launch** (because some features aren't yet covered by BiDi) |
| Firefox | Production-ready in 129. **Experimental CDP was fully removed in 141 (2025-07-22)**, leaving only BiDi |
| Safari (WebKit) | Not supported |
| Puppeteer | Firefox BiDi became production-ready in v23+, and **BiDi became the default in v24+** |
| Selenium | Unified on BiDi in 4.29.0+; direct CDP support removed |

Summary: **CDP remains dominant for Chromium-based automation for the foreseeable future**. Cross-browser automation is progressively migrating to BiDi, and BiDi is the only option if you need to handle Firefox. No deprecation of CDP on the Chromium side has been announced.

## Tracing / performance measurement

```js
await Tracing.start({
  traceConfig: { includedCategories: ['devtools.timeline', 'v8', 'blink'] },
  transferMode: 'ReturnAsStream',
});
await Page.navigate({ url: 'https://example.com' });
await Page.loadEventFired();
const { stream } = await Tracing.end();
// Read the stream in chunks with IO.read, then feed it into Perfetto / DevTools Performance
```

Lighthouse is a representative example that combines Page / Network / Runtime / Performance / Tracing / Emulation. Load the results into the DevTools Performance panel or Perfetto for analysis.

## Relationship with headless mode

- "New headless" (`--headless=new`) stabilized in Chrome 112+; the current `--headless` refers to new headless
- From Chrome 132+, **old headless (headless shell) is split into a separate binary called `chrome-headless-shell`**. Puppeteer switches between them with `headless: 'shell'` (old) / `headless: true` (new, equivalent to `--headless=new`)
- New headless is implemented as "launching normal Chrome with the window hidden," achieving feature parity. CDP behavior is, in principle, the same as a normal launch

## Security notes

A browser with an open remote-debugging port grants any process that can reach that port near-**arbitrary JS execution / cookie reading / arbitrary file access** privileges.

- **Always bind `--remote-debugging-port` to localhost**. Exposing `0.0.0.0` or publishing `9222` in Docker is strictly forbidden
- Prefer **`--remote-debugging-pipe` where possible**. It doesn't open a port and communicates with the parent process only via stdio. This is Puppeteer's `pipe: true`, and it also works in sandboxes (gVisor / Firecracker)
- **Always add `--user-data-dir=<disposable>`**. Since Chrome 136+ disables the debugging switch for the default profile, a separate directory is effectively mandatory
- Chromium M113+ added hostname validation, which discourages redirection to externally exposed hosts, but the principle of never exposing this across a trust boundary still applies

## Common mistakes made by AI agents

1. **Adding `--remote-debugging-port` with the default profile** — On Chrome 136+, the debugging switch is ignored and `/json/version` returns 404. Always add `--user-data-dir=/tmp/<unique>`
2. **Calling `/json/new?<url>` with GET** — From Chrome 127+, `PUT` is required. Change your fetch library's default to `PUT`
3. **Attaching without Flatten** — Going through the older `Target.sendMessageToTarget` requires interpreting envelopes, forcing you to write your own sessionId routing. Use `flatten: true`
4. **Trying to intercept without calling `Network.enable`** — Events won't flow unless you call `Fetch.enable` / `Network.enable` immediately after attaching. Each domain needs its own enable call
5. **Trying to drive Firefox with CDP** — From Firefox 141 (2025-07-22) onward, CDP support has been completely removed. Write cross-browser code via BiDi (or ride on Puppeteer v24+'s BiDi default)
6. **Exposing 9222 in Docker via `-p 9222:9222`** — This makes it operable from any process on the host. Change to a `127.0.0.1:9222:9222` bind or pipe mode instead
7. **Mixing raw CDP with Puppeteer / Playwright, breaking state** — This conflicts with listeners/state set up by the high-level API. Use `newCDPSession` for Playwright or `page.target().createCDPSession()` for Puppeteer, and don't open a raw WebSocket yourself

## Related

- [`languages/js/nodejs.md`](../languages/js/nodejs.md) — Runtime environment for `chrome-remote-interface` / `puppeteer-core`
- [`ai/platform/mcp-protocol.md`](../ai/platform/mcp-protocol.md) — A comparable JSON-RPC-based protocol design

## References

- [Chrome DevTools Protocol (official viewer)](https://chromedevtools.github.io/devtools-protocol/)
- [ChromeDevTools/devtools-protocol (specification repository)](https://github.com/ChromeDevTools/devtools-protocol)
- [chrome-remote-interface (Node.js client)](https://github.com/cyrus-and/chrome-remote-interface)
- [WebDriver BiDi (W3C Editor's Draft)](https://w3c.github.io/webdriver-bidi/)
- [Changes to remote debugging switches to improve security (Chrome 136)](https://developer.chrome.com/blog/remote-debugging-port)
- [WebDriver BiDi is now production-ready in Firefox, Chrome, and Puppeteer](https://developer.chrome.com/blog/firefox-support-in-puppeteer-with-webdriver-bidi)
- [Deprecating CDP support in Firefox (Mozilla)](https://fxdx.dev/deprecating-cdp-support-in-firefox-embracing-the-future-with-webdriver-bidi/)
- [Chrome headless mode (new headless)](https://developer.chrome.com/docs/chromium/new-headless)
- [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession)
- [Puppeteer WebDriver BiDi](https://pptr.dev/webdriver-bidi)
