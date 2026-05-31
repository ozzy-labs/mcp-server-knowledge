---
reviewed: 2026-05-17
tags: [ai-workflow, commercial]
aliases: [cc]
---

# Claude Code

Anthropic が提供する AI コーディングエージェント CLI。ターミナル上でコードベースの理解・編集・Git 操作・コマンド実行をエージェントが自律的に行う。

## インストール

```bash
# ネイティブインストーラー（推奨・自動アップデート対応・Node.js 不要）
curl -fsSL https://claude.ai/install.sh | bash    # macOS / Linux / WSL
irm https://claude.ai/install.ps1 | iex           # Windows PowerShell

# Homebrew（自動アップデートなし）
brew install --cask claude-code          # stable チャンネル
brew install --cask claude-code@latest  # latest チャンネル（v2.1.143 時点）

# WinGet
winget install Anthropic.ClaudeCode

# npm（非推奨）
npm install -g @anthropic-ai/claude-code
```

## 認証

初回起動時にブラウザで OAuth 認証。2026-05-06 以降、全有料プランで 5 時間あたりのメッセージ制限が **2 倍** に引き上げられた。

- Claude Pro / Max / Team / Enterprise
- API Console（API キー課金）

## 基本コマンド

```bash
claude                    # インタラクティブセッション開始
claude "プロンプト"        # ワンショット実行
claude --help             # ヘルプ表示
claude update             # CLI を最新版に更新
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示 |
| `/clear` | コンテキストクリア |
| `/compact` | コンテキスト圧縮 |
| `/model` | モデル切り替え |
| `/usage` | セッションコスト・プラン使用量・統計を表示。`/cost` と `/stats` は統合済み |
| `/agents` | サブエージェントの管理 |
| `/goal` | 永続ゴール設定（v2.1.139+） |
| `/plugins` | プラグインマネージャ UI |
| `/color` | セッションごとにランダムな UI 色を割り当て |

`claude agents`（CLI 直叩き、v2.1.139+ Research Preview）で agent view を起動できる。

カスタムコマンドは `.claude/commands/` に Markdown ファイルとして定義可能。

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.claude.json` | ユーザースコープ設定 | - |
| `CLAUDE.md` | プロジェクト固有の指示 | Yes |
| `.claude/settings.json` | プロジェクト固有の設定 | Yes |
| `.claude/rules/` | 追加ルールファイル | Yes |
| `.claude/commands/` | カスタムスラッシュコマンド | Yes |
| `.claude/agents/` | サブエージェント定義 | Yes |

### 環境変数

- `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN=1` — フルスクリーンモードを無効化し、ネイティブスクロールを維持。
- `CLAUDE_CODE_SESSION_ID` — セッション ID を参照可能（フック用）。

### 主要機能

- **エディタ統合**: VS Code や Cursor ターミナルでの動作最適化。拡張機能開発の基礎は [`platforms/vscode/vscode-extensions.md`](../../platforms/vscode/vscode-extensions.md) を参照。
- **ファイル編集**: コードの読み取り・編集・新規作成
- **コマンド実行**: シェルコマンドの実行と結果の解釈
- **Git 操作**: コミット・ブランチ・PR 作成を自然言語で
- **Routines (v2.1.130+)**: 非同期で PR 修正や定期タスクを実行する高次プロンプト（→ [`claude-code-routines.md`](claude-code-routines.md)）。
- **Claude Code on Desktop (2026-05 発表)**: GUI ベースで画像やリッチな出力を確認できるデスクトップ版。自律エージェント機能は [`claude-cowork.md`](claude-cowork.md) を参照。

### 拡張機構

- **MCP 統合**: Model Context Protocol サーバーとの連携
- **サブエージェント**: 専門タスク用の独立コンテキストエージェント（`.claude/agents/`）
- **スキル**: プロンプト + コンテキストのバンドル（`.claude/skills/`）
- **プラグイン**: コマンド・エージェント・スキル等をバンドル配布。`--plugin-url` で外部読み込み可能。

### 体験カスタマイズ

- **出力スタイル**: 応答のトーンと形式をプロジェクト単位で切り替え（`.claude/output-styles/`）
- **ステータスライン**: モデル・コスト・コンテキスト使用率などをターミナル下部に常時表示

### 運用

