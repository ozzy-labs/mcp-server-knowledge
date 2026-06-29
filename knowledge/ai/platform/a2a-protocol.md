---
reviewed: 2026-06-29
tags: [ai-platform, spec, multi-agent]
aliases: [A2A, Agent2Agent, Agent2Agent Protocol]
stability: ga
---

# A2A (Agent2Agent) Protocol

異なるベンダー・フレームワークで構築された自律 AI エージェント同士が、相互に発見し・タスクを委譲し・データを安全に交換するためのオープン標準。Google が 2025-04 に公開し、2025-06-23 に Linux Foundation へ寄贈、中立な長期ガバナンスのもと **Agent2Agent (A2A) Project** として steward されている（Apache-2.0）。

- 公式サイト: <https://a2a-protocol.org>
- 仕様リポジトリ: `a2aproject/A2A`（旧 `google/A2A`）
- 最新仕様: **v1.0.1（2026-05-28）**。初の安定メジャー **v1.0.0 は 2026-03-12**（破壊的変更を複数導入）。

## MCP との関係

[[mcp-protocol]] と**競合せず補完する**。レイヤが異なる。

| | 対象 | 役割 |
|---|---|---|
| **MCP** | エージェント ↔ ツール / リソース | エージェントが能力（DB・API・関数）を**使う** |
| **A2A** | エージェント ↔ エージェント | エージェント同士がタスクで**協働する** |

公式の整理: 「あるエージェントアプリは A2A で他エージェントと通信し、各エージェントは内部で MCP を使って自分のツール/リソースを操作する」。

## 中核概念

| 概念 | 定義 |
|---|---|
| **Agent Card** | A2A Server が公開する JSON メタデータ。識別情報・capabilities・skills・エンドポイント・認証要件を記述。JWS 署名でき、クライアントは信頼前に真正性を検証できる |
| **A2A Server / Client** | Server が Agent Card とサービスエンドポイントを公開、Client がカードを発見してメソッドを呼ぶ |
| **Message** | クライアントとリモートエージェント間の 1 ターン。`messageId` / `role`（user / agent）/ `parts` / `contextId` / `taskId` 等 |
| **Part** | Message / Artifact 内の最小コンテンツ単位。`text` / `data`（構造化 JSON）/ `url`（ファイル参照）/ バイナリ等 |
| **Artifact** | タスク結果としてエージェントが生成する成果物（文書・画像・構造化データ）。複数の Part で構成 |
| **AgentSkill** | Agent Card で広告される個別能力。`id` / `name` / `description` / `tags` / `examples` / per-skill の input/output modes |

### Agent Card の発見

well-known URI（RFC 8615）で公開する:

```text
https://{agent-server-domain}/.well-known/agent-card.json
```

### Task ライフサイクル（v1.0 enum）

- `TASK_STATE_SUBMITTED`（投入済み・キュー待ち）
- `TASK_STATE_WORKING`（処理中）
- `TASK_STATE_INPUT_REQUIRED`（入力待ちで中断）
- `TASK_STATE_AUTH_REQUIRED`（認証待ちで中断）
- 終端: `TASK_STATE_COMPLETED` / `TASK_STATE_FAILED` / `TASK_STATE_CANCELED` / `TASK_STATE_REJECTED`

## トランスポートとメソッド

正準データモデルに対する**機能等価な 3 つのバインディング**を持つ:

1. **JSON-RPC 2.0** over HTTP(S)
2. **gRPC**（Protocol Buffers）
3. **HTTP+JSON / REST**

ストリーミングは **SSE（Server-Sent Events）**、切断中・長時間タスクには **webhook ベースの push notification** を使う。

主要オペレーション（v1.0 で 11 個。括弧内は JSON-RPC バインディングのメソッド名）:

- Send Message (`message/send`) — Task または Message を返す
- Send Streaming Message (`message/stream`) — SSE でリアルタイム更新
- Get Task (`tasks/get`) / List Tasks（フィルタ + ページング）/ Cancel Task (`tasks/cancel`)
- Subscribe to Task（既存タスクへの再購読ストリーミング）
- Push Notification Config の Create / Get / List / Delete
- Get Extended Agent Card（認証付きメタデータ）

## 認証

Agent Card の `securitySchemes` / `security` で宣言する。クライアントは公開された `securitySchemes` のいずれかで認証しなければならない。対応スキーム: API Key / HTTP Auth（Basic・Bearer）/ OAuth 2.0 / OpenID Connect / Mutual TLS。資格情報はバインディング固有の機構（HTTP ヘッダ・gRPC メタデータ等）で送る。

## Agent Card の例

Python SDK 形式（v1.0 は単一 `url` を `supported_interfaces` 配列へ置換）:

```python
public_agent_card = AgentCard(
    name='Hello World Agent',
    description='Just a hello world agent',
    version='0.0.1',
    default_input_modes=['text/plain'],
    default_output_modes=['text/plain'],
    capabilities=AgentCapabilities(streaming=True, extended_agent_card=True),
    supported_interfaces=[
        AgentInterface(protocol_binding='JSONRPC', url='http://127.0.0.1:9999')
    ],
    skills=[
        AgentSkill(
            id='echo_bot',
            name='Echo Bot',
            description='Acknowledges the request and responds with "Hello World".',
            tags=['a2a', 'echo-example'],
            examples=['hi', 'how are you'],
        )
    ],
)
```

> 注: JSON ワイヤ表現のフィールド casing（camelCase の JSON vs snake_case の proto）はバインディングで異なる。正確な JSON サンプルが必要な場合は v1.0 仕様 §8.5 / `spec/a2a.proto` を直接参照する。

## 採用状況（2026-04 時点・Linux Foundation 公表）

- **150+ 組織**が支持（2025-04 ローンチ時の 50+ から増加）、コアリポジトリは 22,000+ stars
- 本番 SDK 5 言語: Python / JavaScript / Java / Go / .NET
- クラウド GA 統合: Microsoft（Azure AI Foundry, Copilot Studio）/ AWS（Bedrock AgentCore Runtime）/ Google Cloud
- 主な支持企業: AWS / Cisco / Google / IBM / Microsoft / Salesforce / SAP / ServiceNow
- 関連: **AP2（Agent Payments Protocol）** — エージェント駆動の決済を扱う補完プロトコル

## 参考

- 公式仕様: <https://a2a-protocol.org/latest/specification/>
- A2A と MCP の比較: <https://a2a-protocol.org/latest/topics/a2a-and-mcp/>
- 仕様リポジトリ（Apache-2.0）: <https://github.com/a2aproject/A2A>
- Linux Foundation プロジェクト発足: <https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents>
