---
reviewed: 2026-05-03
tags: [methodology, ai-workflow]
---

# AI 駆動開発（AI-Driven Development, AIDD）

LLM をソフトウェア開発プロセスの中核に据えた開発方法論の総称。コード補完から自律エージェントによる完結したタスク実行までを含み、開発者の役割は「コードを書く」から「**エージェントへ意図と制約を伝え、結果を検証する**」へとシフトする。

仕様駆動開発（SDD）とは別軸の概念で、両立可能。SDD の解説は `ai/practice/spec-driven-development.md` を参照。

## 定義

「AI 駆動開発」には公式の単一定義がないが、実務では次の 3 要素を満たす開発スタイルを指すことが多い:

1. **コード生成・編集の主担当が LLM**: 人間はレビュー・受け入れ・方向修正に回る
2. **対話的・反復的な開発ループ**: 一度のプロンプトで完成させず、フィードバックを重ねる
3. **エージェントが開発環境を能動的に操作**: ファイル編集・テスト実行・PR 作成等を自律で行う

「AI 支援開発（AI-Assisted Development）」と区別されることもある。前者は AI が主役、後者は人間が主役で AI は補助、という温度差がある。

## 歴史的経緯

| 年 | マイルストーン | 形態 |
|---|---|---|
| 2021 | GitHub Copilot 一般公開 | autocomplete |
| 2022-11 | ChatGPT 公開 | chat |
| 2023 | Cursor / Continue / Aider | chat-in-IDE / CLI |
| 2024 | Claude / GPT-4 ベースの coding agents (Devin, SWE-agent 等) | semi-autonomous agent |
| 2024-2025 | Claude Code, Codex CLI, Gemini CLI, Copilot CLI が GA | terminal-native agent |
| 2025-2026 | Routines / Workspace Agents / Spec Kit / Kiro 等の orchestrator が登場 | autonomous workflow |

進化方向: **「人間が補完を受け取る」 → 「人間と LLM が対話する」 → 「LLM が代行する」 → 「LLM が継続的に運用する」**。

## 主要パターン

### 1. Autocomplete（補完）

エディタ上で次のトークン・行・関数を提案する。GitHub Copilot, Tabnine, Cursor Tab 等。**人間が常に判断ループに入っている**ため誤りの混入リスクは低いが、短期的な生産性向上に留まる。

### 2. Chat（対話）

IDE 内またはブラウザで LLM と対話してコードを生成・改修する。ChatGPT, Cursor Chat, Continue 等。コンテキスト量を人間が制御するため**意図を明示しやすい**が、生成物を手動でファイルに反映する手間が残る。

### 3. Agent（エージェント）

LLM が**ファイル編集・コマンド実行・テスト実行**を自律的に行うループに入る。Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI 等。permission モデルで人間が要所だけ承認する。コンテキスト窓・トークン消費・ループ制御の理解が必須（→ `ai/practice/ai-context-management.md`）。

### 4. Autonomous Workflow（自律ワークフロー）

エージェントを**スケジュール / イベント / API トリガー**で起動し、人間の介在なしで PR を作成する形態。Claude Code Routines, OpenAI Workspace Agents, GitHub Copilot Coding Agent 等。詳細は `ai/practice/scheduled-tasks.md`。

## 仕様駆動開発との関係

AIDD は「**誰が**主にコードを書くか」、SDD は「**何を**先に書くか」の話で軸が異なる。組み合わせは 4 通り:

| | SDD あり | SDD なし |
|---|---|---|
| **AIDD あり** | エージェントに spec を読ませて実装させる（例: cc-sdd, GitHub Spec Kit） | 人間がプロンプトと対話で意図を伝える |
| **AIDD なし** | 人間が spec → 人間が実装（伝統的） | 人間がコード直書き |