- **スケジュール実行**: Anthropic インフラ上で定期実行

## 権限モード

| モード | 説明 |
|---|---|
| Ask | すべてのツール呼び出しを確認 |
| Auto-edit | ファイル編集は自動、コマンド実行は確認 |
| Full auto | すべて自動実行（allowlist で制御可能） |

`settings.json` の `permissions` で詳細制御:

```json
{
  "permissions": {
    "allow": ["Read", "Glob", "Grep"],
    "ask": ["Bash"],
    "deny": ["WebSearch"]
  }
}
```

## フックシステム

ツール実行やセッションイベントの前後に自動処理を挟む仕組み。ハンドラ種別は `command`（シェル実行）/ `prompt`（LLM 評価）/ `http`（HTTP POST）/ `agent`（サブエージェント呼び出し）/ `mcp_tool`（MCP ツール直接呼び出し、v2.1.118 追加）の 5 種類。

**主要イベント**（30 種前後）:

| カテゴリ | イベント |
|---|---|
| セッション | `SessionStart`, `Setup`（`--init-only`）, `SessionEnd` |
| ターン | `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `StopFailure` |
| ツール | `PreToolUse`, `PermissionRequest`, `PermissionDenied`, `PostToolUse`, `PostToolBatch`, `PostToolUseFailure` |
| サブエージェント | `SubagentStart`, `SubagentStop` |
| タスク | `TeammateIdle`, `TaskCreated`, `TaskCompleted` |
| 非同期 | `Notification`, `CwdChanged`, `FileChanged`, `InstructionsLoaded`, `ConfigChange` |
| コンテキスト | `PreCompact`, `PostCompact` |
| MCP / worktree | `Elicitation`, `ElicitationResult`, `WorktreeCreate`, `WorktreeRemove` |

```json
{
  "PreToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "bash ./scripts/validate.sh",
          "timeout": 5
        }
      ]
    }
  ]
}
```

**応答**: exit 0 = 許可、exit 2 = 拒否（stderr がエラーメッセージとしてフィードバック）。PreToolUse では `hookSpecificOutput.permissionDecision` で `allow` / `deny` / `ask` / `defer`（2025 年末追加）を返してより細かく制御できる。`async`, `asyncRewake`, `statusMessage`, `once`, `shell`, `args`（exec form, シェル経由なし、v2.1.139）フィールドあり。`conditional` の `if` フィールドでパーミッションルール構文（例: `Bash(git *)`）を使い、フックが発火する条件を絞り込める（v2.1.85）。PostToolUse フックは `hookSpecificOutput.updatedToolOutput` で全ツールの出力を差し替え可能（v2.1.121）、`continueOnBlock`（v2.1.139）で deny されても次の hook を続行可能。`terminalSequence`（v2.1.141）で OSC 9/777 等の terminal escape を出力して desktop 通知を出せる。

## サブエージェント

メインセッションから独立した文脈で動作する専門エージェント。`.claude/agents/<name>.md` または `~/.claude/agents/<name>.md` に定義する。

```markdown
---
name: code-explorer
description: Explore and understand codebases. Use when analyzing project structure.
model: haiku
tools: Grep Glob Read
---

