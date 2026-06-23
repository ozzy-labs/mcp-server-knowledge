---
reviewed: 2026-06-23
tags: [ai-platform, practice, methodology]
---

# Agent Skills オーサリングのベストプラクティス

`SKILL.md` の書き方と、効果的なスキル設計の指針をまとめる。フォーマット仕様・フィールド定義・ディスカバリティアは `ai/platform/agent-skills-spec.md` を参照。本記事は **どう書けば良いスキルになるか**（オーサリング）と、**参考にできるメジャーな公開スキル**に焦点を当てる。

出典は Anthropic 公式の "Skill authoring best practices" ドキュメントおよび公式リポジトリ `anthropics/skills`。スキルは Claude.ai / Claude Code / Claude Agent SDK / Claude Developer Platform で動作し、オープン標準として 26+ ツール（Codex CLI, Gemini CLI, GitHub Copilot, Cursor, VS Code 等）が採用する。

## Progressive Disclosure を前提に書く

スキルは 3 段階でロードされる。**各段階のトークン予算を意識して情報を配置する**のがオーサリングの核心。

1. **メタデータ（約 100 トークン・常駐）**: 全スキルの `name` + `description` が起動時に常時ロードされる。
2. **本文（5000 トークン未満を推奨）**: スキルがアクティブになった時に `SKILL.md` 本文がロードされる。
3. **リソース（参照時のみ）**: `scripts/` / `references/` / `assets/` は読まれるまでコンテキストを消費しない。

配置の指針:

- **`SKILL.md` 本文は 500 行以内。** 超えそうなら別ファイルに分割する。
- **参照ファイルは `SKILL.md` から 1 階層まで。** 深くネストすると、エージェントが `head -100` のプレビューだけで判断して不完全な情報を得るリスクがある。
- **100 行を超える参照ファイルには目次を付ける。** 部分読みでも全体像が伝わる。
- ドメイン別にファイルを分ける（`references/finance.md`, `references/sales.md` 等）。無関係なコンテキストをロードさせない。

## `description` の書き方（発見の鍵・最重要）

エージェントは 100+ のスキルの中から `description` だけを見て使うものを選ぶ。最重要フィールド（最大 1024 文字）。

- **「何をするか」と「いつ使うか」の両方を含める。** トリガーとなる具体的なキーワードを入れる。
- **必ず三人称で書く。** Good: `Processes Excel files and generates reports.` / Avoid: `I can help you…` `You can use this to…`
- **良い例**: `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.`
- **避ける**: `Helps with documents` / `Processes data` のような曖昧な記述。

## 命名規則

- **動名詞形を推奨**: `processing-pdfs`, `analyzing-spreadsheets`, `testing-code`。名詞句（`pdf-processing`）や動詞形（`process-pdfs`）も可。
- `helper` / `utils` / `tools` / `documents` / `data` のような汎用語は避ける。
- 制約: 1–64 文字、小文字英数字とハイフンのみ、親ディレクトリ名と一致、予約語 `anthropic` / `claude` は不可（仕様詳細は spec 記事）。

## 簡潔に書く（コンテキストは公共財）

> "The context window is a public good."

デフォルトの前提は **「Claude はすでに賢い」**。Claude が持っていない情報だけを足す。各段落のトークンコストを問い直す。冗長な説明（150 トークン）より要点（50 トークン）。

## 自由度を調整する（指示 vs スクリプト）

タスクの壊れやすさに応じて指示の具体度を変える。狭い橋にはガードレールを、開けた野原には大まかな方向だけを。

| 自由度 | 形式 | 適する場面 |
|---|---|---|
| 高 | 散文の指示 | 正解が複数・文脈依存（例: コードレビュー） |
| 中 | 擬似コード / パラメータ付きスクリプト | 推奨パターンがある |
| 低 | 固定スクリプト（パラメータなし） | 壊れやすく一貫性が重要（例: DB マイグレーション。「このスクリプトを正確に実行。変更するな」） |

## スクリプトをバンドルする判断

決定性・効率が要る処理はコードにする（「トークン生成でソートするのはソートアルゴリズムを実行するより遥かに高コスト」）。ユーティリティスクリプトは **信頼性が高く・トークンを節約し・時間を節約し・一貫性を保証する**。

- **実行意図を明示する**: `Run analyze_form.py`（実行）と `See analyze_form.py for the algorithm`（読む）を区別する。
- **「punt せず解決する」**: エラーは明示的に処理する。
- **「voodoo 定数」を置かない**: マジックナンバーには根拠を書く。

## テストと反復（評価駆動）

- **評価を先に作る（evaluation-driven development）**: スキルなしで Claude を走らせてギャップを特定 → 3 つ以上のテストシナリオ作成 → ベースライン測定 → 最小限の指示を書く → 反復。（公式ドキュメントの eval JSON スキーマには `skills` / `query` / `files` / `expected_behavior` フィールドがあるが、**公式ランナーは存在しない**ので自前で組む。）
- **対象モデル全てでテストする**: Haiku / Sonnet / Opus。Opus で動いても Haiku ではより詳細な指示が要ることがある。
- **Claude A / Claude B ループ**: 一方の Claude にスキルを書かせ、新規の Claude に使わせて、ギャップを観察してフィードバックする。

