---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, security]
---

# AI エージェントの信頼性とガードレール（Reliability & Guardrails）

自律的に動く AI エージェントを**安全かつ堅牢に運用する**ための仕組み。[オブザーバビリティ](agentic-observability.md) が「検知」、[Human-in-the-Loop](human-in-the-loop.md) が「人間の判断」を担うのに対し、本記事は**「危険・失敗をどう防ぎ、起きたらどう回復するか」**の防御層を扱う。検出型ガードレールは確率的で破られるため、サンドボックス・最小権限・HITL といった**決定論的な封じ込めと多層防御（defense-in-depth）で組み合わせる**のが原則。

## ガードレールの種類

OpenAI Agents SDK は「**入力ガードレールが agent をユーザーから守り、出力ガードレールがユーザーを agent から守る**」と整理する。違反検出時は tripwire が発動して処理を中断する。

| | 入力ガードレール | 出力ガードレール |
|---|---|---|
| 目的 | 高コスト/副作用処理の**前**に弾く | 最終出力をユーザーに返す**前**に検証 |
| 例 | PII 検出、jailbreak/[プロンプトインジェクション](prompt-injection.md)検出、トピック制限、toxicity | ハルシネーション検証（グラウンデッドネス）、機密漏洩防止、フォーマット検証 |

実装は **決定論的チェック**（regex・スキーマ検証）と **LLM ベースチェック**（毒性・jailbreak 判定）を併用する。NVIDIA NeMo Guardrails は input / retrieval / dialog / execution / output の 5 種のレールを持ち、各レールが入力/出力を **reject（停止）または alter（マスキング・言い換え）**できる。

## エラー回復と耐障害性

Anthropic "Effective harnesses for long-running agents" の一次パターン:

- **健全性チェック（health check）** — セッション開始時に進捗ノートと git ログを読み、basic test を走らせて未文書のバグを捕捉する
- **チェックポイント / ロールバック** — モデルが **git で不良変更を revert** し動作状態へ復元できる。各セッションを git commit + 進捗更新で終え、コンテキスト窓をまたぐ atomic なチェックポイントを作る
- **検証のガード** — E2E テスト + スクリーンショットで確認。「テストの削除・編集は機能欠落につながるため許容しない」という指示を入れる

一般的な耐障害パターン（リトライ戦略・サーキットブレーカー等）:

- **リトライ** — エラー種別で扱いを変える（rate limit → 指数バックオフ + jitter、timeout → 短いリトライ、auth error → リトライ不要）
- **サーキットブレーカー** — CLOSED / OPEN / HALF-OPEN。連続失敗で OPEN にして fail-fast、timeout 後に HALF-OPEN でプローブ
- **冪等性 / タイムアウト / グレースフルデグレード** — 冪等な副作用は安全にリトライ可。フォールバックチェーン（例: Opus → Sonnet → Haiku → キャッシュ応答）

## 暴走（runaway）の防止

無限ループとコスト暴走は最もコストの高い silent failure。多層の停止条件を張る（[ループエンジニアリング](loop-engineering.md) の停止条件と対になる）:

1. **最大イテレーション上限**（目安: 期待回数の 3〜5 倍）
2. **トークン / コスト予算**（run あたりのハード上限）
3. **タイムアウト**（タスク / API 呼び出しレベル）
4. **no-progress 検知**（反復しても新情報が出ないと exit）
5. **goal-achievement チェック**（別の高速モデルが毎ターン完了判定する generator/evaluator ループ等）

これらの発火は[オブザーバビリティ](agentic-observability.md)で監視・アラート化する。

## サンドボックス / 隔離

コード実行やファイル操作を伴うエージェントは**隔離が決定論的封じ込めの中核**。Anthropic Claude Code のサンドボキシング（一次情報）は 2 本柱を OS レベルで強制する:

- **ファイルシステム隔離** — 特定ディレクトリのみアクセス/変更可（Linux: bubblewrap、macOS: Seatbelt）
- **ネットワーク隔離** — proxy 経由で**ドメイン allowlist** を強制、新規ドメインはユーザー確認

> 「効果的なサンドボキシングは FS 隔離と**ネットワーク隔離の両方**を要する。ネットワーク隔離がなければ機密ファイルを exfiltrate でき、FS 隔離がなければ sandbox を脱出できる」。これにより「prompt injection が成功しても完全に隔離され、SSH キーを盗めず攻撃者サーバへ phone home できない」。

