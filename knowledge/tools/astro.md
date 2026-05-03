---
reviewed: 2026-05-04
tags: [framework, javascript, typescript]
---

# Astro

コンテンツ中心のサーバーファースト Web フレームワーク。ページ単位で静的生成（SSG）を既定とし、必要な部分だけをクライアントに水和する **Islands Architecture** を採用。React / Vue / Svelte / Solid など複数の UI ライブラリを同一プロジェクトで混在できる UI 非依存性が特徴。ドキュメントサイト用テーマ **Starlight** と併用されることが多い。

公式: [docs.astro.build](https://docs.astro.build/) ・ [starlight.astro.build](https://starlight.astro.build/)

## 位置付け

- ブログ・ドキュメント・マーケティングサイト向け（データ駆動 SPA は非対象）
- デフォルト出力は静的ファイル。SSR・ハイブリッドも adapter で可能
- クライアント JS はデフォルト 0 バイト。必要な箇所だけ `client:*` ディレクティブで hydrate する

## バージョン

2026-05 時点の現行 stable は **Astro 6.2**（6.0: 2026-03-10、6.1: 2026-03-26、6.2: 2026-04-30）。**Astro 7 は alpha** が 2026-04-30 に公開済み（`astro@7.0.0-alpha.x`）。Starlight は **0.38 系**で 1.0 未満、minor 間で破壊的変更があるため **minor 固定** を推奨。

## セットアップ

```bash
pnpm create astro@latest
# Starlight テンプレートを直接使う場合
pnpm create astro@latest -- --template starlight
```

## 主要コマンド

| コマンド | 用途 |
|---|---|
| `astro dev` | 開発サーバ（HMR 付き） |
| `astro build` | `dist/` へ本番ビルド |
| `astro preview` | ビルド結果をローカル配信 |
| `astro check` | TypeScript / 型診断（**build は型検査を含まない**） |
| `astro add <integration>` | integration を依存追加 + 設定追記 |
| `astro sync` | content collection / env の型を再生成 |

## `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://example.com',
  integrations: [react()],
});
```

`integrations` に追加したものが Astro 起動時に登録される。`astro add <name>` で依存と設定の両方が自動投入される。

## Islands Architecture の基本

`.astro` ファイル内で他フレームワークのコンポーネントを import し、必要な所だけ `client:*` で hydrate する:

```astro
---
import ReactCounter from '../components/ReactCounter.tsx';
---
<ReactCounter client:visible />
```

| ディレクティブ | タイミング |
|---|---|
| `client:load` | ページロード直後 |
| `client:idle` | requestIdleCallback |
| `client:visible` | 要素が viewport に入ったとき |
| `client:media="(max-width: 600px)"` | メディアクエリ一致時 |
| `client:only="react"` | SSR せずクライアント限定で描画 |

何も付けなければ **SSG 時に HTML 化され、JS は出荷されない**。

## Content Collections

`src/content/<collection>/` 配下の Markdown/MDX を型付きで扱う:

```ts
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    pubDate: z.date(),
    tags: z.array(z.string()).optional(),
  }),
});

export const collections = { blog };
```

Astro 6 で **Live Content Collections**（外部データソースの動的取り込み）が追加。6.1 で codec 別 Sharp 画像デフォルトと i18n fallback ルート、6.2 で SVG optimizer API・font ファイル URL ヘルパ・JSON 出力 logger（実験）が追加されている。

## Starlight（ドキュメントテーマ）

Astro 上に構築された「ドキュメントサイト用のオールインワンテーマ」integration。

- 自動サイドバー生成（ファイルベース or 明示設定）
- i18n（ロケール別ルーティング、RTL 対応）
- [Pagefind](https://pagefind.app/) による全文検索が標準搭載
- Cards / Tabs / Steps / Asides 等の内蔵コンポーネント
- MDX / Markdoc 対応、frontmatter スキーマ検証

### 最小設定

```js
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/org/repo' },
      ],
      sidebar: [
        { label: 'Guides', items: [{ slug: 'guides/getting-started' }] },
        { label: 'Reference', autogenerate: { directory: 'reference' } },
      ],
    }),
  ],
});
```

記事は `src/content/docs/` 配下に Markdown で置く。

> **注意**: Starlight の `social` は以前のオブジェクトマップ形式から配列形式（`{ icon, label, href }[]`）に変更済み。古い例を貼り付けると型エラー。

## プロジェクト構造（既定）

```text
src/
├── components/      再利用コンポーネント
├── content/
│   └── docs/        Starlight のコンテンツ（Content Collections）
├── layouts/         レイアウト
├── pages/           ファイルベースルーティング
└── styles/          グローバルスタイル
public/              そのまま配信される静的ファイル
astro.config.mjs
```

## 型検査と CI

`astro build` は型検査しない。CI 側で別途実行する:

```bash
pnpm astro check
pnpm astro build
```

## AI エージェントがよくやるミス

1. **`client:*` なしで React 等を書き、hydrate されず動かない** — 静的 HTML として出力されるのが既定。対話要素は必ず `client:*` を付ける。
2. **`astro build` だけで型安全と思い込む** — 型エラーは `astro check` でないと出ない。
3. **Starlight を `^0.38.0` で入れて minor 破壊変更を踏む** — Starlight は 1.0 未満。`"0.38.3"` のように minor まで固定する。
4. **`src/content/docs/` の直下にロケール混在** — i18n は `src/content/docs/<locale>/` 構造が必須（root locale は `root` キーで設定）。
5. **全ページで `client:load` を付け、Islands の利点を消す** — まず `client:visible` / `client:idle` を検討する。

## 他ツールとの比較

| フレームワーク | 位置付け |
|---|---|
| Astro | コンテンツサイト。SSG 既定、UI 非依存 |
| Next.js | SSR/SSG 両対応。React 専用。アプリ寄り |
| Nuxt | Vue 専用の Next.js 相当 |
| Hugo / Jekyll | 純静的サイトジェネレータ。UI フレームワーク非対応 |
| Docusaurus | React ベースのドキュメントサイト専用（Starlight の比較対象） |
| VitePress | Vue ベースのドキュメント特化 |

## 参考

- [Astro 公式ドキュメント](https://docs.astro.build/)
- [Astro CLI リファレンス](https://docs.astro.build/en/reference/cli-reference/)
- [Islands Architecture](https://docs.astro.build/en/concepts/islands/)
- [Starlight 公式ドキュメント](https://starlight.astro.build/)
- [Starlight: Getting Started](https://starlight.astro.build/getting-started/)
