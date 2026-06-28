---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI エージェントのオブザーバビリティ

自律的に動く AI エージェントの**内部挙動を、外部に出力されるシグナル（トレース・メトリクス・ログ）から理解・デバッグ・改善できる状態**にすること。従来の「LLM オブザーバビリティ（1 回の推論の入出力を見る）」を、**ループ・ツール呼び出し・サブエージェント・長時間実行**を含むエージェント全体へ拡張したもの。本番障害の原因特定、コスト暴走の検知、品質の継続的改善の土台になる。

エージェントは 1 リクエスト＝1 応答ではなく、1 タスクの中で数十の判断・ツール実行・軌道修正を非決定的に行う。障害は「どのステップで・なぜ」壊れたかが見えないと特定できず、個々は正常でも全体で暴走する**創発的な失敗**が起きる。これがオブザーバビリティを設計の必須要素にする理由で、[ループエンジニアリング](loop-engineering.md) の検証・デバッグ要素を支える基盤でもある。

## 何を観測するか

### 3 つのシグナル（エージェント版）

| シグナル | エージェントでの中身 |
|---|---|
| **トレース（最重要）** | 実行ツリー。各 LLM 呼び出し・ツール呼び出し・retrieval・サブエージェントを**ネストした span** として記録し、因果関係を再構成する |
| **メトリクス** | トークン / コスト（USD）/ レイテンシ / タスク成功率 / ツールエラー率 / イテレーション数 |
| **ログ** | 構造化イベント（プロンプト・API リクエスト・ツール結果・エラー）。Claude Code の進捗ログのような素朴な実装もこの一形態 |

### span 階層の典型形

```text
session（ユーザージャーニー全体）
└─ trace（1 タスク = エージェントワークフロー）
   └─ interaction / invoke_agent（ループの 1 ターン）
      ├─ llm_request（モデル呼び出し: model 名・token・latency）
      ├─ execute_tool（ツール呼び出し: 入力・出力・成否・latency）
      └─ invoke_agent（サブエージェント → 同一 trace にネスト）
```

サブエージェント（Claude Code の Task ツール等）の span を親 span 配下にネストさせ、**委譲チェーン全体を 1 trace** にまとめるのがマルチエージェント観測の要。

## OpenTelemetry GenAI セマンティック規約

ベンダー非依存で span 属性を標準化する取り組み。事実上の共通語になりつつあるが、**ステータスは "Development"（experimental）で stable ではない**。属性名は短期間で変わる（例: per-message events を集約属性へ移行、`invoke_agent` を CLIENT/INTERNAL に分割）ため、本番採用時は最新仕様で再確認する。規約は専用リポジトリ [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai) へ分離された。

主な属性・操作名:

- **共通**: `gen_ai.provider.name`（例 `anthropic` / `openai`）, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens` / `output_tokens`, `gen_ai.response.finish_reasons`
- **エージェント**: `gen_ai.agent.id` / `gen_ai.agent.name` / `gen_ai.agent.description`
- **ツール**: `gen_ai.tool.name`, `gen_ai.tool.call.id`
- **`gen_ai.operation.name`**: `chat` / `embeddings`（クライアント系）、`create_agent` / `invoke_agent` / `invoke_workflow` / `plan`（タスク分解）/ `execute_tool`（エージェント系）

> **注意**: Arize の **OpenInference** は OTel 公式 `gen_ai.*` とは別系統の LLM span 規約。両者は補完／競合の関係にあるため、ツール選定時にどちらのスキーマかを確認する。

コンテンツ（プロンプト本文・ツール引数）は**既定で非記録**。記録は「非記録 / span 属性に格納 / 外部ストレージ + 参照」の 3 モードから opt-in で選ぶ。

## エージェント特有のシグナルとアラート

- **ツール呼び出しの成否・引数のハルシネーション** — 全呼び出しを input/output/latency/status 付きで記録
- **ループのイテレーション数・終了理由** — 無駄な反復（runaway loop）の検知。[loop engineering](loop-engineering.md) の停止条件と対になる
- **コンテキスト窓の使用率・溢れ（context overflow）** — compaction の発生
- **ガードレール発火 / プロンプトインジェクション** — 入力がサブエージェントに届く前にスクリーニング（[プロンプトインジェクション対策](prompt-injection.md)）
- **Human-in-the-loop の介入回数** — 高リスク判断の注釈（[HITL パターン](human-in-the-loop.md)）

最優先で張るべきアラートは **「ツール呼び出しループ」と「コンテキスト溢れ」**。どちらも silent failure になりやすく、最もコストが高い。各エージェントに**ステップ数・経過時間・総トークン・ツール呼び出し数の明示的な予算（budget）**を定義し、超過でアラートする。

## オンライン監視 ⇄ オフライン評価の閉ループ

オブザーバビリティの価値は監視だけで終わらない。**本番トレースを改善に回す閉ループ**が本質:

```text
本番トレース ─▶ failure を注釈 ─▶ データセット化 ─▶ eval ─▶ プロンプト/ツール改善 ─▶ 回帰テスト
      ▲                                                                              │
      └──────────────────────────────────────────────────────────────────────────┘
