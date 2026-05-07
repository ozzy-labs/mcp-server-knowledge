---
reviewed: 2026-05-07
tags: [ai-workflow, commercial]
---

# Codex CLI

OpenAI が提供するオープンソースのコーディングエージェント CLI。フルスクリーン TUI でコードの読み取り・編集・コマンド実行を行い、マルチエージェント並列処理もサポートする。

## インストール

```bash
# npm（Node.js 16+ 必要）
npm install -g @openai/codex

# Homebrew（cask 配布）
brew install --cask codex

# バイナリ直接ダウンロード
# https://github.com/openai/codex/releases
```

## 認証

初回起動時にサインイン。以下のいずれかで認証:

- ChatGPT アカウント（有料プラン推奨）でブラウザ OAuth
- OpenAI API key（`OPENAI_API_KEY` 環境変数）

なお、`gpt-5.5` は ChatGPT サインイン経由でのみ利用可能。

## 基本コマンド

```bash
codex                    # フルスクリーン TUI セッション開始
codex "プロンプト"        # ワンショット実行
codex update             # CLI を最新バージョンに更新
codex remote-control     # リモート制御エントリポイント (v0.130+)
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/model` | モデル切り替え |
| `/goal` | 永続ゴール設定（作成・一時停止・再開・クリア） |
| `/vim` | composer の Vim モーダル編集をトグル（v0.129.0+） |
| `/hooks` | hooks の参照・有効化トグル（v0.129.0+） |
| `/help` | ヘルプ表示 |
| `/share` | セッション共有 |
| `/exit` | セッション終了 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.codex/config.toml` | グローバル設定 | - |
| `AGENTS.md` | プロジェクト固有の指示 | Yes |

### config.toml の主要設定

```toml
# デフォルトモデル
model = "gpt-5.5"

# 推論の深さ（minimal, low, medium, high, xhigh）
model_reasoning_effort = "medium"

# 承認ポリシー: "Suggest", "Auto Edit", "Full Auto"
approval_policy = "Auto Edit"
```

### 同梱モデル（rust-v0.129.0 時点、2026-05-07）

`/model` ピッカーで選択可能な推奨モデル:

| モデル | 説明 |
|---|---|
| `gpt-5.5` | **新推奨モデル**。複雑コーディング・Computer Use 向け |
| `gpt-5.4` | Flagship。フォールバック用 |
| `gpt-5.4-mini` | 軽量・高速版 |
| `gpt-5.3-codex` | 旧コーディング特化モデル |

## 主要機能

- **フルスクリーン TUI**: インタラクティブなターミナル UI
- **マルチエージェント**: 独立した Git worktree での並列実行
- **大規模スレッドのページング (v0.130+)**: 巨大な履歴の要約・フル表示切り替え
- **MCP 統合**: Model Context Protocol サーバーとの連携

## 承認ポリシー

| ポリシー | 説明 |
|---|---|
| `Suggest` | 提案のみ（実行はすべて要承認） |
| `Auto Edit` | ファイル書き換えは自動、コマンド実行は確認 |
| `Full Auto` | コマンド実行まで自動 |

`config.toml` の `approval_policy` で設定。

## サンドボックス

`config.toml` の `sandbox_mode` で設定: `read-only` / `workspace-write` / `danger-full-access`。

> **注意**: `--full-auto` フラグは非推奨。代わりに `approval_policy = "Full Auto"` を使用すること。

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

**対応イベント（6 種類）**:

| イベント | タイミング |
|---|---|
| `SessionStart` | セッション開始・resume 時 |
| `PreToolUse` | ツール実行前（Bash / apply_patch / MCP ツール）。`permissionDecision: deny` または exit 2 でブロック |
| `PermissionRequest` | 承認要求時（権限エスカレーション・ネットワークアクセス等） |
| `PostToolUse` | ツール実行後 |
| `UserPromptSubmit` | ユーザー発話直前 |
| `Stop` | 会話ターン終了 |

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
args = ["/path/to/mcp-server-knowledge/dist/index.js"]
```

## 制限事項

- ChatGPT 有料プランが必要
- Windows はネイティブ PowerShell または WSL2 経由で対応

## システム要件

- macOS, Linux（フルサポート）、Windows（ネイティブ PowerShell または WSL2 経由）
- Node.js 16+（npm install 経由の場合）
- RAM: 4 GB 以上（8 GB 推奨）
