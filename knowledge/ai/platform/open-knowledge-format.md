---
reviewed: 2026-06-29
tags: [ai-platform, spec, markdown, gcp]
aliases: [OKF, Open Knowledge Format]
stability: research-preview
---

# Open Knowledge Format (OKF)

AI エージェントに渡す「キュレーションされた知識」（テーブル定義・メトリクス計算式・runbook・API 仕様など）を、YAML frontmatter 付き Markdown ファイルのディレクトリとして表現するオープン仕様。Google Cloud が 2026-06-13 に v0.1 を公開した。LLM-wiki パターン（人間も AI も読める知識ベースを Git で管理する）を、特定のベンダー・SDK・ランタイムに依存しないポータブルなフォーマットへ形式化したもの。仕様本体は GitHub（`GoogleCloudPlatform/knowledge-catalog`）に Apache License 2.0 で公開されている。

## 背景と狙い

エージェントを構築するたびに「コンテキスト組み立て」を一から解く問題（社内知識が互いに非互換なシステムに散在する）を解消する。OKF は知識交換のための共通言語（lingua franca）を提供し、システム・組織・ツールをまたいでも知識が生き残るようにする。

- **RAG との違い**: RAG はクエリ時に知識を導出するが、OKF は「バージョン管理されたキュレーション済み concept」をエージェントが直接読み書きする。
- **AGENTS.md との違い**: [[agents-md]] はリポジトリ単位の「エージェントへの指示・方針」、OKF は組織横断で共有する「ドメイン知識のバンドル」。レイヤが異なり競合しない。

## 基本概念

| 用語 | 定義 |
|---|---|
| **Knowledge Bundle** | 知識ドキュメントの自己完結した階層コレクション。交換の単位 |
| **Concept** | 1 つの知識単位を表す単一の Markdown ドキュメント（1 ファイル = 1 concept） |
| **Concept ID** | `.md` を除いたファイルパス（例: `tables/users.md` → `tables/users`） |

concept 同士は Markdown リンクで結ばれ、ディレクトリの親子構造を超えたグラフを形成する。

## ファイル構造

bundle は concept を表す Markdown ファイルのディレクトリ。

```text
sales/
├── index.md
├── datasets/
│   ├── index.md
│   └── orders_db.md
├── tables/
│   ├── index.md
│   ├── orders.md
│   └── customers.md
└── metrics/
    ├── index.md
    └── weekly_active_users.md
```

## frontmatter

各 concept は `---` で区切った YAML frontmatter と自由形式の Markdown 本文で構成する。

| フィールド | 必須 | 内容 |
|---|---|---|
| `type` | **必須**（唯一） | concept の種別を表す記述的文字列（例: `BigQuery Table`, `Playbook`）。値は producer が定義し、中央レジストリには登録しない |
| `title` | 推奨 | 人間可読の表示名 |
| `description` | 推奨 | 1 文の要約 |
| `resource` | 推奨 | 実体アセットを一意に指す URI |
| `tags` | 推奨 | 横断的な分類用の YAML リスト |
| `timestamp` | 推奨 | 最終更新の ISO 8601 日時 |

producer は任意の独自キーを追加してよい（最小限の制約・自由に拡張可能）。

```yaml
---
type: BigQuery Table
title: Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, revenue]
timestamp: 2026-05-28T14:30:00Z
---
```

## 予約ファイル名

| ファイル名 | 役割 |
|---|---|
| `index.md` | frontmatter なしのディレクトリ目次。progressive disclosure（段階的開示）を支援 |
| `log.md` | ISO 8601 日付でグルーピングした時系列の更新履歴 |

予約名以外の `.md` はすべて concept ドキュメントとして扱う。

## リンク規約

- **絶対（bundle 相対）**: `/` で始まるリンクは bundle ルートからの解決。安定性のため推奨。
- **相対**: 通常の Markdown 相対パス。

いずれも型なしの関係を表し、意味は周囲の散文から立ち上がる。

## 適合条件（v0.1）

bundle が OKF v0.1 に適合するのは以下を満たすとき:

1. 予約名以外のすべての `.md` がパース可能な YAML frontmatter を持つ
2. すべての frontmatter が空でない `type` フィールドを含む
3. 予約ファイルが存在する場合、規定の構造に従う

### consumer の義務

consumer（エージェント・ツール）は寛容に振る舞うことが求められる。

- **MUST**: 未知の `type` 値を許容する / 壊れたクロスリンクを許容する / round-trip 時に未知の frontmatter キーを保持する
- **SHOULD**: 未認識フィールドを持つドキュメントを拒否しない / 未認識の OKF バージョンも best-effort で消費する / 適合条件を超える制約はソフトガイダンスとして扱う

この寛容モデルにより、bundle の成長やエージェント生成コンテンツに対して段階的な進化が可能になる。

## リファレンス実装

仕様と併せて以下が公開されている。

- **Enrichment agent**: BigQuery データセットを走査し、スキーマや引用を付けて OKF ドキュメントを起草する
- **静的 HTML ビジュアライザ**: OKF bundle をインタラクティブなグラフビューでレンダリング
- **サンプル bundle**: GA4 e-commerce / Stack Overflow / Bitcoin データセット

## 設計原則

- **Minimally opinioned**: 必須は `type` のみ。コンテンツモデルを規定しない
- **Producer/consumer independence**: フォーマットが契約であり、両端のツールは独立に差し替え可能
- **Format, not platform**: クラウド・DB・モデルプロバイダ・フレームワークに非依存

## 参考

- OKF 仕様（GitHub, Apache-2.0）: <https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf>
- Google Cloud Blog「How the Open Knowledge Format can improve data sharing」: <https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing>