```

- **LLM-as-judge** — 簡潔性・忠実性・ハルシネーションなど主観基準を別の LLM でスコアリング。客観基準は code-based eval で補う
- **single-turn / multi-turn を区別** — マルチターンではユーザー目標の達成・コンテキスト保持を評価
- スコアを trace に逆付与し、回帰テストで再発を防ぐ

## Claude Code の OpenTelemetry サポート

Claude Code / Agent SDK は OTel を組み込みでサポートする（既定オフ。`CLAUDE_CODE_ENABLE_TELEMETRY=1` + 最低 1 つの exporter で有効化）。送出先として Honeycomb / Datadog / Grafana / Langfuse / self-hosted collector を公式に明記。

| シグナル | 環境変数 | 内容 |
|---|---|---|
| Metrics | `OTEL_METRICS_EXPORTER` | `claude_code.token.usage` / `cost.usage`（input/output/cache のトークン・USD・セッション・追加削除行数・編集の accept/reject）|
| Logs | `OTEL_LOGS_EXPORTER` | prompt / API request / API error / tool result の構造化レコード |
| Traces（**beta**）| `OTEL_TRACES_EXPORTER` + `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` | span: `claude_code.interaction` → `llm_request` / `tool`（子 span に権限待ち `blocked_on_user`・`execution`）/ `hook` |

- **trace context 連携**: SDK が W3C trace context（`TRACEPARENT` / `TRACESTATE`）を CLI・Bash 子プロセスへ自動伝播し、アプリ側 span 配下に `claude_code.interaction` をネストする
- **サブエージェント**: Task ツールの span は親の `claude_code.tool` 配下にネスト＝委譲チェーン全体が 1 trace
- **監査・秘匿**: 既定は構造（duration / model 名 / tool 名）のみ。本文はオプトイン（`OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_TOOL_DETAILS=1` 等）。end-user 識別子を resource attribute に注入して per-user 監査証跡を SIEM へ転送できる

> span 名は `claude_code.*` 独自命名で、OTel 公式 `gen_ai.*` 規約への準拠は公式ドキュメント上では明示されていない（traces は beta で属性が変わりうる）。

## 主要ツール／プラットフォーム

| ツール | OSS | OTel | 特徴 |
|---|---|---|---|
| **Langfuse** | OSS（self-host 可）| ネイティブ（OTLP 受信）| observability + evals + prompt mgmt + datasets |
| **Arize Phoenix** | OSS（API キー不要）| OTel + OpenInference | self-host トレース + `phoenix.evals`（faithfulness/hallucination/toxicity）|
| **OpenLLMetry**（Traceloop）| OSS（Apache 2.0）| OTel 上に構築 | 非侵襲 instrumentation。任意の OTel backend へ送出 |
| **LangSmith** | SaaS | あり（中立オプション）| LangChain/LangGraph と密結合。eval・回帰テスト |
| **Datadog LLM Observability** | SaaS | `gen_ai.*` v1.37+ ネイティブ | Collector で redaction/sampling/enrichment |
| **Helicone** / **W&B Weave** / **Braintrust** | 一部 OSS/SaaS | 概ね対応 | ゲートウェイ型 / ML 統合 / 実験・eval 寄り |

OSS で自前運用するなら **Langfuse / Phoenix / OpenLLMetry**、既存 APM に寄せるなら **Datadog / Grafana + OTel Collector** が起点になる。

## ベストプラクティス

- **最適化の前にまず全面 instrument** — trace ID をセッション全体に張り、個々の呼び出しでなく全体を 1 trace にまとめる
- **PII / 機微情報は既定オフ + Collector で redaction** — データがネットワークを出る前に OTel Collector の processor で redaction / sampling / enrichment を適用する
- **コスト属性を LLM 呼び出し単位で付与** — agent / model / route 別にトークンを集計し、予算超過でアラート
- **サンプリングは Collector レイヤで** — 高 throughput でのコストを抑える

## アンチパターン

- **最終出力だけログする** — どのステップで壊れたか分からず、ループ・ツールの失敗を見逃す
- **トークン/コストを測らない** — runaway loop や context overflow による課金暴走に気づけない
- **本番トレースを監視で終わらせる** — eval データセットに回さないと品質が改善しない
- **プロンプト全文を無条件記録** — PII 漏洩・ストレージ肥大。opt-in + redaction が前提

## 参考

- OpenTelemetry: [GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) / [semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai)
- Claude Code Docs: [Observability with OpenTelemetry](https://code.claude.com/docs/en/agent-sdk/observability)
- Datadog: [Supporting the OTel GenAI semantic conventions](https://www.datadoghq.com/blog/llm-otel-semantic-convention/)
- Langfuse: [OpenTelemetry integration](https://langfuse.com/integrations/native/opentelemetry) / Arize: [Phoenix docs](https://arize.com/docs/phoenix) / Traceloop: [OpenLLMetry](https://www.traceloop.com/openllmetry)
- LangChain: [Agent Observability](https://www.langchain.com/resources/agent-observability)
- 関連: [ループエンジニアリング](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [AI エージェントのコンテキスト管理](ai-context-management.md), [プロンプトインジェクション対策](prompt-injection.md)