コード実行サンドボックスの技術階層: **microVM（Firecracker / Kata）**が最強隔離（専用カーネル）、**gVisor**がユーザー空間で syscall を傍受する中間的隔離。本番エージェント実行は microVM が最低ライン。

### lethal trifecta と YOLO mode

Simon Willison の **lethal trifecta**: ①プライベートデータへのアクセス ②untrusted content への露出 ③外部送信能力 — **この 3 つが揃うと危険**。LLM はソースを区別せず届いた指示に従うため、untrusted content に埋め込まれた指示でデータを窃取・送信される。

- **「ガードレールだけでは不十分」**（95% の有効性はセキュリティでは落第点）。第一の防御は**3 要素を組み合わせないこと**
- 全自動（YOLO）モードは最小権限の認証情報（tightly scoped credentials）とサンドボックス隔離が前提。実害例として gemini-cli `--yolo` で公開 issue の悪意指示により認証情報を窃取された事例がある

## ガードレール実装フレームワーク

| フレームワーク | OSS | 何を防ぐ / 提供 |
|---|---|---|
| **NVIDIA NeMo Guardrails** | OSS | input/retrieval/dialog/execution/output レール。PII マスキング・ファクト検証・ハルシネーション検出 |
| **Guardrails AI** | OSS | LLM 出力の検証・構造化（PII / toxicity / grounding / SQL injection 等の validator）|
| **Meta LlamaFirewall** | OSS | agent 最終防御層。PromptGuard 2（jailbreak/injection）+ Agent Alignment Checks（goal hijacking）+ CodeShield（生成コード静的解析）|
| **Meta Llama Guard 3** | オープンウェイト | 入出力の安全分類（MLCommons 22 カテゴリ、多言語、ツール呼び出し対応）|
| **OpenAI Agents SDK guardrails** | OSS（SDK）| input/output guardrail + tripwire。ルール / LLM ベース |
| **OpenAI Moderation API** | API（無料）| GPT-4o ベース、テキスト + 画像の有害カテゴリ分類 |
| **Azure AI Content Safety** | マネージド | Prompt Shields（直接 + 間接 injection）、Groundedness detection（+自動 correction）|

## Human-in-the-Loop との接続

- **不可逆アクション前のチェックポイント** — 金融取引の承認・データ削除など不可逆操作の前にエージェントを一時停止して人間レビューを挟む
- **確信度ベースのエスカレーション** — 確信度が閾値を下回る・能力限界を認識したら人間にエスカレーションする

詳細な設計は [Human-in-the-Loop パターン](human-in-the-loop.md) を参照。

## ベストプラクティス

- **多層防御（defense-in-depth）** — reasoning / tool / memory / communication の各層に防御を置き、1 層が破られても全体が崩れないようにする（OWASP）
- **最小権限（least privilege）** — エージェントに必要最小限の権限のみ付与し、各ツールは最も狭い権限を持つ
- **ガードレール単独に頼らない** — 検出型は確率的で破られる。サンドボックス・最小権限・HITL の**決定論的封じ込め**と併用する
- **監査ログと異常検知** — 全ツール呼び出し・エージェント決定をログ化し、baseline + 異常検知を組む

## アンチパターン

- **ガードレールだけで安全と見なす** — 検出は破られる。決定論的封じ込めを併用する
- **lethal trifecta を放置** — 3 要素を同一エージェントに揃えたまま自動実行する
- **停止条件なしで自律実行** — runaway loop でコストが暴走する
- **隔離なしでコード実行** — prompt injection で sandbox 脱出・データ exfiltration を許す
- **過剰な権限を付与** — 最小権限を無視し、侵害時の被害を広げる

## 参考

- Anthropic: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) / [Claude Code sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing) / [sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime)
- OpenAI: [Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/) / [Moderation API](https://developers.openai.com/api/docs/guides/moderation)
- NVIDIA: [NeMo Guardrails](https://docs.nvidia.com/nemo/guardrails/) / Meta: [LlamaFirewall](https://ai.meta.com/research/publications/llamafirewall-an-open-source-guardrail-system-for-building-secure-ai-agents/) / Microsoft: [Azure AI Content Safety](https://learn.microsoft.com/en-us/azure/ai-services/content-safety/overview)
- Simon Willison: [The lethal trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)
- 関連: [プロンプトインジェクション対策](prompt-injection.md), [Human-in-the-Loop](human-in-the-loop.md), [ループエンジニアリング](loop-engineering.md), [オブザーバビリティ](agentic-observability.md), [ツール設計（ACI）](agent-tool-design.md)