コードベースを体系的に分析してください...
```

`model` は `sonnet` / `opus` / `haiku` のエイリアス、または `claude-sonnet-4-6` / `claude-opus-4-7` のような明示 ID、`inherit`（親セッション継承）を指定できる。

| フィールド | 説明 |
|---|---|
| `name` | エージェント識別子（必須） |
| `description` | 自動委譲の判定に使用（必須） |
| `model` | 使用モデル（`inherit` で親セッション継承） |
| `tools` | 許可ツール（カンマまたは空白区切り） |
| `disallowedTools` | 拒否ツール |
| `permissionMode` | `default` / `acceptEdits` / `auto` / `dontAsk` / `bypassPermissions` / `plan` |
| `maxTurns` | 最大ターン数 |
| `skills` | プリロードするスキル |
| `mcpServers` | 利用可能な MCP サーバー |
| `hooks` | このエージェント内で有効な hooks |
| `memory` | `user` / `project` / `local` — `<scope>/agent-memory/<name>/` に永続化 |
| `isolation` | `worktree` で Git worktree に隔離 |
| `background` | `true` で非同期起動 |
| `effort` | 推論の深さ |
| `color` | UI 色分け |
| `initialPrompt` | 起動直後に流す指示 |

**本文は system prompt として扱われる**（`system-prompt` フィールドは存在しない）。

**呼び出し方**:

- **自動委譲**: `description` にマッチするタスクを検出して親エージェントが委譲
- **`/agents` コマンド**: インタラクティブに選択
- **Agent ツール経由**: スキル定義で `context: fork` + `agent: <name>` を指定した場合

**スコープ優先**（高→低）: Managed settings > `--agents` CLI flag (JSON) > Project (`.claude/agents/`) > User (`~/.claude/agents/`) > Plugin。

**ビルトインサブエージェント**:

| 名前 | 用途 |
|---|---|
| `Explore` | Haiku ベース。read-only の高速コード探索 |
| `Plan` | 親モデル継承、read-only。実装計画を立てる |
| `general-purpose` | 汎用的な委譲先 |
| `statusline-setup` | ステータスライン設定の対話 |
| `claude-code-guide` | Claude Code の機能に関する質問対応 |

v2.1.63 以降、旧名 `Task` ツールは `Agent` にリネームされている（エイリアスは残存）。

## スキル

タスク特化のプロンプト + コンテキストバンドル。`.claude/skills/<name>/SKILL.md` に定義する。

```markdown
---
name: code-review
description: Review code for best practices, security issues, and potential bugs. Use when reviewing code or checking PRs.
allowed-tools: Read Grep Glob
---

コードレビュー時は以下をチェック:
- セキュリティ脆弱性
- パフォーマンス問題
- テストカバレッジ
```

| フィールド | 説明 |
|---|---|
| `name` | スキル名（省略時はディレクトリ名。`/name` で呼び出し可能） |
| `description` | **発見の鍵**。`description` + `when_to_use` 合わせて最大 1,536 文字。冒頭にユースケースを置く |
| `when_to_use` | 追加のトリガー説明 |
| `argument-hint` / `arguments` | `/skill-name <args>` 呼び出し時の引数説明・解析定義 |
| `user-invocable` | `false` なら Claude のみ呼び出し可（デフォルト true） |
| `disable-model-invocation` | `true` ならユーザーのみ呼び出し可（デフォルト false） |
| `allowed-tools` | スキル有効中に許可確認をスキップするツール |
| `paths` | glob で自動発火対象パスを制限 |
| `model` | per-skill モデル上書き（`sonnet` / `opus` / `haiku` 等） |
| `effort` | per-skill 効果レベル（`xhigh` / `high` / `medium` / `low`） |
| `shell` | スキル内コマンドのシェル指定（`bash` / `powershell`） |
| `hooks` | このスキル有効中だけ作用する hooks |
| `context` | `fork` でサブエージェントコンテキストで実行 |
| `agent` | `context: fork` 時のエージェント名（デフォルト `general-purpose`） |

**Progressive disclosure**: 起動時は description だけがコンテキストに載り、トリガーされた時点で本文が読み込まれる。コンテキスト節約の核。

**呼び出し方**:

- **手動**: `/skill-name [arguments]`
- **自動**: `description` にタスクがマッチすれば Claude が自動発火

**サブエージェントとの違い**: サブエージェントは「委譲先の永続的エージェント定義」、スキルは「オンデマンドで呼び出す再利用可能なタスクプロンプト」。

## プラグイン / マーケットプレイス

コマンド・サブエージェント・スキル・フック・MCP サーバーをまとめてパッケージ化・配布する仕組み。

```text
my-plugin/
├── .claude-plugin/
│   └── plugin.json      # name, description, version, author
├── skills/
│   └── <skill-name>/SKILL.md
├── agents/
│   └── <agent-name>.md
├── hooks/
│   └── hooks.json
├── .mcp.json
└── .lsp.json
```

**主要コマンド**:

| コマンド | 用途 |
|---|---|
| `/plugin` | プラグインマネージャ UI |
| `/plugin install <name>` | マーケットプレイスからインストール |
| `/reload-plugins` | 開発中の再読み込み |
| `claude --plugin-dir ./path` | ローカルプラグインをテスト起動 |

**マーケットプレイス**:

- **公式**: `platform.claude.com/plugins` / `claude.ai/settings/plugins`
- **コミュニティ**: リポジトリ / カスタムレジストリで配布
- **チーム運用**: managed settings や team marketplace を指す

## 出力スタイル

応答のトーン・形式・ロールを切り替える仕組み。知識やツールは変更しない。`.claude/output-styles/<name>.md` または `~/.claude/output-styles/<name>.md` に配置。

```markdown
---
name: Japanese Technical Writer
description: 技術的な精度を保ち、フォーマルな日本語で応答
keep-coding-instructions: true
---

