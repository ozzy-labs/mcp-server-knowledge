---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI エージェントのメモリ（Agent Memory）

AI エージェントが**会話やタスクの経験を保持し、後で参照できるようにする**仕組み。[コンテキスト管理](ai-context-management.md) が「コンテキスト窓（短期）をいかに最適化するか」を扱うのに対し、本記事は「**窓の外に何をどう永続させ、いつ読み戻すか**（長期）」を扱う。[ループエンジニアリング](loop-engineering.md) の State / Memory 要素を支える土台で、会話を超えてループを継続させる前提になる。

## 短期記憶 vs 長期記憶

| | 短期記憶（working memory）| 長期記憶（long-term）|
|---|---|---|
| スコープ | スレッド／単一セッション内 | 複数スレッド／セッション横断で永続 |
| 実体 | コンテキスト窓内の会話履歴 | 外部ストア（任意のスレッドから取得）|
| 寿命 | セッション終了でリセット | 永続（明示的に削除するまで）|

### 認知科学由来の 3 分類（アナロジー）

人間の長期記憶の分類を借用したもので、厳密対応ではなく**アナロジー**である点に注意（LangChain / LangMem が公式に採用）:

- **意味記憶（semantic）** — 事実・概念（ユーザープロファイル、ドキュメント集合）
- **エピソード記憶（episodic）** — 過去の経験・出来事（対話の要約、成功例の few-shot）
- **手続き記憶（procedural）** — タスク遂行方法（prompt・コード・モデル重み。Reflection で洗練）

## 長期記憶の実装方式

| 方式 | 概要 |
|---|---|
| **ベクトルストア / 埋め込み検索** | メモリを document として保存し semantic search で取得。直接的な質問に強い |
| **知識グラフ** | 実体（node）と関係（edge）で保存。multi-hop の関係クエリに強い。**時間的 KG**（Zep / Graphiti）は各 edge に validity interval を持ち非破壊更新 |
| **要約 / 構造化ノート** | 会話を要約して保持（Anthropic の structured note-taking）|
| **ファイルベース** | 外部ファイルとして create/read/update/delete（Anthropic memory tool の `/memories`）|
| **key-value ストア** | 階層メモリ（CrewAI: long-term=SQLite, short-term=ChromaDB+RAG 等）|

### RAG との違い

RAG が「**静的なドキュメント検索**による拡張」一般を指すのに対し、エージェントメモリは「対話・経験を**書き込み・更新・統合**し横断利用する」点でより動的（各社の主張に基づく整理）。直接的な質問は vector、関係を辿るクエリは graph が向き、どちらか単独では不十分とされる。

## メモリの操作

- **書き込み** — *hot path*（実行中にリアルタイム生成、即利用可だが遅延増）と *background*（非同期形成、遅延低だがトリガ設計が必要）の 2 方式。何を記憶するかの抽出・反省が要
- **読み出し** — namespace + key 階層から semantic search / フィルタで取得
- **更新・統合（consolidation）** — 既存メモリとの**競合検出・解決**で統合（Mem0）。OpenAI ChatGPT は背景処理 "dreaming" で履歴から自動キュレーション
- **忘却（decay / 削除）** — 明示的な削除や memory expiration。**decay 機構がないとノイズが蓄積し性能劣化**する

## MemGPT / 仮想コンテキスト管理

論文 **MemGPT: Towards LLMs as Operating Systems**（arXiv:2310.08560, 2023）が提唱した **virtual context management**。OS の階層的メモリ（高速↔低速メモリ間のページングで大容量に見せる）を着想源に、function calling で**エージェントが自身のコンテキストを読み書き**し、限られた窓を超えた拡張コンテキストを提供する。

この OS 的階層は後継の **Letta** に実装されている:

```text
main context    … 毎ターン見える working memory（編集可能な memory block）
recall storage  … 最近の履歴（検索可）
archival storage … 外部 DB の長期知識
```

## コンテキストエンジニアリングとの境界

Anthropic は短期（窓内）と長期（永続）の使い分けを次のように整理する:

