---
reviewed: 2026-06-07
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

`gpt-5.5` は ChatGPT サインインおよび OpenAI API（モデル ID `gpt-5.5`、2026-04-24 提供開始）の双方から利用可能。

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
| `/plan` | プラン作成・編集 |
| `/status` | セッションステータス表示 |
| `/resume` `/fork [name]` | セッション再開 / 独立フォーク |
| `/agent` | サブエージェント呼び出し |
| `/permissions` | 承認ポリシーの切り替え（旧 `/approvals` は `/approve` にリネーム） |
| `/diff` `/review` | 変更差分のレビュー |
| `/compact` | コンテキスト圧縮 |
| `/plugins` `/apps` `/mcp` | プラグイン・アプリ・MCP サーバー管理 |
| `/init` | プロジェクト初期化 |
| `/vim` | composer の Vim モーダル編集をトグル（v0.129.0+） |
| `/hooks` | hooks の参照・有効化トグル（v0.129.0+） |
| `/keymap` `/statusline` `/title` | UI カスタマイズ |
| `/help` `/quit` `/exit` | ヘルプ / 終了 |

公式の全量は [Codex CLI slash commands](https://developers.openai.com/codex/cli/slash-commands) を参照。

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

# 承認ポリシー: "untrusted" / "on-request"（デフォルト） / "never" / "granular"
# 旧 "on-failure" は deprecated（"on-request" もしくは "never" を使用）
approval_policy = "on-request"
```

### 同梱モデル（rust-v0.137.0 時点、2026-06-04）

`/model` ピッカーで選択可能な推奨モデル:

| モデル | 説明 |
|---|---|
| `gpt-5.5` | **新推奨モデル**。複雑コーディング・Computer Use・知識作業・リサーチ向け |
| `gpt-5.4` | Flagship。フォールバック用 |
| `gpt-5.4-mini` | 軽量・高速版 |
| `gpt-5.3-codex-spark` | research preview（ChatGPT Pro 向け） |

> **注意**: 旧 `gpt-5.3-codex` および `gpt-5.2` は ChatGPT サインイン時の Codex で deprecated。`gpt-5.5` 等の現行推奨モデルへ移行する。

## 主要機能

- **フルスクリーン TUI**: インタラクティブなターミナル UI
- **マルチエージェント**: 独立した Git worktree での並列実行
- **大規模スレッドのページング (v0.130+)**: 巨大な履歴の要約・フル表示切り替え
- **MCP 統合**: Model Context Protocol サーバーとの連携

## 承認ポリシー

| ポリシー | 説明 |
|---|---|
| `untrusted` | 既知の安全な読み取り専用コマンドのみ自動実行、他は承認待ち |
| `on-request` | エージェントが必要に応じて承認を求める（デフォルト推奨） |
| `never` | 承認を求めない（非対話実行向け。`sandbox_mode` と組み合わせて使う。リスク高） |
| `granular` | カテゴリ別に細粒度制御。`sandbox_approval` / `rules` / `mcp_elicitations` / `request_permissions` / `skill_approval` 等の sub-options を持つ |

`config.toml` の `approval_policy` で設定。旧 `on-failure` は deprecated（`on-request` もしくは `never` を使用）。TUI ピッカーの表示ラベル（Suggest / Auto Edit / Full Auto）は旧 UI 由来で、TOML の値とは異なる。

## サンドボックス

`config.toml` の `sandbox_mode` で設定: `read-only` / `workspace-write` / `danger-full-access`。

> **注意**: `--full-auto` フラグは v0.128.0 で deprecated（互換のため警告付きで残存）。代わりに `--sandbox workspace-write` と `--ask-for-approval never` を明示的に指定する（または `approval_policy = "never"` + `sandbox_mode = "workspace-write"` を設定する）。よりリスクの高い `sandbox_mode = "danger-full-access"` への置換も可能だが、隔離されたコンテナ等での利用に限る。

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
job_max_runtime_seconds = 1800
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

## Hooks

デフォルト有効。無効化は `[features] hooks = false`（`codex_hooks` は deprecated alias、v0.129 でリネーム）。`~/.codex/hooks.json` または `<repo>/.codex/hooks.json`。

**対応イベント（6 種類）**:

| イベント | タイミング |
|---|---|
| `SessionStart` | セッション開始・resume 時 |
| `PreToolUse` | ツール実行前（Bash / apply_patch / MCP ツール）。`permissionDecision: deny` または exit 2 でブロック。v0.129 で `additionalContext` サポート追加 |
| `PermissionRequest` | 承認要求時（権限エスカレーション・ネットワークアクセス等） |
| `PostToolUse` | ツール実行後 |
| `UserPromptSubmit` | ユーザー発話直前 |
| `Stop` | 会話ターン終了 |

v0.129 で compaction 前後でも hook 実行サポート、`/hooks` ブラウザで参照・トグル可能に。

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
- Windows は公式インストール手順上 WSL2 経由のみ案内（ネイティブ x86_64/aarch64 バイナリも release artifact として配布あり）

## システム要件

- macOS 12+, Ubuntu 20.04+/Debian 10+, Windows 11（WSL2 経由を公式推奨）
- Node.js 16+（npm install 経由の場合）
- RAM: 4 GB 以上（8 GB 推奨）
