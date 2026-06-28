---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI エージェントの評価（Agent Evaluation / eval）

AI エージェントが**タスクを正しく・信頼性高く遂行できているかを定量的に判定する**営み。[オブザーバビリティ](agentic-observability.md) が「本番で何が起きたかを観測する」のに対し、評価は「観測した挙動の良し悪しを判定し、改善に回す」オフライン側を担う。両者は「本番トレース → 失敗の eval データセット化 → 回帰テスト」という閉ループでつながる。

エージェント評価は単一の LLM 出力の採点とは質的に異なり、Anthropic は「（1 回の応答の採点ではなく）**ワークフローの監査**であり、モデルをエージェントとして動かすハーネス／スキャフォールド込みで評価する」と表現する。

## 単純な LLM 出力評価との違い

| | 単一 LLM 評価 | エージェント評価 |
|---|---|---|
| 対象 | 1 回の入出力 | マルチステップの実行履歴（ツール・推論・リトライ） |
| 観点 | 出力の質 | **outcome（最終的な環境状態）** と **trajectory（軌道）** の両方 |
| 性質 | 比較的決定的 | 非決定的 — 同じタスクでも結果がばらつく |

### outcome 評価 vs trajectory 評価

- **outcome（最終状態）**: 「予約しました」という発話ではなく、**環境側（DB 等）に予約レコードが実在するか**で判定する。ビジネスゴール検証に向く
- **trajectory（軌道 / プロセス）**: ツール呼び出し・推論・ハンドオフの過程を見る。デバッグと改善に向く
- outcome だけだと「不正な経路で偶然正解に達する（corrupt success）」を見逃す。**両方を同時に評価する**のが現在の合意

## 評価手法（3 種の grader）

Anthropic は採点器を 3 種に分類する。3 層を組み合わせて費用対効果を最適化するのが定石:

| grader | 内容 | 長所 / 短所 |
|---|---|---|
| **code-based / programmatic** | ユニットテスト・exact match・静的解析 | 高速・再現可能 / 正しいバリエーションに脆い |
| **model-based（LLM-as-judge）** | ルーブリック採点・pairwise 比較 | 主観的タスクを扱える / 人間判断とのキャリブレーション必須 |
| **human** | 専門家レビュー・A/B テスト | ゴールド基準 / 高コスト・低速 |

> Anthropic は「**transcript を実際に読まないと grader が正しく動いているか分からない**」と強調する。自動採点器そのものを人手で検証し続けることが要。

### LLM-as-judge のバイアスと緩和

主なバイアス: position（位置）/ verbosity（冗長性）/ self-preference（自己選好）/ format / calibration drift。

- **位置バイアス**: pairwise で毎回**順序をランダム化**し、両順序で評価して順序依存の判定はタイ扱いにする（swap-and-average）と大幅に低減する
- pointwise（絶対スコア）と pairwise（相対比較）を使い分ける。single-turn / multi-turn、reference-based / reference-free も区別する

## メトリクス設計：pass@k と pass^k

非決定性ゆえ、単発の正解率では不十分。2 つの指標は**正反対の物語**を語る:

- **pass@k** — k 回中 1 回でも成功する確率。**能力（できる可能性）**を測る
- **pass^k** — k 回すべて成功する確率。**一貫性 / 信頼性**を測る

τ-bench では、pass@k がほぼ 100% でも pass^k が大きく落ちる（例: GPT-4o が τ-retail で pass^8 < 25%）。本番要件（1 回でも解ければよいのか、毎回成功が必要か）に応じて使い分ける。outcome 指標（ゴール検証）と trajectory 指標（デバッグ）も併用する。

## オフライン eval ⇄ オンライン監視の閉ループ

```text
本番トレース ─▶ 失敗を注釈 ─▶ eval データセット化 ─▶ eval で prompt/ツール改善 ─▶ 回帰テスト
      ▲                                                                          │
      └──────────────────────── 改善が新たなトレースを生む ◀────────────────────┘
```

問題トレースを「ワンクリックで eval データセットへ追加」し、**本番失敗を恒久的な回帰テストに変換**する運用が一般化している。ローンチ前の自動 eval による高速反復と、本番監視による実世界の失敗検知は**どちらか一方では不十分**で、組み合わせて使う。

