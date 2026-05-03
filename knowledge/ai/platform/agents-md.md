---
reviewed: 2026-05-04
tags: [ai-workflow, methodology, markdown]
---

# AGENTS.md

AI コーディングエージェント向けのプロジェクトガイダンスを記述する共通ファイル。単一の `AGENTS.md` で OpenAI Codex / Gemini CLI / GitHub Copilot Coding Agent / Cursor / Windsurf / Devin / Jules / JetBrains Junie / Aider / goose / opencode / Zed / Warp / VS Code / Amp / RooCode / Augment Code / Factory / Ona / Kilo Code / Phoenix / Semgrep など 20 を超えるエージェントにまたがって方針を共有する（公式サイト掲載分。2026-05 時点）。

## 背景

従来は各エージェントが固有のファイル名（`CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`, `.cursorrules` 等）を要求していた。`AGENTS.md` は 2025 年 8 月にオープンな共通規約として提案され（`agentsmd/agents.md` リポジトリ作成日）、主要 CLI / IDE エージェントが順次採用した（2026-05 時点で 20+ 件）。

## 配置と読み込み

- 配置: リポジトリのルート
- 読み込み: 起動時に自動。明示設定不要
- サブディレクトリの `AGENTS.md`: モノレポで配下固有の指示を与える場合に使用可能（エージェント依存）

## 推奨セクション

エージェントは構造を解釈できるので、自然な見出しで書けばよい。代表的な節:

| 節 | 内容 |
|---|---|
| プロジェクト概要 | このリポジトリが何を作っているか |
| Tech Stack | 言語・ランタイム・パッケージマネージャ・主要ライブラリ |
| 主要コマンド | `install`, `build`, `test`, `lint` など |
| 検証（必須） | 報告前に必ず通すべきチェック（例: `pnpm run build && pnpm run typecheck`） |
| コーディング規約 | インデント・改行・命名規則 |
| 禁止事項 | `main` 直接 push、`.env` のステージングなど |
| 規約へのリンク | Conventional Commits / GitHub Flow 等の外部ルール参照 |

## エージェントごとのアダプタ

`AGENTS.md` だけで多くのエージェントはカバーできるが、エージェント固有の機能（スキル、サブエージェント、カスタムコマンド等）は別ファイルで補う。

| エージェント | 追加ファイル |
|---|---|
| Claude Code | `CLAUDE.md`, `.claude/` 配下 |
| Codex CLI | `AGENTS.md` + `.agents/skills/` |
| Gemini CLI | `AGENTS.md` + `GEMINI.md` / `CONTEXT.md` |
| GitHub Copilot CLI | `AGENTS.md` + `.agents/` |
| Cursor | `AGENTS.md` + `.cursor/rules/`（`AGENTS.md` も公式サポート済み） |

**Tip**: `CLAUDE.md` の先頭で `共通方針は AGENTS.md を参照` と書き、Claude 固有の部分だけ `CLAUDE.md` に残すと DRY になる。

## 執筆原則

- **命令形で短く**: 「〜する」「〜しない」で書く。敬語・冗長表現は避ける
- **トリガーを明示**: 「変更後に」「PR 作成前に」など実行タイミングを書く
- **禁止は理由付き**: 「`--force` push しない（本番運用の安全のため）」のように
- **サンプルコマンドを具体化**: `pnpm run build` のように実行可能な形で
- **外部ドキュメントへは相対リンク**: `.claude/rules/git-workflow.md` 等

## アンチパターン

- ツール固有の CLI フラグを深掘りする（エージェント横断で陳腐化する）
- `README.md` や `CONTRIBUTING.md` の内容を重複させる → リンクで参照
- 長文のポエム的な背景説明 → 決定事項と規則のみ
- 「AI エージェントなら〜を理解してください」といった曖昧な指示
