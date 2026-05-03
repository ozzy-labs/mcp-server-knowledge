---
reviewed: 2026-05-04
tags: [ai-workflow, methodology]
---

# AI エージェントの拡張機構（Skills / Subagents / Hooks / Plugins）

Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI の 4 大コーディングエージェント CLI が、2026 年時点でほぼ共通のメンタルモデルで**拡張機構**を持つようになった。本記事はそれらを横断比較する。個別 CLI の仕様は `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md` を参照。

## 4 つの拡張機構

現代のエージェント CLI はすべて以下の 4 層で拡張される。

| 層 | 目的 | 典型的な置き場所 |
|---|---|---|
| **Skills** | 「この種のタスクが来たら読む」プロンプト + コンテキストのバンドル | `.agents/skills/<name>/SKILL.md`（オープン標準） |
| **Subagents (Custom agents)** | 独立コンテキストで動く専門エージェントの定義 | `.<cli>/agents/<name>.md` |
| **Hooks** | ツール実行・セッションイベントにフックするシェルスクリプト | `hooks.json` / 設定ファイルの `hooks` セクション |
| **Plugins / Extensions** | 上記を束ねて配布するパッケージ | プラグインマーケットプレイス |

これらは補完関係にある。**Skills は「オンデマンドで呼び出す再利用可能なタスクプロンプト」、Subagents は「委譲先の永続的エージェント定義」、Hooks は「イベント駆動の自動化」、Plugins は「その配布単位」**。

## オープン標準: `AGENTS.md` と Agent Skills

2026 年初頭時点で 2 つの共通標準が確立している。

- **`AGENTS.md`**: プロジェクトガイダンスの共通ファイル。Linux Foundation 配下の Agentic AI Foundation が標準化。4 CLI すべてが対応（Claude Code は `CLAUDE.md` を主軸にしつつ `AGENTS.md` も併読）。詳細は `ai/platform/agents-md.md`
- **Agent Skills（`SKILL.md`）**: スキル定義の共通フォーマット。`name` / `description` が必須 frontmatter。Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI の全 4 CLI が読み込む

結果として、**1 つの `SKILL.md` を複数エージェントで共有できる**。リポジトリ `.agents/skills/` 配下に置けば 4 CLI すべてが発見する。

## Skills 横断比較

| 項目 | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Project path | `.claude/skills/` | `.agents/skills/` | `.gemini/skills/` または `.agents/skills/` | `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Personal path | `~/.claude/skills/` | `~/.agents/skills/` | `~/.gemini/skills/` | `~/.copilot/skills/` 他 |
| 管理コマンド | `/plugin` UI 内 | `/skills` | `/skills list\|link\|disable\|enable\|reload` | `/skills list\|info\|reload\|remove` |
| 自動発火 | `description` マッチで自動 | `$skill-name` メンション + 暗黙 | `activate_skill` ツール（ユーザー確認） | 推論ベース |

**注意**: GitHub Copilot CLI は `.claude/skills/` と `.agents/skills/` も同時にサポートする設計になっており、**他 CLI の skills を相互運用できる**。

### SKILL.md の標準 frontmatter

```markdown
---
name: code-review
description: Review code for best practices and security. Use when reviewing PRs.
allowed-tools: Read Grep Glob
---

