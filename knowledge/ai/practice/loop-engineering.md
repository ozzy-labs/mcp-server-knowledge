---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# ループエンジニアリング（Loop Engineering）

AI エージェントを「自分が毎回プロンプトを打って動かす対象」ではなく、「**自律的に回り続けるループとして設計する対象**」へと捉え直す実践。コーディングエージェントが十分賢くなった結果、開発者の付加価値は「良いプロンプトを書くこと」から「**エージェントが回るループ（停止条件・検証・回復・状態）を設計すること**」へ移った、という認識を出発点とする。

2026 年に Addy Osmani が "Loop Engineering" として体系化・命名した比較的新しい用語で、Anthropic の Boris Cherny（「もう Claude にプロンプトしない。Claude にプロンプトするループを回している」）や Peter Steinberger（「コーディングエージェントにプロンプトするのをやめ、ループを設計すべき」）の発言を引いて整理されたコミュニティ／実務発の概念。学術的に確立した定義ではない。エージェント設計パターン全般は [Agentic Workflow Patterns](agentic-workflow-patterns.md)、コンテキスト窓の使い方は [AI エージェントのコンテキスト管理](ai-context-management.md) を参照。

## prompt / context engineering との位置づけ

| 関心の中心 | 何を設計するか |
|---|---|
| **Prompt engineering** | 1 回の入力。指示の言い回し・例示・出力形式 |
| **Context engineering** | 推論時にコンテキスト窓へ載せるトークンの取捨選択（curation） |
| **Loop engineering** | エージェントが回る**反復サイクルそのもの**。起動・ツール・検証・停止・回復・状態 |

3 者は排他ではなく層をなす。ループの各イテレーション内側で context engineering が効き、各ステップの指示で prompt engineering が効く。なお「prompt → context → loop」という段階進化フレームは二次解説で広く使われるが、一次情報で明示された段階論ではない点に注意。

## エージェントループとは何か

Anthropic は agent を最小限の言葉でこう定義する：

> LLMs autonomously using tools in a loop.（LLM が自律的にツールをループで使うこと）

ここで重要なのが **agent と workflow の区別**（Anthropic "Building Effective Agents"）：

- **Workflow** — LLM とツールが**事前定義されたコードパス**でオーケストレーションされる（制御は人間が書いたコード側）
- **Agent** — LLM が**自身のプロセスとツール使用を動的に指示**し、達成方法の制御を保持する

エージェントは「環境からのフィードバックに基づきツールを使う LLM がループで動く」だけのものであり、各ステップで環境から **ground truth**（ツール結果・コード実行結果）を得て進捗を評価することが要になる。ReAct（Yao et al., 2022）の thought → action → observation の反復が、このループの学術的な原型。

## 典型的なループサイクル

Claude Code 公式ドキュメントは、エージェントが 3 つのフェーズを混ぜ合わせながら反復すると説明する：

```text
┌─────────────────────────────────────────┐
│  gather context  →  take action  →  verify  │
└──────────────△──────────────────────┬───┘
               └──── 前ステップの学びで軌道修正 ◀┘
```

- **gather context（文脈収集）** — ファイル検索・読込・ツール呼び出しで現状を把握
- **take action（行動）** — 編集・コマンド実行。各ツール結果が次の判断にフィードバックされる
- **verify（検証）** — テスト・型チェック・期待出力との突合で自分の成果を確認
- これを完了まで反復し、前ステップで学んだことを次に活かして course-correct する

エージェント本体（CLI 側）はこのループを回す**ハーネス（agentic harness）**と位置づけられる。ループの良し悪しは「ツールとループをいかに丁寧に設計するか」で決まる（Simon Willison "Designing agentic loops"）。

## ループ設計の構成要素

### 1. 停止条件（termination / stop conditions）

無限ループとトークン浪費を防ぐ要。「goal を達成する」という定義自体が停止条件の存在を含意する。

- タスク完了で自然終了するのが基本だが、**最大反復回数**などの停止条件を明示的に入れて制御を保つ（Anthropic）
- コストのかかるツールには**予算上限（budget limit）**を設定する（Willison）
- 達成判定を別の小型モデル／チェックに委ねる構成（例: 条件が真になるまで継続）も使われる

### 2. 検証フィードバックループ（verification / self-correction）

エージェントは**自分の成果を検証できると性能が上がる**。ループに「正解と突き合わせる手段」を組み込むことが投資対効果が最も高い。

- テストスイート・スクリーンショット・期待出力など、**検証対象（verify against）**を与える
- 「機能実装の前にまず end-to-end テストを通す」など、検証を先に据える（Anthropic "Effective harnesses for long-running agents"）
- Reflection（生成物を自己／別エージェントが批評して直す）は検証ループの一形態。詳細は [Agentic Workflow Patterns](agentic-workflow-patterns.md)

