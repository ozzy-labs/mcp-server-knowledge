---
reviewed: 2026-05-03
tags: [methodology, ai-workflow, spec]
---

# 仕様駆動開発（Spec-Driven Development, SDD）

実装の前に**意図（spec）と計画（plan）を文書として書き出し**、それを起点にコードを生成・検証するワークフロー。AI エージェントは曖昧な自然言語よりも構造化された spec の方が扱いやすいため、AI 駆動開発と組み合わせる用途で 2025 年以降急速に普及した。

AI 駆動開発との位置づけは `ai/practice/ai-driven-development.md` を参照。代表的なツールは `ai/workflow/` 配下に個別記事がある。

## 定義

3 段階のフローを基本とする:

1. **Spec**: 「何を作るか」を自然言語で記述（要件・受け入れ基準・非機能要件）
2. **Plan**: 「どう作るか」を技術的に分解（アーキテクチャ・ファイル分割・タスク列）
3. **Implement**: plan の各タスクを実装し、spec の受け入れ基準で検証

それぞれが**バージョン管理されるアーティファクト**として残るのが従来のアジャイル開発との違い。エージェントは plan の各タスクを順に拾い上げて自律実行できる。

## 歴史的経緯

| 年代 | 形態 | 性格 |
|---|---|---|
| 1970s-80s | formal specification (Z, VDM, B-method) | 数学的厳密性、現場で重い |
| 1990s | UML / use case | ドキュメンテーション中心、コードと乖離 |
| 2000s | TDD（テスト駆動開発） | spec をテストで表現 |
| 2010s | BDD（Cucumber 等） | spec を自然言語で書く（人間向け） |
| 2024-2025 | AI-era SDD（GitHub Spec Kit, Kiro, cc-sdd） | spec をエージェント向け structured prompt として書く |

「spec を書く」発想自体は古いが、**書いた spec が実装作業に直結する**点が AI 時代の特徴。エージェントが spec を読んで実装まで完了させるため、spec が dead document にならない。

## AI 時代の SDD 特有の利点

1. **意図の曖昧性を吸収**: 「いい感じに作って」より「この受け入れ基準を満たせ」の方がエージェントは確実に動く
2. **タスク並列化**: plan のタスクが独立していれば複数エージェント並列で実行できる
3. **回帰防止**: spec が受け入れ基準を兼ねるため、後の改修で spec を読み直せば壊れた箇所が分かる
4. **オンボーディング**: 後から参加した人間 / エージェントが spec を読めばコンテキストを取り戻せる
5. **コードレビュー基準の明確化**: 「spec に書いてないものは reject」という運用ルールが成立

## 主要 workflow ツール

2026 年時点の代表的な SDD オーケストレータ:

| ツール | 提供元 | 特徴 | 詳細 |
|---|---|---|---|
| **GitHub Spec Kit** | GitHub | agent-agnostic（Copilot/Claude/Gemini 切替）、`uvx spec-kit` で導入 | `ai/workflow/github-spec-kit.md` |
| **Kiro** | AWS | 専用 IDE、Spec ビュー、agent hooks、Claude/Codex 連携可 | `ai/workflow/kiro.md` |
| **cc-sdd** | OSS コミュニティ | Claude Code 専用 skill / package | `ai/workflow/cc-sdd.md` |

各ツールは「spec をどこに置くか」「plan の粒度をどう刻むか」「どのエージェントに渡すか」で立ち位置が異なる。導入時は **どの CLI / IDE をすでに使っているか**で選ぶのが現実的。

## SDD と AIDD の関係

| | AIDD あり | AIDD なし |
|---|---|---|
| **SDD あり** | エージェントに spec を読ませて実装させる（cc-sdd, Spec Kit, Kiro） | 人間が spec → 人間が実装（伝統的 V 字） |
| **SDD なし** | 対話プロンプトでエージェントに直接実装させる（Cursor / Claude Code 単体） | コード直書き |

AI 駆動 + SDD の組み合わせが 2026 年時点の主流仮説で、3 つの workflow ツールはすべてこの掛け合わせを前提に設計されている。

## 落とし穴

### 1. 過剰な spec 文書化

「全機能を完璧な spec で記述する」を目指すと、書く時間が実装時間を超えて pay off しない。**最小実用 spec**（受け入れ基準と plan の概要だけ）から始めて必要に応じて補足する。

### 2. spec と実装の乖離

spec は書かれたが守られていない、というケース。CI で spec の受け入れ基準を **テスト化して回す**仕組みを併設しないとすぐ陳腐化する。

### 3. plan の粒度ミス

plan のタスクが「ログイン機能を実装」のように粗いとエージェントが推測で広範な変更を入れる。逆に細かすぎると orchestration overhead が膨らむ。**1 タスク = 1 PR で squash merge できる粒度**が経験的に扱いやすい。

### 4. spec を decision log と混同

spec は「何を作るか」、decision log は「なぜそう決めたか」。両者を混ぜると spec が肥大化して読まれなくなる。決定経緯は別ファイル（ADR / `decisions/` 等）に分離する。

### 5. ツール特化の spec 形式に lock-in

Kiro 専用記法 / cc-sdd 専用記法 / Spec Kit テンプレートで書いた spec は他ツールに移植しづらい。**Markdown + 軽い構造化**で書いておけばツール切替に耐える。

### 6. レビュアーが消える

「spec 通りなのでマージ」を機械的に行うと、spec 自体の妥当性をレビューする人間がいなくなる。**spec PR と implement PR を分けて二段階レビュー**する運用が現実解。

## AI エージェントがよくやるミス

1. **spec を書かずに即実装に入る** — 「とりあえず書いて」と言われると spec を飛ばして implement 開始する。プロンプト時点で「まず spec.md を作って」と明示する設計が必要
2. **plan のタスクを 1 セッションで全部消化しようとする** — コンテキスト窓が枯渇する。タスクごとに別セッション / 別 PR が安定
3. **spec を更新せず実装だけ変える** — 「実装が真実、spec は古い」状態に陥る。**実装変更 PR には対応 spec の修正も含める**ルールを作る
4. **spec の受け入れ基準を見ずに「完了」と報告** — `pnpm run test` ではなく「spec の各項目が満たされたか」を**自分でチェックリスト化して回す**設計
5. **既存 spec を読まずに新 spec を書く** — 重複・矛盾する spec が並行して存在する状態になる。新規 spec 作成前に既存を grep
6. **spec を Markdown 1 ファイルに詰め込む** — 1 機能 1 ファイル、または `specs/<feature>.md` のディレクトリ分割が後で参照しやすい

## 参考

- 関連: `ai/practice/ai-driven-development.md` / `ai/practice/ai-context-management.md` / `ai/practice/multi-agent-repo.md`
- workflow ツール: `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md`
- エージェント CLI: `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