- **context rot** — コンテキストが伸びるほど性能が劣化する。これが短期最適化の必要な理由
- **compaction（圧縮）** — 窓上限に近づいたら会話履歴を要約（重要な設計判断は保持、冗長な出力は破棄）。**窓を小さく保つ＝短期**
- **memory** — 要約で失われては困る情報を外部に**永続化＝長期**
- **just-in-time loading** — 軽量な識別子（パス・URL）を保持し、実行時にツールで動的取得する
- **context editing** — クライアント側で古い tool call/result を窓内から自動クリア

長期に走るエージェントでは compaction と memory の**両方を併用**するのが推奨。詳細は [コンテキスト管理](ai-context-management.md) を参照。

## フレームワーク／製品の実装

| 実装 | OSS | 特徴 |
|---|---|---|
| **LangGraph / LangMem**（LangChain）| OSS | short-term=checkpoint、long-term=BaseStore。semantic/episodic/procedural と Memory Manager |
| **Mem0** | OSS + マネージド | vector（既定 pgvector）+ optional graph（Mem0g）、user/session/agent 階層 |
| **Letta**（旧 MemGPT）| OSS | main/recall/archival の OS 的 3 層。エージェントが tool で自己編集 |
| **Zep / Graphiti** | マネージド + OSS エンジン | 時間的知識グラフ（bi-temporal）|
| **CrewAI memory** | OSS | short（ChromaDB+RAG）/ long（SQLite）/ entity / contextual を `memory=True` で有効化 |
| **OpenAI ChatGPT memory** | 製品 | saved memories + chat history 参照、背景処理 "dreaming" |
| **Anthropic memory tool**（`memory_20250818`）| 製品（クライアント側実装）| `/memories` のファイル操作。Claude 4 以降で GA、ストレージはユーザー管理 |

Claude Code の `CLAUDE.md`（プロジェクト指示）や auto-memory（`MEMORY.md`）も「外部ファイルに知識を退避し都度読み戻す」点で思想は同系だが、API の memory tool との正式な実装的関係は公式文書では明示されていない。

## ベストプラクティス・課題

- **何を覚え何を捨てるか** — 「望む結果を最大化する**最小の high-signal トークン集合**」を原則とし、トピックに関連する情報のみ記録する
- **メモリ汚染（retrieval pollution）** — append-only ストアの中核的弱点。**memory hallucination**（幻覚を真実として保存）や **temporal obsolescence**（正しいが古い情報）が失敗モード。純粋な意味的類似度では「5 分前」と「5 週間前」の同義メモリを区別できない
- **consolidation と decay は長期健全性に必須** — 無制限に増える生ログは推論時間・検索ノイズ・プライバシーリスクを増やす
- **プライバシー / 監査可能な忘却** — 機微情報を必要以上に保持しない。path traversal 防止・書き込み前フィルタ・サイズ上限・expiration（Anthropic memory tool のセキュリティ責務）

## アンチパターン

- **生ログを無制限に貯める** — consolidation/decay なしではノイズと劣化を招く
- **意味的類似度だけで検索する** — 時間的鮮度を無視し、古い情報を最新として取り出す
- **短期と長期を混同する** — 何でもコンテキスト窓に積む。永続すべきものは外部メモリへ、使い捨ては compaction で
- **機微情報を無条件に記憶する** — プライバシーリスク。書き込み前にフィルタする

## 参考

- Anthropic: [Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) / [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) / [Context management](https://anthropic.com/news/context-management)
- 論文: [MemGPT arXiv:2310.08560](https://arxiv.org/abs/2310.08560) / [Zep arXiv:2501.13956](https://arxiv.org/html/2501.13956v1) / [Mem0 arXiv:2504.19413](https://arxiv.org/pdf/2504.19413)
- フレームワーク: [LangChain Memory overview](https://docs.langchain.com/oss/python/concepts/memory) / [LangMem](https://www.langchain.com/blog/langmem-sdk-launch) / [Letta: Agent Memory](https://www.letta.com/blog/agent-memory/) / [CrewAI Memory](https://docs.crewai.com/en/concepts/memory) / [Mem0](https://docs.mem0.ai/)
- 関連: [AI エージェントのコンテキスト管理](ai-context-management.md), [ループエンジニアリング](loop-engineering.md), [AI エージェントのオブザーバビリティ](agentic-observability.md), [Anthropic API](../platform/anthropic-api.md)