SDD と AIDD の組み合わせは「意図の曖昧性」を抑える点で相性がよく、2025 年以降のツール（Kiro, GitHub Spec Kit, cc-sdd）はこの掛け合わせを前提に設計されている。詳細は `ai/practice/spec-driven-development.md`。

## 利点

- **生産性**: 定型コード・ボイラープレート・テストは人間より速い
- **常時稼働**: スケジュール / イベント駆動でレビュー・依存更新・小規模 fix を自動化（→ `ai/practice/scheduled-tasks.md`）
- **学習コスト分散**: 不慣れな言語・ライブラリでもエージェントが叩き台を作る
- **ドキュメント追従**: 公式 docs を都度参照させれば訓練データの陳腐化を回避できる

## 落とし穴

### 1. 確信を持って嘘をつく

LLM は API 名・フラグ・URL を捏造する。**verified knowledge base / context7 / 公式 docs の参照を強制**する仕組みが必須。本リポジトリの knowledge MCP もこの目的で存在する。

### 2. 大規模変更で一貫性が崩れる

10+ ファイル横断のリファクタは部分的に成功して部分的に破綻しがち。タスクを **1 PR = 1 トピック**で切る、エージェントに自分でテストを回させる、CI ゲートを必須化する、で防ぐ。

### 3. プロンプトインジェクションを忘れる

外部データ（Web ページ・ファイル・MCP ツール結果）に埋め込まれた指示にエージェントが従ってしまう。**信頼境界の設計**が必要（→ `ai/practice/prompt-injection.md`）。

### 4. コンテキスト窓の設計を怠る

長時間セッションは前半の決定を忘れる。コンパクション・サブエージェント・skill による progressive disclosure を組み合わせる（→ `ai/practice/ai-context-management.md`）。

### 5. レビュー文化の崩壊

「動くから OK」で人間レビューを省くと、設計・命名・アーキテクチャの一貫性が崩れる。**自動 PR でも人間が squash merge 前に必ず読む**運用が現実解。

### 6. ライセンス / 著作権

訓練データ由来のコードがそのまま出力される可能性。商用コードは Copilot の **filter for matching public code** を有効にする等の対策。

### 7. ベンダーロックイン

特定 CLI / モデル前提のスキル・スクリプトを書き溜めると移行コストが膨らむ。`AGENTS.md` / `agent-extensions` のような agent-agnostic な共通仕様を経由する（→ `ai/platform/agents-md.md`, `ai/platform/agent-extensions.md`, `ai/practice/multi-agent-repo.md`）。

## AI エージェントがよくやるミス

1. **訓練データから書き始める** — 特に CLI / API / SDK は半年単位で陳腐化する。`knowledge` MCP / context7 / 公式 docs を **必ず先**に当たる
2. **大きな PR で一気に変える** — 100+ 行・10+ ファイルの PR はレビュー不能。1 タスク 1 PR、squash merge 前提で設計
3. **テストを書かないか、テストだけ書いて実装が嘘** — 実装とテストを同時に書かせ、失敗するテストから始める TDD 的な進め方が安定する
4. **検証なしで「完了」を報告** — `pnpm run test` / `npm run build` / lint を**呼び出して結果を見る**まで完了とみなさない
5. **対話履歴を sole source of truth にする** — セッション終了で消える情報は記録に残らない。決定は `CLAUDE.md` / `AGENTS.md` / commit message / PR description に書き出す
6. **AskUserQuestion を多発する** — autonomous モードでは answers を返せない。プロンプト時点で「自律で進めてよい範囲」を明示する設計が必要

## 参考

- 関連: `ai/practice/spec-driven-development.md` / `ai/practice/ai-context-management.md` / `ai/practice/prompt-injection.md` / `ai/practice/multi-agent-repo.md` / `ai/practice/scheduled-tasks.md`
- エージェント CLI: `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
- 拡張機構: `ai/platform/agent-extensions.md`
- AGENTS.md: `ai/platform/agents-md.md`
