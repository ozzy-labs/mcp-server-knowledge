---
reviewed: 2026-04-18
tags: [ai-workflow, commercial]
---

# Codex CLI

OpenAI が提供するオープンソースのコーディングエージェント CLI。フルスクリーン TUI でコードの読み取り・編集・コマンド実行を行い、マルチエージェント並列処理もサポートする。拡張機構の横断比較は `standards/agent-extensions.md` を参照。

## インストール

```bash
# npm（Node.js 22+ 必要）
npm install -g @openai/codex

# Homebrew
brew install codex

# バイナリ直接ダウンロード
# https://github.com/openai/codex/releases
# Apple Silicon, x86_64 Mac, x86_64 Linux, arm64 Linux 対応
```

## 認証

初回起動時に ChatGPT アカウントでブラウザ OAuth 認証。以下のいずれかのプランが必要:

- ChatGPT Plus / Pro / Team / Edu / Enterprise

## 基本コマンド

```bash
codex                    # フルスクリーン TUI セッション開始
codex "プロンプト"        # ワンショット実行
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/model` | モデル切り替え |
| `/help` | ヘルプ表示 |
| `/share` | セッション共有 |
| `/exit` | セッション終了 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.codex/config.toml` | グローバル設定 | - |
| `~/.codex/AGENTS.md` / `AGENTS.override.md` | ユーザーグローバル指示 | - |
| `~/.codex/agents/` | ユーザー subagent 定義 | - |
| `~/.codex/hooks.json` | ユーザー hooks（experimental） | - |
| `~/.agents/skills/` | ユーザー skills | - |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |
| `.agents/skills/<name>/SKILL.md` | プロジェクト skills | Yes |
| `.codex/agents/<name>.md` | プロジェクト subagent 定義 | Yes |
| `.codex/hooks.json` | プロジェクト hooks（experimental） | Yes |

### config.toml の主要設定

```toml
# デフォルトモデル（例）。省略時は CLI 同梱のモデルカタログから自動選択される
model = "gpt-5.4"

# 推論の深さ（minimal, low, medium, high, xhigh）※ xhigh はモデル依存
model_reasoning_effort = "medium"

# サンドボックスモード: "read-only" / "workspace-write" / "danger-full-access"
sandbox_mode = "workspace-write"

# 承認ポリシー: "untrusted", "on-request", "never"
approval_policy = "on-request"

# MCP サーバー
[mcp_servers.my-server]
command = "node"
args = ["/path/to/server.js"]

# MCP ツールごとの承認設定
[mcp_servers.my-server.tools.search]
approval_mode = "approve"

# 通知（エージェント完了時に実行）
[notify]
command = "/path/to/notify-script.sh"
```

### 同梱モデル（rust-v0.121.0 時点、2026-04）

`/model` ピッカーが露出するモデル（優先度順）:

| モデル | 説明 |
|---|---|
| `gpt-5.4` | 最新のフロンティア agentic coding モデル |
| `gpt-5.3-codex` | 一世代前。UI で `gpt-5.4` へのアップグレード案内が出る |
| `gpt-5.2-codex` | 低優先度。明示指定時のみ使用 |

古い資料にある `o4-mini` は同梱カタログから削除済み。`model_presets.rs` のハードコードも撤廃され、`models-manager/models.json` のカタログから動的に列挙される。

## 主要機能

- **フルスクリーン TUI**: インタラクティブなターミナル UI
- **マルチエージェント**: 複数のエージェントが独立した Git worktree で並列実行
- **ミッドターンステアリング**: エージェント作業中にメッセージを送信して方向修正
- **ファイル添付**: スクリーンショットやデザイン仕様を添付可能
- **コードレビュー**: コミット前に別エージェントが自動レビュー
- **セッション記録**: ローカルに保存され、後から再開可能
- **MCP 統合**: Model Context Protocol サーバーとの連携（ツール単位で承認制御）
- **推論レベル調整**: タスクに応じて推論の深さを調整

## 承認ポリシー

| ポリシー | 説明 |
|---|---|
| `untrusted` | すべてのアクションを確認 |
| `on-request` | ファイル編集は自動、コマンド実行は確認 |
| `never` | すべて自動実行 |

`config.toml` の `approval_policy` で設定。

## サンドボックス

`config.toml` の `sandbox_mode` で設定:

| モード | 説明 |
|---|---|
| `read-only` | 読み取りのみ許可（デフォルト、最も安全） |
| `workspace-write` | CWD 配下の書き込みを許可（コマンド実行は OS のサンドボックスで制約） |
| `danger-full-access` | サンドボックスなし。CI / コンテナ内など既に隔離された環境でのみ使用 |

プラットフォーム固有のサンドボックス実装: macOS は Seatbelt、Linux は Landlock/seccomp。Docker / Podman コンテナ内で動かす場合は `danger-full-access` + 外側のコンテナ隔離を推奨。

## Skills

`Agent Skills` オープン標準に準拠。`SKILL.md` を配置して読み込ませる。

```text
.agents/skills/code-review/
├── SKILL.md               # 必須。frontmatter + 本文
├── agents/openai.yaml     # Codex 固有メタ（任意）
├── scripts/               # （任意）
├── references/            # （任意）
└── assets/                # （任意）
```

**探索順**:

1. `.agents/skills/`（CWD → 親 → リポジトリルート）
2. `$HOME/.agents/skills/`
3. `/etc/codex/skills/`（管理者）
4. 組み込み

**SKILL.md frontmatter**:

```markdown
---
name: code-review
description: Review code for security and best practices
---

