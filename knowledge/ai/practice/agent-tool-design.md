---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI エージェント向けツール設計（Agent-Computer Interface / ACI）

エージェントの[ループ](loop-engineering.md)を駆動するのはツールであり、**ツールの良し悪しがエージェントの成否を直接左右する**。Anthropic は人間向け UI（HCI）に注ぐのと**同等の労力をエージェント向けインターフェース（ACI: Agent-Computer Interface）に投資せよ**と主張する。本記事はエージェントが使いやすいツールの設計原則をまとめる。

鍵は「**人間やシステム向けの API をそのままラップしない**」こと。従来の API（`getWeather("NYC")` が常に同じ挙動）と違い、エージェントは呼び方を誤る・引数をハルシネートし得る**非決定的な呼び手**である。ツールはこの前提で設計する。

## ACI の基本原則

Anthropic "Building effective agents"（Appendix 2）/ "Writing effective tools for AI agents" より:

- **モデル視点で書く** — 「説明とパラメータを見て使い方が自明か、それとも考え込む必要があるか。考え込むなら、モデルも詰まる」
- **ジュニア開発者向けの docstring のように** — パラメータ命名・説明を、チームの新人に渡す優れた docstring の感覚で書く
- **poka-yoke（ポカヨケ）設計** — 間違えにくいよう引数を変える。実例: SWE-bench でモデルが相対パスを誤るのを発見し、**絶対パス必須**に変えたら完璧に使えるようになった
- 良いツール定義に含めるべきもの: **使用例・エッジケース・入力フォーマット要件・他ツールとの明確な境界**

## ツールの統合（consolidation）

細粒度ツールを乱立させず、**1 ツールが内部で複数の操作をこなす**ように統合する。人間がタスクを分割して解くのと同じ粒度でエージェントが解けるように設計する:

| ✗ 細粒度の乱立 | ✓ 統合された高機能ツール |
|---|---|
| `list_users` + `list_events` + `create_event` | `schedule_event`（空き枠検索 + 予約）|
| 生の `read_logs` | 文脈付きの `search_logs` |
| 個別取得の積み重ね | `get_customer_context`（直近取引 + メモを束ねる）|

## スキーマと命名

- **曖昧さを排除した命名** — `user` より `user_id`。`query_db_orders` / "Execute order query" より `search_customer_orders`
- **namespacing** — プレフィックスで境界を明示（`asana_projects_search` / `notification-send-user` vs `notification-send-channel`）。似た名前のツールは誤選択を招く
- **JSON Schema** — `type` / `properties` / `required`、enum・制約で入力を縛る。[MCP](../platform/mcp-protocol.md) ツールは `name` / `description` / `inputSchema` / 任意の `outputSchema` で定義する
- 名前と description は **Tool Search の一致対象**でもあるため、明確で記述的にすると発見精度が上がる

## エラーの返し方

エラーメッセージはエージェントが**回復に使える**ように設計する。不透明なコードやスタックトレースではなく、エラー応答自体をプロンプトエンジニアリングして**具体的かつ実行可能（actionable）**にする:

- 例外を投げて握りつぶすのでなく、**構造化された回復可能エラー**として返す
- MCP は 2 系統を区別する: **Protocol Error**（JSON-RPC、未知ツール・不正引数）と **Tool Execution Error**（結果に `isError: true` を立て `content` に「API rate limit exceeded」のような説明）
- エラーでトークン効率の良い戦略へ誘導する（例: 広域検索でなくフィルタを使うよう促す）

## ツール数と動的ロードアウト

**「ツールは多いほど良い」とは限らない**。エージェントのコンテキストは有限で、ツールが増えると選択精度が落ち、定義がトークンを食う:

- 似た名前のツールでの**誤選択・誤パラメータ**が最頻の失敗
- ツール定義だけで数万トークンに達する（複数 MCP サーバ構成で数十 K トークンの例）
- 対策の動的ロードアウト:
  - **Tool Search Tool / `defer_loading`** — 重要ツールのみ初期ロードし、必要時に検索して該当定義だけ展開（トークン削減と選択精度向上が報告されている）
  - **Code execution with MCP** — 全定義を前倒しで読まず、MCP サーバをコード API として提示し、エージェントが必要なツールだけ読む

## トークン効率・レスポンス設計

- **high-signal のみ返す** — 文脈的に関連する情報だけ。冗長度を enum パラメータ（例 `concise` / `detailed`）で切り替えさせる
- **ページネーション・フィルタ・truncation** を sensible default 付きで実装。ツール応答にはデフォルト上限（Anthropic 実装例では 25,000 トークン）を設ける
- **識別子返し（just-in-time）** — 詳細を毎回埋め込まず、識別子（[MCP](../platform/mcp-protocol.md) の `resource_link` 等）を返して必要時に取得させる
- 応答構造（XML / JSON / Markdown）はタスクとエージェントで最適が変わるため、評価で経験的に選ぶ

## 評価駆動でツールを磨く

ツール説明の小さな改善が劇的な効果を生む（Anthropic は説明の精緻化後に Claude Sonnet が SWE-bench Verified で SOTA を達成したと報告）。

- 実ワークフローに基づく**現実的・複数ステップのタスクで [eval](agent-evaluation.md) を作り**、agentic loop でプログラム的に走らせて反復改善する
- Claude 自身に評価トランスクリプトを渡し、**ツール定義を分析・リファクタさせる**こともできる

## セキュリティ（MCP 公開時）

- **HITL を挟む** — MCP 仕様は「ツール呼び出しを拒否できる human in the loop を常に置くべき」とする（[Human-in-the-Loop](human-in-the-loop.md)）
- **Tool Poisoning** — ツールの description / パラメータ説明 / `inputSchema` などユーザーに見えにくいメタデータに悪性指示を仕込む間接[プロンプトインジェクション](prompt-injection.md)。LLM はメタデータを ground-truth として扱うため危険。信頼できないサーバの annotations は untrusted として扱う

## アンチパターン

- **人間用 API をそのままツール化** — 非決定的な呼び手を想定せず、誤用を誘発する
- **細粒度ツールを大量に並べる** — 選択精度が落ち、コンテキストを食う。統合と動的ロードアウトを使う
- **生のスタックトレースを返す** — エージェントが回復できない。actionable な構造化エラーにする
- **全ツール出力を丸ごと返す** — トークン浪費。high-signal + ページネーション + 識別子返し
- **ツール説明を雑に書く** — ACI への投資不足。eval で磨く

## 参考

- Anthropic: [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) / [Building effective agents（Appendix 2: ACI）](https://www.anthropic.com/research/building-effective-agents)
- Anthropic: [Advanced tool use（Tool Search / Programmatic Tool Calling）](https://www.anthropic.com/engineering/advanced-tool-use) / [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP ツール仕様（2025-06-18）](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) / [OWASP: Tool Poisoning (MCP03:2025)](https://owasp.org/www-project-mcp-top-10/2025/MCP03-2025%E2%80%93Tool-Poisoning)
- 関連: [ループエンジニアリング](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [エージェント評価](agent-evaluation.md), [プロンプトインジェクション対策](prompt-injection.md), [MCP プロトコル](../platform/mcp-protocol.md)
