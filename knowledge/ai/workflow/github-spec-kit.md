---
reviewed: 2026-05-04
tags: [ai-workflow, spec, oss, github, cli]
stability: beta
---

# GitHub Spec Kit

GitHub が公式に提供する OSS の SDD オーケストレータ。Python 製の CLI `specify` と、エージェント向け slash command / Agent Skill のテンプレート群を配布する。30+ の AI コーディングエージェント（Claude Code, Codex, Cursor, Copilot, Gemini CLI, Windsurf, Antigravity, OpenCode 等）に対して**同一の SDD ワークフロー**をインストールできる agent-agnostic な orchestrator。

公式: [github.com/github/spec-kit](https://github.com/github/spec-kit) / Docs: [github.github.io/spec-kit](https://github.github.io/spec-kit/) / Releases: [Releases](https://github.com/github/spec-kit/releases)

SDD 概念全体は `ai/practice/spec-driven-development.md` を参照。Kiro / cc-sdd との比較は `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md`。

## インストール

> **重要**: PyPI に同名パッケージがあるが**公式ではない**。必ず GitHub から直接インストールする。

### 永続インストール（推奨）

```bash
# 安定版（vX.Y.Z は最新タグで置換）
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z

# pipx でも可
pipx install git+https://github.com/github/spec-kit.git@vX.Y.Z

# main HEAD を入れる（unreleased 変更を含む）
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

### 一時実行

```bash
uvx --from git+https://github.com/github/spec-kit.git@vX.Y.Z specify init <PROJECT_NAME>
```

確認: `specify version` / `specify check`。

エンタープライズ / air-gapped 環境向けインストールは [docs/installation.md](https://github.com/github/spec-kit/blob/main/docs/installation.md#enterprise--air-gapped-installation) 参照。

## 基本コマンド

```bash
# 新規プロジェクト初期化
specify init <PROJECT_NAME>

# 既存プロジェクトに追加
specify init . --integration copilot         # GitHub Copilot 統合
specify init --here --integration copilot

# Skills mode（slash command の代わりに Agent Skill を入れる）
specify init . --integration <agent> --integration-options="--skills"

# 統合可能エージェント一覧
specify integration list

# Extension / Preset
specify extension search
specify extension add <name>
specify preset search
specify preset add <name>
```

## SDD ワークフロー

エージェント側に slash command（または Agent Skill）が登録される。コマンド名は `/speckit.*`（Codex CLI の skills mode は `$speckit-*`）。

### Core Commands

| Command | Skill 名 | 役割 |
|---|---|---|
| `/speckit.constitution` | `speckit-constitution` | プロジェクトの普遍的な原則を `constitution` として記述 |
| `/speckit.specify` | `speckit-specify` | 何を作るか（要件 + ユーザーストーリー）を定義 |
| `/speckit.plan` | `speckit-plan` | tech stack を含む技術設計プラン |
| `/speckit.tasks` | `speckit-tasks` | plan を actionable なタスクリストに分解 |
| `/speckit.taskstoissues` | `speckit-taskstoissues` | タスクを GitHub Issues に変換 |
| `/speckit.implement` | `speckit-implement` | タスクを実行して実装 |

### Optional Commands

| Command | 役割 |
|---|---|
| `/speckit.clarify` | 曖昧な spec 領域を質問形式で詰める（旧 `/quizme`） |
| `/speckit.analyze` | spec / plan / tasks の整合性チェック |
| `/speckit.checklist` | 「英語の単体テスト」相当の品質 checklist 生成 |

### 推奨フロー

```text
/speckit.constitution  ← 一度だけ
↓
/speckit.specify       ← 機能ごと
↓
/speckit.clarify       ← 任意（推奨）
↓
/speckit.plan
↓
/speckit.tasks
↓
/speckit.analyze       ← 任意（推奨）
/speckit.checklist     ← 任意
↓
/speckit.implement
```

## ディレクトリ構造

`specify init` で `.specify/` 配下に templates / extensions / presets / scripts が展開される。templates の優先順位:

| 優先度 | コンポーネント | パス |
|---:|---|---|
| ⬆ 1 | Project-Local Overrides | `.specify/templates/overrides/` |
| 2 | Presets | `.specify/presets/templates/` |
| 3 | Extensions | `.specify/extensions/templates/` |
| ⬇ 4 | Spec Kit Core | `.specify/templates/` |

実行時に top-down で最初にマッチした template が使われる。Extension / Preset のコマンドは install 時にエージェントの discovery ディレクトリ（例: `.claude/commands/`）にコピーされる。

## Extension と Preset

| 種類 | 役割 | コマンド |
|---|---|---|
| **Extension** | 新コマンド・新ワークフローを追加 | `specify extension add <name>` |
| **Preset** | 既存コマンドのテンプレート / 用語を上書き | `specify preset add <name>` |

Extension の代表例: GitHub Issues 同期, Jira 連携, MAQA（Multi-Agent QA）, V-Model（test 仕様の並行生成）, Worktree Isolation, Security Review。

Preset の例: 規制対応の spec 様式, ドメイン固有用語, 別言語化（pirate-speak のような実例あり）。

Community catalog は [Community Extensions](https://speckit-community.github.io/extensions/) から検索可能。

## 対応エージェント

公式には 30+ の AI coding agent をサポート（CLI + IDE 両方）。`specify integration list` で installed バージョンの利用可能リストが見られる。代表例:

- Claude Code, Codex CLI, Cursor IDE, GitHub Copilot, Gemini CLI, Windsurf, OpenCode, Antigravity, Qwen Code, Continue, Aider, Kilo Code, Roo Code 等

`--integration <agent>` フラグで特定エージェント向けの初期化を行う。

## 他ツールとの差分

| | GitHub Spec Kit | Kiro | cc-sdd |
|---|---|---|---|
| 提供元 | GitHub 公式 | AWS | OSS（gotalab） |
| 形態 | Python CLI + templates | IDE + CLI | npm package + skills |
| エージェント数 | 30+ | (Kiro 単体) | 8 |
| OSS | Yes (MIT) | No（商用） | Yes (MIT) |
| 入口 | `uv tool install` / `pipx` | `curl install.sh` / Desktop | `npx cc-sdd@latest` |
| spec 形式 | core templates 上書き可 | EARS + design + tasks | Kiro 互換（EARS + design + tasks）|

## AI エージェントがよくやるミス

1. **PyPI の `specify-cli` を `pip install` する** — 公式ではない別物。必ず GitHub repo から `--from git+https://github.com/github/spec-kit.git@vX.Y.Z` でインストール
2. **slash command 名を `/specify` と覚える** — 古い情報。現行は `/speckit.specify`（namespace `speckit.` プレフィックス）
3. **Codex CLI で `/speckit.*` を呼ぶ** — Codex の skills mode は `$speckit-*`（`$` プレフィックス）。CLI 名で命名規則が違う
4. **`/speckit.constitution` を機能ごとに作り直す** — constitution はプロジェクト全体に対して 1 つ。機能ごとに変えるのは `/speckit.specify`
5. **`/speckit.tasks` の出力を手で書き直す** — 後段の `/speckit.implement` が依存解析に失敗する。修正は `/speckit.specify` / `/speckit.plan` 段階で
6. **Extension / Preset を install しっぱなしで CI を組む** — install 時に `.claude/commands/` 等に書き込まれるが、削除しても残る。`specify extension remove` で正しく外す
7. **`--integration copilot` だけで Claude Code でも動くと思う** — `--integration` ごとにエージェント別の出力が変わる。複数エージェント運用なら個別に init 実行

## 参考

- [github.com/github/spec-kit](https://github.com/github/spec-kit)
- [Documentation](https://github.github.io/spec-kit/)
- [CLI Reference](https://github.github.io/spec-kit/reference/overview.html)
- [Supported AI Coding Agent Integrations](https://github.github.io/spec-kit/reference/integrations.html)
- [Extensions Reference](https://github.github.io/spec-kit/reference/extensions.html)
- [Presets Reference](https://github.github.io/spec-kit/reference/presets.html)
- [Community Extensions Catalog](https://speckit-community.github.io/extensions/)
- 関連: `ai/practice/spec-driven-development.md` / `ai/workflow/kiro.md` / `ai/workflow/cc-sdd.md` / `ai/agents/claude-code.md` / `ai/agents/github-copilot-cli.md` / `ai/agents/codex-cli.md`
