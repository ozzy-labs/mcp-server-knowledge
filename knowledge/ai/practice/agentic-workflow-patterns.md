---
reviewed: 2026-06-07
tags: [ai-workflow, methodology, practice]
---

# Agentic Workflow Patterns（エージェント的ワークフロー・パターン）

AI エージェントが単なる回答ツールを超え、自律的に複雑なタスクを完遂するための設計パターン群。Andrew Ng 氏が提唱した 4 つの基本パターンを核に、2026 年現在は信頼性と可観測性を高めた「構造化されたオーケストレーション」へと進化している。

## 主要な 4 つの基本パターン

| パターン | 概要 | 2026 年の特徴 |
|---|---|---|
| **Reflection** | 生成物を自ら（または別エージェント）が批評し、修正を繰り返す。 | 役割ベースの多角的な批評（Role-based Critique）による高度化。 |
| **Tool Use** | 外部 API、検索、コード実行環境を活用してアクションを実行する。 | **Tool-first 設計**。MCP の普及による高い相互運用性。 |
| **Planning** | 目標をステップに分解し、順次実行する。 | 動的な再計画（Plan-Act-Reflect-Repeat）が主流。 |
| **Multi-agent** | 専門特化した複数のエージェントが協力して遂行する。 | マネージャーによる指揮階層。AI の「マイクロサービス化」。 |

## 2026 年の潮流：プロダクション・レディな設計

実験的なプロンプトから、エンタープライズでの実運用に耐えうる構造へとシフトしている。

### 1. 構造化された状態管理 (State Machines)

創発的な挙動に頼るのではなく、グラフ構造や状態遷移を明示的に定義する。各フェーズの入出力を固定し、予測可能性を確保する（LangGraph や関連ツールの普及）。

### 2. オブザーバビリティ (Observability)

エージェントの思考プロセス、ツール呼び出しの結果、トークン消費量をリアルタイムで監視・可視化する。失敗時の原因特定（デバッグ）を容易にする。

### 3. ガードレールとガバナンス

ワークフローの各ステップに、セキュリティチェックやコンプライアンス検証を自動で挟み込む。重要な判断には [Human-in-the-Loop](human-in-the-loop.md) パターンを組み込む。

## AI エージェントがよくやるミス

1. **無限ループの発生** — Reflection において、改善が見られないまま同じ修正を繰り返し、トークンを浪費する。
2. **不適切なツールの選択** — 利用可能なツールが多すぎる場合に、本来不要な重いツールを選択して実行速度を低下させる。
3. **計画の硬直化** — 最初に立てた計画に固執し、実行中のエラーや状況変化に応じた柔軟な軌道修正ができない。

## 参考

- [Andrew Ng: What's next for AI agentic workflows?](https://www.deeplearning.ai/the-batch/issue-242/)
- 関連: `ai/practice/ai-driven-development.md`, `ai/practice/human-in-the-loop.md`, `ai/platform/mcp-protocol.md`
- 関連（個別パターンの深掘り）: [ループエンジニアリング](loop-engineering.md)（ループ設計）, [ツール設計（ACI）](agent-tool-design.md)（Tool Use）, [エージェント評価](agent-evaluation.md)（Reflection の定量化）, [オブザーバビリティ](agentic-observability.md)（無限ループ・可観測性）, [信頼性・ガードレール](agent-reliability-guardrails.md)