### 3. エラー回復（error recovery）

長く回るループでは失敗からの復帰経路を最初から用意する。

- **git で不良変更を revert** し動作状態へ戻せるようにする（Anthropic）
- 「壊れた状態のまま放置されていないか」を素早く検知できる仕組み（ヘルスチェック・チェックポイント）
- Claude Code の編集はチェックポイントで可逆

### 4. 状態・メモリ（state / memory）

会話の外で進捗を持続させる。コンテキスト窓を超えてループを継続させる土台。

- **進捗ログファイル**（例: `claude-progress.txt`）に「何をしたか」を残し、セッション終了時に commit + 進捗更新（Anthropic）
- コンテキスト管理（compaction・サブエージェント・just-in-time ロード）は [AI エージェントのコンテキスト管理](ai-context-management.md) を参照

### 5. 観測可能性（observability）

ループが暴走・空回りしていないかを見える化する。思考・ツール呼び出し・トークン消費の追跡。一次資料では「進捗ログ」という実装として現れることが多く、OpenTelemetry 等の本格的なエージェント可観測性は発展途上。

### 6. ヒューマン・イン・ザ・ループ（HITL）

完全自律と人間の制御のバランス。

- チェックポイントやブロッカー遭遇時に**人間のフィードバックのため停止**する（Anthropic）
- 承認デフォルト運用 ↔ 全自動（"YOLO mode"）はトレードオフ。全自動は生産的だが危険なので **Docker / リモート環境でのサンドボックス化**と**限定権限の認証情報（tightly scoped credentials）**で隔離する（Willison）
- 設計の詳細は [Human-in-the-Loop パターン](human-in-the-loop.md)

## ループを組み立てる実装要素

Osmani は「プロンプトを打つ自分」を置き換える具体的な部品として以下を挙げる。多くは既存記事に対応する。

| 要素 | 役割 | 関連記事 |
|---|---|---|
| **Automations / スケジュール起動** | ループを定期・トリガー駆動で回す | [AI エージェントの定期実行](scheduled-tasks.md) |
| **Worktrees** | 並列エージェントを git worktree で分離 | — |
| **Skills** | プロジェクト知識をコード化して常時参照 | [Agent Skills 仕様](../platform/agent-skills-spec.md) |
| **Plugins / connectors** | MCP ベースでツールを統合 | [MCP プロトコル](../platform/mcp-protocol.md) |
| **Sub-agents** | 着想と検証を別コンテキストに分離 | [マルチエージェント協調](multi-agent-coordination.md) |
| **State / Memory** | 会話外で進捗を永続トラッキング | [コンテキスト管理](ai-context-management.md) |

「LLM + ループ + 十分なトークン」だけで実用エージェントが組める（Thorsten Ball "How to Build an Agent" は 400 行未満で実証、Geoffrey Huntley の "Ralph Loop" は同一プロンプトを `while :; do … done` で反復投入する単純なシェルループ）という観察も、ループそのものが価値の中心だという主張を裏づける。

## アンチパターン

- **停止条件のないループ** — 改善が出ないまま同じ修正を繰り返しトークンを浪費する（[Agentic Workflow Patterns](agentic-workflow-patterns.md) の「無限ループ」）
- **検証手段のないループ** — verify 対象（テスト・期待出力）が無いと、エージェントは自分の誤りに気づけない
- **回復経路の欠如** — revert / チェックポイントが無いと、一度壊れた状態から戻れず破壊が累積する
- **観測なしの全自動** — ログも承認も無い YOLO 運用を、限定権限・サンドボックス無しの本番環境で回す
- **ループ化の過剰適用** — 単発で済むタスクまでループ／自動化で包む。[Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) の「最も単純な解から始め、必要なときだけ複雑性を上げる」原則に反する

## 参考

- Anthropic: [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)（2024-12、agent / workflow の区別、stopping conditions、ACI）
- Anthropic: [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)（2025-09-29、"LLMs autonomously using tools in a loop"、compaction / sub-agent / just-in-time）
- Anthropic: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)（2025-11-26、検証ツール・git revert・進捗ログ）
- Claude Code Docs: [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)（gather context → take action → verify、agentic harness）
- Addy Osmani: [Loop Engineering](https://addyosmani.com/blog/loop-engineering/)（2026-06-07、用語の体系化）
- Simon Willison: [Designing agentic loops](https://simonwillison.net/2025/Sep/30/designing-agentic-loops/)（2025-09-30、ループ設計・予算上限・サンドボックス）
- Thorsten Ball: [How to Build an Agent](https://ampcode.com/notes/how-to-build-an-agent)
- Yao et al.: [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)（thought / action / observation ループの原典）