コードレビュー時は以下をチェック:
- セキュリティ脆弱性
- パフォーマンス問題
```

`name` と `description` は必須。`allowed-tools` は多くの CLI が共通サポート。Claude Code 固有に `when_to_use` / `argument-hint` / `paths` / `hooks` / `effort` / `context: fork` 等、Copilot CLI 固有に `license`、Codex CLI 固有に `agents/openai.yaml` がある。

### Progressive disclosure

全 4 CLI が共通して、**起動時は `description` のみ常駐**し、トリガーされた時点で本文がロードされる。これによりスキル数が増えてもコンテキストを食わない。詳細は `ai/practice/ai-context-management.md`。

## Subagents 横断比較

| 項目 | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| Project path | `.claude/agents/<name>.md` | `.codex/agents/` | `.gemini/agents/` | `.github/agents/<name>.agent.md` |
| Personal path | `~/.claude/agents/` | `~/.codex/agents/` | `~/.gemini/agents/` | `~/.copilot/agents/` |
| 発火モデル | 自動委譲 + `/agents` + Agent ツール | **明示的 spawn のみ** | 自動委譲 + `@name` 強制 | `/agent` + `--agent` + 推論 |
| 必須 frontmatter | `name`, `description` | `name`, `description`, `developer_instructions` | `name`, `description` | `description`（`name` は省略可） |
| モデル継承 | `inherit` | model 指定必須 | `inherit` 可 | model 指定可 |
| 再帰呼び出し | `Agent` ツール経由で可能 | `max_depth` で制御（デフォルト 1） | **不可** | 仕様不明 |

**発火モデルの違いに注意**: Codex CLI の subagent は**ユーザーが明示的にリクエストしない限り spawn しない**。Claude Code の自動委譲とは設計思想が異なる。

### 委譲判断の原則

- 探索範囲が広い（多数ファイルの grep / 読み込み）→ 委譲
- 失敗が多く試行錯誤が必要 → 委譲（親コンテキスト汚染回避）
- 結果が小さく親で直接やった方が早い → 委譲しない

詳細は `ai/practice/ai-context-management.md` のサブエージェント節。

## Hooks 横断比較

| 項目 | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| イベント数 | 約 23 | 6（experimental） | 11 | 6 |
| 設定場所 | `settings.json` の `hooks` | `~/.codex/hooks.json` / `<repo>/.codex/hooks.json` | `settings.json` の `hooks` | `.github/hooks/*.json` |
| 有効化 | デフォルト | `[features] codex_hooks = true` | デフォルト | デフォルト |
| 決定返却 | `hookSpecificOutput.permissionDecision` (`allow`/`deny`/`ask`/`defer`) | exit 2 or permissionDecision | exit 2 = block | `preToolUse` のみ permissionDecision |
| ハンドラ種類 | `command` / `http` / `prompt` / `agent` | `command` | `command` | `command`（`bash`/`powershell`） |

### 共通する主要イベント

4 CLI すべてが対応する中核イベント:

- **SessionStart / SessionEnd**: 起動・終了時のフック
- **PreToolUse**: ツール実行前（許可/拒否の判定機会）
- **PostToolUse**: ツール実行後（結果検証）
- **UserPromptSubmit**: ユーザー発話直前

Claude Code のみ対応する高度イベント（例）:

- `SubagentStart` / `SubagentStop` / `PreCompact` / `PostCompact` / `TeammateIdle` / `WorktreeCreate` など

### Hooks の使いどころ

- **PreToolUse で破壊的コマンドを拒否**（`rm -rf`、`git push --force` の検査）
- **PostToolUse で自動フォーマッタ**（編集後に prettier / biome を回す）
- **SessionStart でシークレットスキャン**（Gitleaks で commit 済みシークレットを確認）
- **PreCompact で重要情報をメモリに退避**（Claude Code のみ）

詳細は各 CLI の記事を参照。

## Plugins / Extensions 横断比較

| 項目 | Claude Code | Codex CLI | Gemini CLI | GitHub Copilot CLI |
|---|---|---|---|---|
| マニフェスト | `.claude-plugin/plugin.json` | Plugin marketplace（2026 初頭追加） | `gemini-extension.json` | `plugin.json` |
| 含められるもの | skills / agents / hooks / commands / MCP / monitors | skills / agents / MCP | commands / hooks / skills / agents / policies / themes / MCP | agents / skills / hooks / MCP / LSP |
| インストール | `/plugin install <name>` | `/plugins`（インタラクティブブラウザ） | `gemini extensions install <github-url>` | `/plugin install owner/repo` |
| 名前空間 | `plugin-name:skill-name` | `<plugin>@<marketplace>`（例 `gmail@openai-curated`） | 同名衝突時に `<extension>.<command>` | リポジトリ名ベース |

**セキュリティ制約**:

- **Claude Code**: プラグインから提供されるサブエージェントは `hooks` / `mcpServers` / `permissionMode` をサポートしない（昇格攻撃対策）
- **Gemini CLI**: プロジェクト hooks をフィンガープリントし、変更時に警告を出す

## MCP（Model Context Protocol）統合

すべての CLI が MCP サーバーをネイティブ統合。これは**拡張機構の外部リソース接続面**。詳細は `ai/platform/mcp-protocol.md`。

| CLI | 設定場所 | スコープ |
|---|---|---|
| Claude Code | `~/.claude.json`（user）/ `.mcp.json`（project）/ `settings.local.json`（local） | Local > Project > User |
| Codex CLI | `~/.codex/config.toml` の `[mcp_servers.<id>]` | - |
| Gemini CLI | `settings.json` の `mcpServers` | Project > User |
| Copilot CLI | `~/.copilot/mcp-config.json` / `.mcp.json` / `.github/mcp.json` | - |

## 機能対応マトリクス

| 機能 | Claude Code | Codex CLI | Gemini CLI | Copilot CLI |
|---|---|---|---|---|
| AGENTS.md | Yes（CLAUDE.md 優先） | Yes | Yes | Yes |
| Skills（オープン標準） | Yes | Yes | Yes | Yes |
| Subagents | Yes（自動委譲） | Yes（明示のみ） | Yes（自動+@） | Yes（複数手段） |
| Hooks | 23 events | 6 events (experimental) | 11 events | 6 events |
| Plugins / Extensions | Yes（成熟） | Yes（marketplace） | Yes（Extensions） | Yes |
| MCP | Yes | Yes | Yes | Yes |
| Custom slash commands | Skills に統合 | Deprecated（Skills 推奨） | `.toml` ベース | プラグイン経由 |
| Output styles | Yes | No | No | No |
| Status line | Yes | No | No | No |

## 自動発火トリガーの違い

エージェントが **Skills / Subagents をいつ発火するか** は CLI ごとに設計思想が異なる。

- **Claude Code**: `description` テキストのマッチングで積極的に自動委譲。`disable-model-invocation: true` / `user-invocable: false` で制御
- **Codex CLI**: Subagent は**ユーザーが明示的にリクエストしないと spawn しない**設計。Skills は暗黙発火もあるが保守的
- **Gemini CLI**: Skills は `activate_skill` ツール経由でユーザー確認必須。Subagent は自動委譲 + `@name` 強制
- **Copilot CLI**: 推論ベースで自動。`/agent` で明示選択も可

この違いは**コンテキスト汚染とセキュリティ**のトレードオフ。自動発火は便利だが、プロンプトインジェクションで悪意あるスキルを呼ばされるリスクがある（`ai/practice/prompt-injection.md` 参照）。

## AI エージェントがよくやるミス

1. **スキルとサブエージェントを混同** — スキルは「タスク用プロンプト」、サブエージェントは「委譲先の独立コンテキスト」。`context: fork` を指定して初めてスキルが子エージェントで実行される
2. **`allowed-tools` を deny リストだと誤認** — 許可確認をスキップするホワイトリストにすぎない。禁止は `disallowed-tools` / `denyTools` 等で明示する
3. **CLI ごとのディレクトリパスを混同** — GitHub Copilot CLI の custom agents は `.github/agents/`（`.agents/` ではない）、拡張子は `.agent.md`
4. **Claude Code subagent の `skip-tools` と書く** — 正しくは `disallowedTools`。古いドキュメントに残る誤記
5. **Hooks で exit 2 と exit 1 を混同** — 多くの CLI で exit 2 が「ブロック」、exit 1 は「エラー終了だがブロックしない」
6. **プラグインの名前空間を忘れる** — Claude Code のプラグイン skill は `plugin-name:skill-name` で呼ぶ必要がある

## 参考

- [Agent Skills オープン標準](https://agentskills.io/)
- [AGENTS.md](https://agents.md/)
- 本リポジトリの `ai/platform/agents-md.md` — 共通指示ファイル
- 本リポジトリの `ai/practice/ai-context-management.md` — コンテキスト設計
- 本リポジトリの `ai/practice/prompt-injection.md` — 拡張機構のセキュリティ
- 本リポジトリの `ai/practice/multi-agent-repo.md` — 複数エージェント対応リポジトリの設計
