---
reviewed: 2026-06-07
tags: [specification, testing]
---

# Chrome DevTools Protocol (CDP)

Chromium / Chrome / Edge など Blink 系ブラウザを instrument・inspect・debug・profile するための JSON-RPC プロトコル。Chrome DevTools の front-end / backend 境界として始まり、現在は Puppeteer・Playwright・Lighthouse・Selenium・各種ヘッドレス自動化・AI ブラウザエージェントの共通基盤になっている。クロスブラウザ後継として **WebDriver BiDi** が W3C で策定中だが、Chromium 系では CDP が依然主流の低レベル API。

公式: [chromedevtools.github.io/devtools-protocol](https://chromedevtools.github.io/devtools-protocol/) / ソース: [ChromeDevTools/devtools-protocol](https://github.com/ChromeDevTools/devtools-protocol)

## バージョン

| バージョン | 位置付け |
|---|---|
| **stable 1.3** | Chrome 64 以降の安定版。フルプロトコルの部分集合で API 変更を避ける |
| **tip-of-tree (tot)** | Chromium 開発版に追従。互換性保証なし |
| **v8-inspector** | Node.js デバッグで使われる V8 側プロトコル |

型定義は npm の [`devtools-protocol`](https://www.npmjs.com/package/devtools-protocol) パッケージが Chromium に追従して継続更新される。

## アーキテクチャ

- **WebSocket 上の JSON-RPC**。クライアントは `{ id, method, params }` を送り、`{ id, result }` / `{ method, params }`（イベント）を受ける
- ブラウザは複数の **target**（page, iframe, dedicated/shared/service worker, browser）を持ち、各 target が個別の inspector エンドポイントを公開する
- `Target.attachToTarget` で **sessionId** を取得し、以降のメッセージに `sessionId` を付けてルーティング
- **Flatten mode**（`Target.attachToTarget({ flatten: true })`）が現代の推奨。`Target.sendMessageToTarget` で envelope する旧方式ではなく、トップレベル接続上で `sessionId` をメッセージ自体に付ける。Puppeteer / Playwright 双方が採用

## 接続方式

| 方式 | 起動オプション | 性質 |
|---|---|---|
| **TCP / WebSocket** | `--remote-debugging-port=<port>`（`0` でランダム） | HTTP 探索エンドポイント付き。ネットワーク公開のリスクあり |
| **stdio パイプ** | `--remote-debugging-pipe` | FD 3 読み / FD 4 書き。ポートを開かないため安全。Puppeteer の `pipe: true` |

### HTTP 探索エンドポイント（port 経由のときのみ）

| パス | 内容 |
|---|---|
| `GET /json/version` | ブラウザ・プロトコル・ブラウザレベル `webSocketDebuggerUrl` |
| `GET /json` / `GET /json/list` | target 一覧。各 target に `webSocketDebuggerUrl` |
| `PUT /json/new?<url>` | 新規 target 作成。**Chrome 127 以降は GET ではなく PUT** |
| `GET /json/protocol` | 当該ビルドが公開する protocol 定義 JSON |

### Chrome 136 のセキュリティ変更

Chrome 136 (2025) 以降、`--remote-debugging-port` / `--remote-debugging-pipe` は **デフォルトのユーザーデータディレクトリでは無効化**される。デバッグ目的で起動するときは **`--user-data-dir=<別ディレクトリ>` を必ず併用**する。既存ユーザーの Cookie / セッション搾取を防ぐためのトレードオフ。

## 主要 Domain

| Domain | 用途 |
|---|---|
| `Page` | ライフサイクル・ナビゲーション・スクリーンショット・PDF |
| `Runtime` | JS 式評価、コンソール、Promise、Exception |
| `DOM` | DOM ツリー取得・操作 |
| `Network` | リクエスト/レスポンス・ヘッダ・タイミング監視 |
| `Fetch` | リクエストの intercept / modify / fulfill（ネットワーク改竄） |
| `Target` | target ライフサイクルと attach |
| `Browser` | ウィンドウ・ダウンロード・パーミッション制御 |
| `Input` | マウス・キーボード・タッチのシミュレーション |
| `Debugger` | JS デバッガ（breakpoint, step） |
| `Performance` | Web Vitals / メトリクス取得 |
| `Tracing` | chrome://tracing 形式の trace 取得（Perfetto / Lighthouse 入力） |
| `Emulation` | デバイス・ジオロケーション・locale エミュレーション |
| `Storage` | Cookie / IndexedDB / Cache |
| `Security` | 証明書・mixed content |

## 最小利用例（Node.js + chrome-remote-interface）

```bash
# 別プロファイルでデバッグ起動
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

[`chrome-remote-interface`](https://github.com/cyrus-and/chrome-remote-interface) は Node.js 製の薄い低レベル wrapper。`devtools-protocol` 型定義 npm を併用すると Domain メソッドに型が付く。

### Playwright からの escape hatch

Playwright は独自プロトコルが中心だが、Chromium 上では `CDPSession` で生 CDP を呼び出せる:

```ts
const session = await context.newCDPSession(page);
await session.send('Network.enable');
session.on('Network.requestWillBeSent', (e) => console.log(e.request.url));
```

## 代表的なクライアント

| クライアント | 関係 |
|---|---|
| **Chrome DevTools** | フロントエンド自体が CDP クライアント。front-end / backend の境界が CDP |
| **Puppeteer** | デフォルトは CDP。v23+ で WebDriver BiDi も production-ready、**v24+ で BiDi がデフォルト** |
| **Playwright** | 独自プロトコル中心。Chromium では `newCDPSession` で生 CDP に降りられる |
| **Lighthouse** | Tracing / Performance / Network / Emulation を組み合わせて監査 |
| **Selenium 4** | W3C WebDriver Classic + BiDi。**4.29.0+ で CDP 直接サポートを廃止**、BiDi へ統一 |
| **chromedp** (Go) / **PyChromeDevTools / pychrome** (Python) | 多言語実装あり |
| **AI ブラウザエージェント** | browser-use, Anthropic Computer Use の browser tool, Steel.dev / Browserbase などのリモートブラウザは内部で Puppeteer / Playwright / 生 CDP を利用 |

npm では `chrome-remote-interface`（低レベル）/ `puppeteer-core`（高レベル）/ `devtools-protocol`（型定義）の組み合わせが一般的。

## WebDriver BiDi との関係

| 観点 | 状況（2026-06 時点） |
|---|---|
| 標準化 | W3C Browser Testing and Tools WG の Editor's Draft。Recommendation 化はまだ |
| Chrome / Edge | ChromeDriver 106（2022）から実装。漸進拡張中。**起動時のデフォルトは依然 CDP**（BiDi 未カバー機能があるため） |
| Firefox | 129 で production-ready。**141（2025-07-22）で experimental CDP を完全削除**、BiDi のみに |
| Safari (WebKit) | 未対応 |
| Puppeteer | v23+ で Firefox BiDi production-ready、v24+ で **BiDi がデフォルト** |
| Selenium | 4.29.0+ で BiDi に統一、CDP 直接サポートは廃止 |

整理: **Chromium 系の自動化では CDP が当面主流**。クロスブラウザ自動化は BiDi へ移行が進行中で、Firefox を扱うなら BiDi 一択。CDP の Chromium 側廃止予定はアナウンスされていない。

## トレース・パフォーマンス計測

```js
await Tracing.start({
  traceConfig: { includedCategories: ['devtools.timeline', 'v8', 'blink'] },
  transferMode: 'ReturnAsStream',
});
await Page.navigate({ url: 'https://example.com' });
await Page.loadEventFired();
const { stream } = await Tracing.end();
// IO.read で stream を chunk 読み出し、Perfetto / DevTools Performance に投入
```

Lighthouse は Page / Network / Runtime / Performance / Tracing / Emulation を統合して使う代表例。DevTools Performance パネルや Perfetto に読み込んで分析する。

## Headless モードとの関係

- Chrome 112+ で「新ヘッドレス」（`--headless=new`）が安定化、現在の `--headless` は新ヘッドレスを指す
- Chrome 132+ で **旧 headless（headless shell）は `chrome-headless-shell` という別バイナリ**に分離。Puppeteer は `headless: 'shell'`（旧）/ `headless: true`（新 = `--headless=new` 相当）で切り替え
- 新ヘッドレスは「通常 Chrome をウィンドウ非表示で起動」する実装で、機能パリティが取れている。CDP の挙動も通常起動と原則同じ

## セキュリティ上の注意

リモートデバッグポートを開いたブラウザは、そのポートに到達できるプロセスから **任意 JS 実行 / Cookie 読み取り / 任意ファイル参照に近い権限**を奪える。

- **`--remote-debugging-port` は必ず localhost バインド**。`0.0.0.0` や Docker での `9222` 公開は厳禁
- 可能なら **`--remote-debugging-pipe` を選ぶ**。ポートを開かず stdio で親プロセスとだけ通信。Puppeteer の `pipe: true`、sandbox（gVisor / Firecracker）でも動く
- **`--user-data-dir=<使い捨て>` を必ず付ける**。Chrome 136+ ではデフォルトプロファイルでデバッグスイッチが無効化されるので、別ディレクトリは事実上必須
- Chromium M113+ ではホスト名検証が追加され、外部公開ホストへの誘導が抑止されているが、信頼境界を超えて晒さない原則は変わらない

## AI エージェントがよくやるミス

1. **デフォルトプロファイルで `--remote-debugging-port` を付ける** — Chrome 136+ ではデバッグスイッチが無視され、`/json/version` が 404 になる。`--user-data-dir=/tmp/<unique>` を毎回付ける
2. **`/json/new?<url>` を GET で叩く** — Chrome 127+ で `PUT` 必須に変わっている。フェッチライブラリのデフォルトを `PUT` に変更する
3. **Flatten 無しで attach する** — 古い `Target.sendMessageToTarget` 経由は envelope の解釈が必要で、sessionId のルーティングを自前で書く羽目になる。`flatten: true` を使う
4. **`Network.enable` を忘れて intercept しようとする** — `Fetch.enable` / `Network.enable` を attach 直後に呼ばないとイベントが流れない。Domain ごとに enable が要る
5. **Firefox を CDP で操ろうとする** — Firefox 141（2025-07-22）以降は CDP サポートを完全削除。クロスブラウザは BiDi 経由で書く（または Puppeteer v24+ の BiDi デフォルトに乗る）
6. **9222 を Docker で `-p 9222:9222` 公開する** — ホスト上の任意プロセスから操作可能になる。`127.0.0.1:9222:9222` バインドか pipe モードに変更する
7. **生 CDP と Puppeteer / Playwright を混ぜて状態が壊れる** — 高レベル API が張った listener / state と競合する。Playwright なら `newCDPSession`、Puppeteer なら `page.target().createCDPSession()` を使い、勝手に raw WebSocket を開かない

## 関連

- [`languages/js/nodejs.md`](../languages/js/nodejs.md) — `chrome-remote-interface` / `puppeteer-core` の実行環境
- [`ai/platform/mcp-protocol.md`](../ai/platform/mcp-protocol.md) — 同様の JSON-RPC ベースプロトコル設計の比較対象

## 参考

- [Chrome DevTools Protocol（公式 viewer）](https://chromedevtools.github.io/devtools-protocol/)
- [ChromeDevTools/devtools-protocol（仕様リポジトリ）](https://github.com/ChromeDevTools/devtools-protocol)
- [chrome-remote-interface（Node.js クライアント）](https://github.com/cyrus-and/chrome-remote-interface)
- [WebDriver BiDi（W3C Editor's Draft）](https://w3c.github.io/webdriver-bidi/)
- [Changes to remote debugging switches to improve security (Chrome 136)](https://developer.chrome.com/blog/remote-debugging-port)
- [WebDriver BiDi is now production-ready in Firefox, Chrome, and Puppeteer](https://developer.chrome.com/blog/firefox-support-in-puppeteer-with-webdriver-bidi)
- [Deprecating CDP support in Firefox（Mozilla）](https://fxdx.dev/deprecating-cdp-support-in-firefox-embracing-the-future-with-webdriver-bidi/)
- [Chrome headless mode（新 headless）](https://developer.chrome.com/docs/chromium/new-headless)
- [Playwright CDPSession](https://playwright.dev/docs/api/class-cdpsession)
- [Puppeteer WebDriver BiDi](https://pptr.dev/webdriver-bidi)