# Japanese Technical Mode

応答はすべて日本語で、ビジネス・技術文書のレジスタで書く...
```

| フィールド | 説明 |
|---|---|
| `name` | 表示名（省略時はファイル名） |
| `description` | `/config` の選択 UI で表示 |
| `keep-coding-instructions` | `true` で Claude Code のデフォルトコーディング指示を残す |

**選択方法**:

- `/config` → Output style → メニューから選択
- `settings.json` の `outputStyle` フィールドを編集（次セッションから有効）

**組み込みスタイル**: `Default` / `Explanatory`（教育的補足） / `Learning`（`TODO(human)` マーカー併用の協調モード）。

## ステータスライン

ターミナル下部にセッション情報を常時表示するカスタマイズ機能。シェルスクリプトが JSON を stdin から受け取り、標準出力をそのまま表示する。

`settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh",
    "padding": 2,
    "refreshInterval": 1
  }
}
```

スクリプト例:

```bash
#!/bin/bash
input=$(cat)
MODEL=$(echo "$input" | jq -r '.model.display_name')
PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
echo "[$MODEL] $PCT% context"
```

**JSON で受け取れる主なフィールド**:

- `model.display_name`, `model.id`
- `workspace.current_dir`（`cwd` エイリアス）, `workspace.project_dir`, `workspace.git_worktree`（linked worktree 内で設定）
- `context_window.used_percentage`, `context_window.remaining_percentage`
- `cost.total_cost_usd`, `cost.total_duration_ms`, `cost.total_api_duration_ms`
- `session_id`, `session_name`
- `rate_limits.five_hour.used_percentage`, `rate_limits.five_hour.resets_at`（Unix epoch）, `rate_limits.seven_day.used_percentage`, `rate_limits.seven_day.resets_at`
- `effort.level`, `thinking.enabled`（v2.1.119 追加）

**クイック設定**: `/statusline モデル名とコンテキスト使用率を表示` と送れば Claude がスクリプトを生成して自動設定する。

## エージェント統合

### 指示ファイル

`CLAUDE.md` をプロジェクトルートに配置。Claude Code が自動で読み込む。

### MCP サーバー登録

CLI コマンドで登録するのが推奨。スコープを指定してサーバーを追加する:

```bash
# ユーザースコープ（全プロジェクト共通）
claude mcp add --transport stdio <name> --scope user -- <command> [args...]

# プロジェクトスコープ（リポジトリで共有、.mcp.json に書き込み）
claude mcp add --transport stdio <name> --scope project -- <command> [args...]

# ローカルスコープ（このプロジェクトの自分だけ）
claude mcp add --transport stdio <name> --scope local -- <command> [args...]

# 登録状態・接続確認
claude mcp list
```

| スコープ | 書き込み先 | 共有範囲 |
|---|---|---|
| `user` | `~/.claude.json` の top-level `mcpServers` | 全プロジェクト |
| `project` | リポジトリ直下の `.mcp.json` | Git で共有 |
| `local` | プロジェクト固有ローカル | このマシンのみ |

手動で設定を書くときのフォーマット:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

**スコープ優先度**: Local > Project > User（同名サーバーがあれば優先度の高いものが勝つ）。

### カスタムコマンド

`.claude/commands/` に Markdown ファイルを配置:

```markdown
---
description: コードレビュー実行
allowed-tools: Read, Grep, Glob
---

以下のファイルをレビューしてください: $ARGUMENTS
```

## 制限事項

- 無料プランでは利用不可
- レート制限到達時はプロンプト送信が一時停止
- ネイティブインストーラー以外（npm）は非推奨

## システム要件

- macOS 10.15+, Ubuntu 20.04+ / Debian 10+, Windows 10+（WSL / Git Bash）
- RAM: 4 GB 以上（8 GB 推奨）
- シェル: Bash, Zsh, Fish
