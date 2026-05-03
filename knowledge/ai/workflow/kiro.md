---
reviewed: 2026-05-04
tags: [ai-workflow, spec, commercial, aws, ide]
stability: ga
---

# Kiro

AWS が提供する spec-driven development（SDD）ベースのエージェント型 AI IDE。Code OSS をベースとしたデスクトップアプリと、ヘッドレスで走る CLI（Kiro CLI）の 2 形態がある。「prototype から production まで spec 駆動で持っていく」を看板に掲げ、Cursor / Claude Code 系の対話型コーディングとは異なるアプローチを取る。

公式: [kiro.dev](https://kiro.dev/) / Docs: [kiro.dev/docs](https://kiro.dev/docs/) / CLI Docs: [kiro.dev/docs/cli](https://kiro.dev/docs/cli/)

SDD 概念全体は `ai/practice/spec-driven-development.md` を参照。AI エージェント横断の比較は `ai/platform/agent-extensions.md` 参照。

## インストール

### Desktop IDE

公式サイト [kiro.dev/downloads](https://kiro.dev/downloads/) から macOS / Linux / Windows 用バイナリを取得。

### CLI

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

CLI 2.0（2026-04-13）で Windows 11 と headless CI/CD 実行に対応（`KIRO_API_KEY` + `--no-interactive`）。続く CLI 2.1（2026-04-24）で shell output streaming・Tool Search・Skills slash command・device flow auth・RHEL サポートが追加。IDE と CLI は同じ spec ファイルを共有する。バージョン履歴は [kiro.dev/changelog/cli](https://kiro.dev/changelog/cli/) を参照。

## 動作モデル

- **モデル**: 既定で Claude Sonnet 4.5。Claude Haiku 4.5 と `Auto`（複数 frontier モデルを自動選択）が選択可能
- **MCP**: ネイティブ対応。docs / database / API 等を MCP サーバー経由で接続可能（`ai/platform/mcp-protocol.md`）
- **Steering files**: プロジェクト全体に効くガイダンスファイル（`AGENTS.md` 系の概念。`ai/platform/agents-md.md`）
- **マルチモーダル chat**: 画像 / UI モックを入力に取れる
- **Agent hooks**: ファイル保存・git commit 等のイベントに反応してコマンドを自動実行

## SDD ワークフロー（3 段階）

| 段階 | 生成物 | 内容 |
|---|---|---|
| 1. Requirements | `requirements.md` | 自然言語 → **EARS 記法**で曖昧性のない受け入れ基準に変換 |
| 2. Design | `design.md` | コードベースを解析してアーキテクチャ・システム設計・tech stack を提案 |
| 3. Implementation | `tasks.md` | 依存関係に基づいて順序付けされた discrete タスクに分解、エージェントが実装 |

3 段階すべてが Markdown ファイルとしてリポにコミットされる。後から人間 / 別エージェントが文脈を取り戻せる。タスクは spec の受け入れ基準にトレースされる。

### EARS 記法とは

**Easy Approach to Requirements Syntax**。「When X, the system shall Y」のような構造化テンプレートで要件を書く。曖昧表現を排除して LLM とのコンテキストずれを防ぐ目的。Kiro の `requirements.md` は EARS をデフォルトの記法とする。

## 主要機能

| 機能 | 説明 |
|---|---|
| **Spec view** | 3 つの spec ファイル（requirements/design/tasks）を専用 UI で編集 |
| **Agent hooks** | save / commit 等のイベントトリガーで test / lint を自動実行 |
| **Smart context management** | コンテキスト窓を自動で圧縮・取捨選択（`ai/practice/ai-context-management.md`） |
| **Native MCP** | MCP サーバーを Settings から直接追加 |
| **Multimodal chat** | テキスト + 画像 + UI スクリーンショット |
| **Intelligent error diagnostics** | 実行時エラーから fix プランを提案 |
| **Generate Git commit messages** | diff から commit message を生成 |

## CLI モード（Kiro CLI / CLI 2.0）

ヘッドレス実行 + CI/CD 統合に対応。IDE と同じ spec ファイルを使い、CI から `kiro` コマンドで spec → tasks → implement を回せる。Windows サポートは CLI 2.0 から。

```bash
kiro --help
```

詳細は [kiro.dev/docs/cli](https://kiro.dev/docs/cli/) を参照。

## 料金

[kiro.dev/pricing](https://kiro.dev/pricing/) に最新プラン。GA（[2025-11-17 アナウンス](https://kiro.dev/blog/general-availability/)）後も Free（$0/月、50 credits/月）が永続提供される。有料プランは Pro $20/月（1,000 credits）／ Pro+ $40/月（2,000 credits）／ Power $200/月（10,000 credits）。超過分は $0.04/credit、AWS GovCloud は約 20% 高。Per-prompt クレジット消費が IDE 内で可視化される。

認証は AWS Builder ID / IAM Identity Center / GitHub / Google アカウントに加え、CLI 1.25.1 以降は Okta / Microsoft Entra ID にも対応。

## 競合との差分

| | Kiro | Claude Code / Codex CLI | Cursor |
|---|---|---|---|
| 形態 | IDE + CLI | CLI（terminal-native） | IDE（VS Code fork） |
| SDD 統合 | core philosophy | 後付け（Skill / cc-sdd 等） | なし（agent-only） |
| spec ファイル | `requirements.md` / `design.md` / `tasks.md` がデフォルト | プロジェクト裁量 | プロジェクト裁量 |
| モデル | Claude Sonnet 4.5 / Auto | Anthropic / OpenAI / Google 各社 | 各社 |
| 思想 | "spec が真実" の上流からのトレース | "code が真実" の対話駆動 | 同左（補完強め） |

Kiro と cc-sdd の関係: cc-sdd は Kiro-inspired と明記されており、Kiro の spec 形式（EARS + design + tasks）と互換。Kiro で書いた spec を cc-sdd 経由で Claude Code に渡す運用が可能。

## AI エージェントがよくやるミス

1. **`requirements.md` を箇条書きで埋める** — Kiro は EARS 記法を前提に design / tasks を生成する。「リスト形式の要件」だと design 段階で意図がずれる。`When ... the system shall ...` の構造を守る
2. **Spec view を経由せず手で `tasks.md` を書く** — タスク間の依存解析が壊れて並列実行できなくなる。Spec view の **Generate tasks** から作る
3. **Agent hooks を盛りすぎる** — 全イベントに hook をぶら下げると無限ループや CI 待ち地獄になる。最小（save → format / commit → test 程度）から始める
4. **MCP コネクタを Settings 全 enable で起動** — Claude Code Routines と同じ問題。コネクタは per-project で必要分だけ有効化（`ai/agents/claude-code-routines.md`）
5. **Auto モード前提でモデルを選ばない** — Auto は速度・コスト最適化重視。デバッグ / 設計レビューでは Claude Sonnet 4.5 を明示指定したほうが質が安定する
6. **CLI から `kiro` を呼んでセッションが閉じない** — CI から呼ぶ場合は exit code とタイムアウトを必ず設定。CLI 2.0 の headless モードのドキュメントを確認
7. **GA 後も CLI が高速に進化していることを忘れる** — CLI は 2026-04 に 2.0、続けて 2.1 と短期間で機能追加。プロダクション CI に組み込む場合は version pin 必須

## 参考

- [Kiro 公式](https://kiro.dev/)
- [Docs](https://kiro.dev/docs/)
- [CLI Docs](https://kiro.dev/docs/cli/)
- [CLI Changelog](https://kiro.dev/changelog/cli/)
- [Specs ガイド](https://kiro.dev/docs/specs/)
- [Pricing](https://kiro.dev/pricing/)
- [Downloads](https://kiro.dev/downloads/)
- [GA アナウンス（2025-11-17）](https://kiro.dev/blog/general-availability/)
- 関連: `ai/practice/spec-driven-development.md` / `ai/practice/ai-driven-development.md` / `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/agents/claude-code.md` / `ai/platform/mcp-protocol.md`