## 主要ベンチマーク

測るものが異なり、単一ランキングに統合すべきでない:

| ベンチマーク | 何を測るか |
|---|---|
| **SWE-bench / SWE-bench Verified** | 実 GitHub issue を解くパッチ生成。リポジトリのテストで検証。Verified は人手検証済み 500 件サブセット |
| **τ-bench（tau-bench）** | retail / airline のカスタマーサポート。会話終了時の DB 状態をゴールと比較。pass^k で信頼性を測る |
| **GAIA** | 複数ツール + マルチステップ推論の汎用アシスタント。人間には簡単・LLM には難しい設計 |
| **WebArena** | 実機能を再現した web サイト上のブラウザ操作タスク（長期ホライズン自律性） |
| **AgentBench** | OS / DB / 知識グラフ / ゲーム等 8 環境でのエージェント能力 |
| **BFCL（Berkeley Function Calling Leaderboard）** | 関数（ツール）呼び出し精度。版進化で v4 は agentic 評価・irrelevance 検出も対象 |

> 公開ベンチは**学習データ汚染（contamination）**のリスクがある。本番品質の担保には自社固有の eval データセットが重要。

## 評価ツール／フレームワーク

実務は「**CI/CD ゲート用の軽量フレームワーク**」+「**人手アノテーション・回帰追跡・ダッシュボード用プラットフォーム**」の 2 本立てに収束する傾向:

| ツール | 種別 | 特徴 |
|---|---|---|
| **OpenAI Evals** | OSS | リファレンス eval ハーネス + レジストリ |
| **DeepEval**（Confident AI）| OSS（Apache-2.0）| 50+ メトリクス、pytest 統合、CI/CD ゲート向け |
| **Ragas** | OSS（Apache-2.0）| RAG 評価の標準（faithfulness / context precision・recall）|
| **Promptfoo** | OSS | 軽量 CI ゲート |
| **LangSmith** | SaaS | トレース + eval、マルチターン全会話評価 |
| **Braintrust** / **Arize Phoenix** / **Langfuse** | SaaS / OSS | 回帰追跡・人手アノテーション・[observability](agentic-observability.md) 統合 |

## ベストプラクティス

- **小さく始める** — 包括的スイートを待たず、**実際の失敗から 20〜50 タスク**で開始。手動テストをそのままテストケース化する
- **曖昧さのない reference を作る** — 専門家が同じ判定に至る正解付きタスクにする
- **正例 / 負例をバランス** — 片側最適化を防ぐ
- **grader を人間判断にキャリブレートし続ける** — transcript を必ず人手で読み、自動採点器自体を検証する
- **「有能なエージェントなら実際に解けるタスク」か確認する** — 解けない/壊れたタスクは信号にならない
- **自社固有 eval で汚染を回避** — 公開ベンチのスコアを過信しない

## アンチパターン

- **最終出力だけ採点する** — corrupt success を見逃す。trajectory も見る
- **単発の正解率で判断する** — 非決定性を無視。pass^k で信頼性を測る
- **LLM-as-judge を素で信じる** — 位置・冗長性バイアスを緩和せず、人手検証もしない
- **本番監視と eval を分断する** — 失敗トレースを回帰テストに回さず、同じバグが再発する

## 参考

- Anthropic: [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)（outcome vs transcript、3 種 grader、pass@k / pass^k）
- Anthropic: [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) / [Bloom（behavioral evaluation OSS）](https://www.anthropic.com/research/bloom)
- [SWE-bench Verified（OpenAI）](https://openai.com/index/introducing-swe-bench-verified/) / [τ-bench 論文 arXiv:2406.12045](https://arxiv.org/pdf/2406.12045) / [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)
- ツール: [OpenAI Evals](https://github.com/openai/evals) / [DeepEval](https://deepeval.com/) / [Ragas](https://docs.ragas.io/) / [LangChain: Agent Observability](https://www.langchain.com/resources/agent-observability)
- 関連: [AI エージェントのオブザーバビリティ](agentic-observability.md), [ループエンジニアリング](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [Human-in-the-Loop](human-in-the-loop.md)