## アンチパターン（公式が明示）

- Windows 形式のバックスラッシュパス（常にスラッシュを使う。クロスプラットフォームで動く）。
- 選択肢を出しすぎる（「pypdf か pdfplumber か PyMuPDF か…」）。**1 つのデフォルト + 逃げ道**を示す。
- 時限的情報（「2025 年 8 月より前は…」）。代わりに折りたたみの "Old patterns" セクションを使う。
- 用語の不統一（endpoint / URL / route を混在）。
- 深いネスト、曖昧なファイル名（`doc2.md`）。
- パッケージがインストール済みと仮定する（依存は明示列挙）。
- MCP ツールは常に完全修飾 `ServerName:tool_name` で書く。

## セキュリティ

- **「信頼できるソースからのみスキルをインストールする」**。コード依存・バンドルリソース・Claude を外部の信頼できないソースへ誘導する指示（プロンプトインジェクションの経路）を監査する。
- `allowed-tools`（確認なしで許可するツールのスペース区切り指定）は**実験的**で、実装間で対応差がある。保証された境界として扱わない。
- 実行環境の差: claude.ai は npm / PyPI / GitHub からインストールできるが、**Claude API はネットワークアクセスもランタイムのパッケージインストールも持たない**。

## メジャーな公開 Skills: `anthropics/skills`

公式リポジトリ `github.com/anthropics/skills`（`./skills` / `./spec` / `./template`）。大半は Apache-2.0、4 つのドキュメントスキル（docx/pdf/pptx/xlsx）は source-available（OSS ではない本番リファレンス実装）。「デモ・教育目的で提供」との免責あり。

Claude Code でのインストール例:

```text
/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

| スキル | 区分 | 用途 |
|---|---|---|
| `skill-creator` | メタ | スキルの作成・改善・計測。eval 実行、分散分析付きベンチマーク、トリガー精度のための description 最適化 |
| `pdf` | ドキュメント | PDF のテキスト/表抽出、結合・分割、回転、透かし、生成、フォーム入力、暗号化、画像抽出、OCR |
| `docx` | ドキュメント | Word `.docx` の作成・読込・編集（TOC、見出し、ページ番号、レターヘッド、画像、変更履歴、コメント） |
| `pptx` | ドキュメント | `.pptx` の作成・抽出・編集・結合分割、テンプレート、レイアウト、スピーカーノート |
| `xlsx` | ドキュメント | スプレッドシート（`.xlsx/.xlsm/.csv/.tsv`）の読込・編集、数式、書式、グラフ、整形 |
| `mcp-builder` | 開発 | 高品質な MCP サーバー構築ガイド（Python FastMCP / Node TypeScript SDK） |
| `webapp-testing` | 開発 | Playwright でローカル Web アプリをテスト（検証・デバッグ・スクショ・ブラウザログ） |
| `web-artifacts-builder` | 開発 | claude.ai の複数コンポーネント HTML アーティファクト（React / Tailwind / shadcn/ui） |
| `claude-api` | 開発 | Claude API / Anthropic SDK のリファレンス（model id、料金、streaming、tool use、caching 等） |
| `algorithmic-art` | クリエイティブ | p5.js による生成アート（シード乱数、flow field、particle system） |
| `canvas-design` | クリエイティブ | `.png` / `.pdf` のビジュアルアート（ポスター・デザイン） |
| `frontend-design` | クリエイティブ | 意図的で独自性のある UI ビジュアルデザイン |
| `theme-factory` | クリエイティブ | アーティファクトのスタイリング（10 プリセット or 生成テーマ） |
| `slack-gif-creator` | クリエイティブ | Slack 最適化のアニメ GIF（制約 + 検証ツール付き） |
| `brand-guidelines` | エンタープライズ | Anthropic 公式ブランドカラー/タイポをアーティファクトに適用 |
| `internal-comms` | エンタープライズ | 社内コミュニケーション文書（ステータス報告、リーダー向け更新、FAQ、インシデント報告） |
| `doc-coauthoring` | エンタープライズ | ドキュメント/提案/仕様/意思決定文書の共同執筆ワークフロー |

`skill-creator` メタスキルが推奨する指針: description は明示的なトリガーで「pushy」に書く、剛直な "ALWAYS" より命令形 + *なぜ* を説明する、繰り返すヘルパーは `scripts/` に束ねる、300 行超の参照には目次を付ける。README には partner skill として **Notion Skills for Claude** も参照されている。

## 参考

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Equipping agents for the real world with Agent Skills（engineering blog）](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [anthropics/skills（公式公開スキルリポジトリ）](https://github.com/anthropics/skills)
- [skill-creator SKILL.md](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
- 関連: `ai/platform/agent-skills-spec.md`（フォーマット仕様）, `ai/platform/agent-extensions.md`（CLI ごとの対応状況）
