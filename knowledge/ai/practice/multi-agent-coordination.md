---
reviewed: 2026-06-07
tags: [ai-workflow, multi-agent, methodology]
---

# Multi-agent Coordination Patterns（マルチエージェント協調パターン）

複雑な課題を単一の LLM モデルで解決するのではなく、専門特化した複数のエージェントを組み合わせ、それらが相互に影響し合いながら目標を達成するための設計パターン。Anthropic が 2026 年 4 月に公開した技術指針に基づき、以下の 5 つのコアアーキテクチャに分類される。

## 5 つのコアアーキテクチャ

### 1. Generator-Verifier（生成・検証型）

「生成」を行うエージェントと、その出力を特定の基準で「検証」するエージェントを組み合わせる。

- **Workflow**: 検証エージェントが却下した場合、フィードバックと共に生成エージェントに戻して修正させる。
- **Best for**: コード生成（記述＋テスト実行）、ファクトチェック、コンプライアンス確認。
- **注意点**: 検証基準が曖昧だと、エージェント間で「自己欺瞞のループ」に陥るリスクがある。

### 2. Orchestrator-Subagent（指揮・サブエージェント型）

中央の「オーケストラ指揮者」がタスクを分解し、短命なサブエージェントに委譲・集約する。

- **Workflow**: サブエージェントはタスク完了後に消滅する。**Claude Code** の基本構造。
- **Best for**: 依存関係の少ない並列タスク（例：メイン作業を続けながらのコードベース検索）。

### 3. Agent Teams（エージェント・チーム型）

Orchestrator 型に似ているが、サブエージェントに「永続性（Persistence）」を持たせる。

- **Workflow**: 各エージェントが長期的な「同僚」としてドメイン知識を蓄積し続ける。
- **Best for**: 大規模なコードベース移行など、モジュールを跨いでコンテキストを維持する必要がある継続的プロジェクト。

### 4. Message Bus（メッセージ・バス型）

エージェント同士が Publish/Subscribe 形式のイベントシステムで連携する。

- **Workflow**: 既存の配線を変更せずに新しいエージェントを追加可能。「特定のイベント」をトリガーに自律的に動く。
- **Best for**: セキュリティ運用（SOC）など、アラートの種類と対応策が動的に変化するパイプライン。

### 5. Shared State（共有状態型）

中央管理者を置かず、すべてのエージェントが共通のデータベースやファイルシステムを読み書きする。

- **Workflow**: 他のエージェントの発見をリアルタイムで相互に利用し、探索を進める。
- **Best for**: 科学的リサーチや未知のバグ調査など、発見が次の調査に直結する協調探索。

## 戦略的テイクアウェイ (Anthropic 2026)

- **Delegation Gap（委譲のギャップ）**: 開発者は作業の 60% に AI を使っているが、完全に委譲できているのは 0〜20% に過ぎない。これらのパターンはこのギャップを埋めるための構造である。
- **Neuro-symbolic 連携**: 高リスクなドメインでは、確率的な AI パターンの前段または並列に、ルールベースの「決定論的レイヤー（Deterministic layer）」を置いて制約を強制することを推奨。
- **トークン効率**: マルチエージェント化は単一エージェントに比べ 3〜10 倍のトークンを消費する。「雰囲気でのマルチエージェント化」を避け、単一エージェント＋適切なツールで済む場合はそれを優先すべきである。

## 2026 年の実装トレンド

- **Agent SDK の成熟**:
  - **Claude Agent SDK**（旧 Claude Code SDK、2025 年 9 月改称）: Claude Code を支える汎用エージェント基盤をライブラリ化。サブエージェントを隔離コンテキストのツールとして呼び出し、オーケストレーションを最小化。2026 年には Dynamic Workflows（research preview）で 1 run あたり最大 1,000 サブエージェント（同時最大 16）の並列駆動に到達。
  - **OpenAI Agents SDK**: Handoff ベースの制御移譲と永続メモリを標準化（前身の実験的 Swarm を置き換える本番向け進化版）。
- **Model Tiering**: ルーティングに Haiku 4.5、推論に Opus 4.8（現行フラグシップ）を使い分けるコスト・速度最適化。
- **MCP 2.0**: フレームワークを跨いでエージェントがツールとコンテキストを共有するための共通言語。

## 参考

- [Anthropic: Multi-agent coordination patterns: Five approaches and when to use them (2026)](https://claude.com/blog/multi-agent-coordination-patterns)
- [OpenAI: Agents SDK Documentation](https://developers.openai.com/api/docs/guides/agents)
- 関連: [`ai/practice/agentic-workflow-patterns.md`](agentic-workflow-patterns.md), [`ai/practice/multi-agent-repo.md`](multi-agent-repo.md)
