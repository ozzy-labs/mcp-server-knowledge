---
reviewed: 2026-06-29
tags: [ai-platform, spec, markdown]
aliases: [llms.txt, llms-full.txt]
stability: ga
---

# llms.txt

Web サイトが LLM 向けに「キュレーションした Markdown コンテキスト」を提供するためのオープン提案。サイトルートに `/llms.txt`（Markdown ファイル）を置き、そのサイトを理解するうえで重要なコンテンツへの厳選リンク集を、人間にも LLM にもパーサにも読める構造で記述する。Jeremy Howard（Answer.AI）が 2024-09-03 に提案。HTML（ナビ・広告・JS）を LLM 用テキストに変換するのは不正確で、コンテキストウィンドウにサイト全体は入りきらないという問題に対し、「サイト著者が最良を知っている」という前提で著者自身に高シグナルな索引を書かせる。

仕様は <https://llmstxt.org/>、リポジトリは `AnswerDotAI/llms-txt`（Apache-2.0）。

## 配置とファイル名

- **`/llms.txt`**: サイトルートに置く Markdown ファイル（例: `https://example.com/llms.txt`）。サブパスにも置ける。
- **個別ページの Markdown 版**: URL に `.md` を付与したクリーンな Markdown を併せて提供する（例: `page.html.md`）。ファイル名のない URL は `index.html.md` を使う。
- **`llms-ctx.txt` / `llms-ctx-full.txt`**: 公式 CLI `llms_txt2ctx` が `llms.txt` を展開して生成するコンテキストファイル。前者は `Optional` セクションを除外、後者は含める。
- **`llms-full.txt`**: ドキュメント全文を 1 ファイルに inline する**コミュニティ/プラットフォーム慣習**（Mintlify 等が普及させた）。**正式仕様には含まれない**点に注意。`llms.txt` が軽量な索引（〜10–20 リンク）なのに対し、`llms-full.txt` は全文を抱える。

## ファイルフォーマット

Markdown だが、コードによる厳密なパースも意図した固定構造を持つ。順序（**必須は H1 のみ**）:

1. （任意）BOM
2. **H1**: プロジェクト/サイト名 — **唯一の必須要素**
3. **blockquote (`>`)**: 残りを理解するのに必要な短い要約（推奨）
4. **自由形式 Markdown**: 見出し以外の任意のブロック（段落・リスト等）で背景や注意を補足
5. **H2 (`##`) セクション**: 各セクションは「ファイルリスト」を含む
6. **リスト項目**: 各 H2 内の Markdown リスト。各項目は**必須の Markdown リンク `[name](url)`** + 任意で `:` に続く説明文

### `## Optional` の特別な意味

H2 見出しが文字どおり `Optional` のセクションは、**二次的で、短いコンテキストが必要なときは省略してよい** URL 群を表す。`llms_txt2ctx` のデフォルト生成はこれを除外し、フル生成のみ含める。

```markdown
# FastHTML

> FastHTML is a python library which brings together Starlette, Uvicorn,
> HTMX, and fastcore's `FT` "FastTags" into a library for creating
> server-rendered hypermedia applications.

Important notes:

- Although parts of its API are inspired by FastAPI, it is *not*
compatible with FastAPI syntax and is not targeted at creating API services

## Docs

- [FastHTML quick start](https://fastht.ml/docs/tutorials/quickstart_for_web_devs.html.md): A brief overview of many FastHTML features

## Examples

- [Todo list application](https://example.com/adv_app.py): Detailed walk-thru of a complete CRUD app

## Optional

- [Starlette full documentation](https://example.com/starlette-sml.md): Useful subset for FastHTML
```

最小の有効ファイルは `# Project Name` の H1 1 行だけでよい。

## 消費の実態（2026-06 時点）

**主要モデルプロバイダのクローラは `/llms.txt` を自動取得していない。**

- Google は llms.txt を**サポートしないと明言**（2025-07、Gary Illyes）。SEO ランキング上の価値はないという立場。
- GPTBot / ClaudeBot / PerplexityBot 等の AI クローラも大半が HTML を直接クロールし、このファイルを参照しない。第三者調査では公開サイトの採用率は約 1 割程度（ベンダー由来の数値のため目安）。
- **実利用は IDE / コーディングエージェントのオンデマンド取得**が中心。Cursor / Windsurf / Claude Code / GitHub Copilot / Cline / Aider 等が、ユーザーがドキュメント URL を明示的に指したときに取得する。つまり「プロバイダが自動発見」ではなく「エージェントが明示参照」する消費モデル。
- ドキュメントプラットフォーム（Mintlify, GitBook 等）が `llms.txt` / `llms-full.txt` を自動生成する。

> 注: 採用率やクローラ挙動の定量データは SEO/解析ベンダー由来で、プロバイダ自身の公表ではない。定性的事実（Google の非サポート、プロバイダ非自動取得、コーディングエージェントのオンデマンド利用）は複数ソースで裏が取れている。

## 類似フォーマットとの対比

| 対象 | 目的 | llms.txt との違い |
|---|---|---|
| `robots.txt` | クロール可否のアクセス制御 | llms.txt はアクセス制御せず、推論時の**コンテンツ案内**。補完関係 |
| `sitemap.xml` | 全 URL の網羅列挙（検索インデックス用） | llms.txt は**厳選した高シグナルな部分集合**。sitemap は LLM 用 Markdown を提供せず量も多すぎる |
| [[open-knowledge-format]] (OKF) | 型付き概念ドキュメントの知識ライブラリ | llms.txt はサイト内容へ誘導する**単一の索引/道標**、OKF は frontmatter 付きの**構造化知識バンドル** |

llms.txt（玄関の道標）/ OKF（中の図書館）/ [[mcp-protocol]]（要求に応じて取りに行く司書）という重なる（競合しない）レイヤとして整理されることが多い。

## 参考

- 公式仕様: <https://llmstxt.org/>
- リポジトリ（Apache-2.0）: <https://github.com/AnswerDotAI/llms-txt>
- Answer.AI 提案記事: <https://www.answer.ai/posts/2024-09-03-llmstxt.html>