コードレビュー時は...
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | スキル名 |
| `description` | Yes | 発見の鍵 |

**呼び出し**: `/skills` コマンド、`$skill-name` メンション、または暗黙的発火。

### Custom Prompts（deprecated）

旧 `~/.codex/prompts/*.md`（トップレベルのみ）は廃止予定。新規は Skills を使う。

## サブエージェント

`~/.codex/agents/`（personal）または `.codex/agents/`（project）に配置。**明示的にユーザーがリクエストしない限り spawn しない**（Claude Code の自動委譲と対照的）。

`config.toml` で制御:

```toml
[agents]
max_threads = 6       # 並列 spawn 上限
max_depth = 1         # 再帰の深さ
job_max_runtime_seconds = 600
```

**カスタム agent file の frontmatter**:

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | エージェント識別子 |
| `description` | Yes | 用途説明 |
| `developer_instructions` | Yes | システムプロンプト |
| `nickname_candidates` | - | 呼び出し用エイリアス |
| `model` | - | 使用モデル |
| `model_reasoning_effort` | - | 推論深さ |
| `sandbox_mode` | - | サンドボックス上書き |
| `mcp_servers` | - | 利用可能な MCP |
| `skills.config` | - | preload スキル |

**ビルトイン**: `default` / `worker` / `explorer`。

## Hooks（experimental）

`[features] codex_hooks = true` で有効化。`~/.codex/hooks.json` または `<repo>/.codex/hooks.json`。

**対応イベント（5 種類）**:

| イベント | タイミング |
|---|---|
| `SessionStart` | セッション開始 |
| `PreToolUse` | ツール実行前（Bash のみ）。`permissionDecision: deny` または exit 2 でブロック |
| `PostToolUse` | ツール実行後 |
| `UserPromptSubmit` | ユーザー発話直前 |
| `Stop` | セッション終了 |

**注意**: Windows は一時的にサポート外。仕様は experimental 扱いで流動的。

## エージェント統合

### 指示ファイル

`AGENTS.md` をプロジェクトルートに配置。Codex CLI が自動で読み込む。

- ユーザーグローバル: `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md` の順で読む
- プロジェクト: Git リポジトリルートから CWD まで階層的に読み、近いほど優先
- 合計 `project_doc_max_bytes`（デフォルト 32 KiB）で打ち切り

### MCP サーバー登録

`~/.codex/config.toml` に設定:

```toml
[mcp_servers.knowledge]
command = "node"
args = ["/path/to/knowledge-mcp-server/dist/index.js"]
```

## 制限事項

- ChatGPT 有料プランが必要
- Windows は WSL 経由のみ対応

## システム要件

- macOS, Linux（フルサポート）、Windows（WSL 経由）
- Node.js 22+
- RAM: 4 GB 以上（8 GB 推奨）
