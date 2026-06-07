---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, github]
aliases: [copilot]
---

# GitHub Copilot CLI

GitHub が提供する AI コーディングエージェント CLI。GitHub アカウントと深く統合され、計画・実行・テスト・レビューを自律的に行う。2026-02-25 に GA。

## インストール

```bash
# シェルスクリプト（推奨）
curl -fsSL https://gh.io/copilot-install | bash
# VERSION / PREFIX 環境変数で固定版・インストール先を指定可能

# Homebrew
brew install copilot-cli
brew install copilot-cli@prerelease     # prerelease チャネル

# npm
npm install -g @github/copilot
npm install -g @github/copilot@prerelease

# WinGet
winget install GitHub.Copilot
winget install GitHub.Copilot.Prerelease
```

初回起動時に bash / zsh / fish のシェル補完が自動インストールされる（v1.0.41 以降）。`copilot completion <bash|zsh|fish>` サブコマンドで手動取得も可能（v1.0.37）。

## 認証

OAuth デバイスフローまたは GitHub Personal Access Token (PAT) で認証。

## 基本コマンド

```bash
copilot                                  # インタラクティブセッション開始
copilot --experimental                   # experimental 機能を有効化
copilot -C <dir>                         # 起動前に作業ディレクトリを変更（v1.0.42）
copilot --attachment <file>              # prompt mode でファイルを添付（v1.0.41）
copilot --max-autopilot-continues <n>    # autopilot の連続継続上限（既定 5、v1.0.40）
copilot --resume                         # 過去セッションをピッカーから再開（-r ショートハンド、v1.0.60）
copilot completion <bash|zsh|fish>       # シェル補完スクリプト出力
```

## セッション内コマンド

| コマンド | 説明 |
|---|---|
| `/help` | ヘルプ表示（スラッシュコマンドはタブ補完に対応） |
| `/model` | モデル切り替え（Auto mode はサーバー側で最適モデルを選択） |
| `/experimental` | 実験的機能（ラバーダック・エージェント等）を有効化 |
| `/remote on/off` | GitHub.com やモバイルアプリからのリモート制御を切り替え |
| `/statusline` | ステータスラインの表示（ユーザー名等）をカスタマイズ |
| `/usage` | クォータ使用状況表示 |
| `/env` | 環境変数一覧表示 |
| `/model` | 使用モデルの切り替え |
| `/mcp` | 設定済み MCP サーバー一覧 |
| `/agent <name>` | カスタムエージェントを起動 |
| `/skills` | skill 一覧・管理（`list` / `info` / `reload` / `remove`） |
| `/lsp` | LSP サーバーの状態表示 |
| `/diff` | 変更差分のレビュー |
| `/undo` | 直前の操作を取り消し |
| `/remote` | リモートセッション情報表示（`on` / `off` トグル） |
| `/keep-alive` | セッションをバックグラウンドで維持（v1.0.36 で experimental flag 不要に） |
| `/fleet` | 複雑な要求を細分化し subagent で並列実行（v1.0.32 追加） |
| `/chronicle` | セッション履歴レビュー・standup（v1.0.31 追加、experimental） |
| `/research` | リサーチアシスタント（v1.0.41 追加。orchestrator/subagent モデルを利用） |
| `/pr` | PR の作成・参照（v1.0.40 追加） |
| `/autopilot` | interactive ↔ autopilot モードのトグル（v1.0.45 追加）。`/autopilot <objective>`（`/goal` エイリアス）で目標を固定（v1.0.55） |
| `/security-review` | コード変更のセキュリティ脆弱性レビュー（v1.0.51 追加） |
| `/memory` | Copilot Memory の有効化・無効化・状態表示（`on` / `off` / `show`、v1.0.49 追加。永続） |
| `/rubber-duck` | ラバーダックエージェントで作業に独立した批評を得る（v1.0.49 追加。v1.0.58 で既定有効化） |
| `/every` / `/after` | スケジュール実行プロンプト（v1.0.58 追加、experimental） |
| `/fork [name]` | 現セッションを独立した新セッションに fork（v1.0.45 追加。v1.0.47 で optional name と origin 表示） |
| `/session` | セッション管理（`delete` / `delete-all`、`--name` で命名） |
| `/plugin` | プラグイン管理（`install` / `list` / `remove`） |
| `/clear` / `/new` | 会話リセット（アクティブエージェント選択もリセット） |
| `/bug` / `/feedback` | フィードバック・バグ報告 |
| `/release-notes` | リリースノート表示 |
| `/export` | セッションをエクスポート |
| `/reset` | 設定リセット |
| `/version` | バージョン表示 |
| `/update` | CLI アップデート（v1.0.43 でダウンロード進捗表示、v1.0.44 で optional `prerelease` 引数追加） |
| `/exit` | セッション終了 |

## 設定ファイル

| パス | 用途 | Git 管理 |
|---|---|---|
| `~/.copilot/settings.json` | ユーザー設定（v1.0.35 で `config.json` から分離） | - |
| `~/.copilot/config.json` | CLI 内部ステート（自動管理） | - |
| `~/.copilot/mcp-config.json` | グローバル MCP サーバー設定 | - |
| `~/.copilot/lsp-config.json` | グローバル LSP 設定 | - |
| `~/.copilot/copilot-instructions.md` | 個人グローバル指示（全プロジェクト共通） | - |
| `~/.copilot/instructions/*.instructions.md` | 個人グローバル追加指示（v1.0.12 以降、自動読み込み） | - |
| `~/.copilot/agents/<name>.agent.md` | ユーザー custom agent | - |
| `~/.copilot/skills/<name>/SKILL.md` | ユーザー skill | - |
| `AGENTS.md` | プロジェクト固有の指示（repo root / CWD / `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` で指定したディレクトリで読まれる） | Yes |
| `.github/instructions/**/*.instructions.md` | プロジェクト追加指示（自動読み込み） | Yes |
| `.github/agents/<name>.agent.md` | プロジェクト custom agent | Yes |
| `.github/skills/<name>/SKILL.md` | プロジェクト skill（`.claude/skills/` / `.agents/skills/` も読む） | Yes |
| `.github/hooks/hooks.json` | プロジェクト hooks | Yes |
| `.github/lsp.json` | プロジェクト LSP 設定 | Yes |
| `.mcp.json` | プロジェクト MCP（v1.0.22 で `.vscode/mcp.json` / `.devcontainer/devcontainer.json` のサポートを廃止し `.mcp.json` に標準化。検出時は移行ヒントを表示） | Yes |
| `.github-private/.github/copilot/settings.json` | エンタープライズ管理プラグイン定義（2026-05-06 public preview） | Yes |
| `.github/copilot-instructions.md` | カスタム指示（レガシー） | Yes |

`COPILOT_HOME` 環境変数で設定ディレクトリを変更可能。

## 主要機能

- **Autopilot モード**: 計画・実行・テスト・修正の自律ループ。`/autopilot` でトグル（v1.0.45）
- **サーバーサイド・モデルルーティング**: Auto mode においてリアルタイムで最適なモデルを自動選択
- **read-only `gh` の自動承認**: v1.0.46 以降、`gh list` / `view` / `status` / `diff` 等の read-only サブコマンドはプロンプトなしで実行
- **OpenTelemetry**: v1.0.45 で GenAI semantic conventions に整合化、MCP tool 呼び出しは標準 `tool_call` span、`gen_ai.client.operation.duration` メトリックで tool 実行時間を計測
- **リモート制御**: ブラウザやモバイルから CLI セッションを監視・操作可能
- **LSP 統合**: TypeScript Language Server 等と連携した型情報の活用
- **MCP 統合**: Model Context Protocol サーバーとの連携
- **Rubber Duck エージェント**: 作業への独立した批評。v1.0.58 で既定有効化（`builtInAgents.rubberDuck` / `builtInAgents.rubberDuckAutoInvoke` で制御）。Remote JSON RPC も v1.0.58 で既定有効化

## カスタムエージェント

`.github/agents/<name>.agent.md`（project）または `~/.copilot/agents/<name>.agent.md`（user）に定義。**拡張子は `.agent.md` 固定**。スコープ優先は repository > organization > enterprise。

```markdown
---
name: db-specialist
description: データベース操作の専門エージェント
tools:
  - shell
  - view
  - edit
model: gpt-5
---

SQL クエリの最適化とスキーマ設計を支援します。
```

**frontmatter**:

| フィールド | 説明 |
|---|---|
| `name` | 識別子（省略時ファイル名） |
| `description` | 用途（必須） |
| `prompt` | システムプロンプト（または Markdown 本文で記述、最大 30,000 字） |
| `tools` | 許可ツール。`["*"]` で全許可、`[]` で全拒否 |
| `model` | 使用モデル |
| `disable-model-invocation` | `true` なら自動呼び出し禁止 |
| `user-invocable` | `false` ならユーザー呼び出し禁止 |
| `mcp-servers` | 利用可能な MCP |
| `target` | `vscode` / `github-copilot` / 両環境 |

**呼び出し**:

```bash
copilot --agent db-specialist --prompt "..."      # CLI フラグ
/agent db-specialist                               # セッション内
```

推論ベースで自動呼び出しされるほか、プロンプト内で名前を明示しても発火する。

## Skills

`Agent Skills` オープン標準準拠。**複数のディレクトリを同時にサポートし、他 CLI の skills を相互運用できる**。

| スコープ | 配置ディレクトリ（いずれも読まれる） |
|---|---|
| Project | `.github/skills/` / `.claude/skills/` / `.agents/skills/` |
| Personal | `~/.copilot/skills/` / `~/.agents/skills/` |

**SKILL.md frontmatter**:

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | lowercase+hyphens。**ディレクトリ名と一致必須**、不一致だと読み込まれない |
| `description` | Yes | 発見の鍵 |
| `allowed-tools` | - | 許可確認スキップ |
| `license` | - | ライセンス表記 |

**管理コマンド**: `/skills list | info | reload | remove`。2026-04 以降は `gh skill` サブコマンドで GitHub CLI 経由でも管理可能。

## Hooks

`.github/hooks/*.json`（repo）または CWD の `hooks.json`。

**対応イベント**（PascalCase / camelCase 両対応）:

| イベント | 説明 |
|---|---|
| `sessionStart` | セッション開始 |
| `sessionEnd` | セッション終了 |
| `userPromptSubmitted` | ユーザー発話直前。v1.0.44 以降は LLM 呼び出しをバイパスして直接レスポンスを返却可能 |
| `preToolUse` | ツール実行前。`permissionDecision: allow\|deny\|ask` を返せる |
| `postToolUse` | ツール実行後 |
| `postToolUseFailure` | ツールエラー発生時（v1.0.15 追加） |
| `permissionRequest` | スクリプトから programmatic に承認可能（v1.0.16 追加） |
| `preMcpToolCall` | 送信する MCP リクエストの metadata を制御（v1.0.51 追加） |
| `subagentStart` | subagent spawn 時（v1.0.7 追加） |
| `agentStop` / `subagentStop` | エージェント終了制御（v1.0.22 追加） |
| `preCompact` | コンテキスト圧縮直前（v1.0.5 追加） |
| `notification` | 非同期通知（v1.0.18 追加） |
| `errorOccurred` | エラー発生時（汎用） |

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "./scripts/guard.sh", "timeoutSec": 30 }
    ]
  }
}
```

`bash` / `powershell` キー両方対応。`timeoutSec` デフォルト 30 秒。

## プラグイン

`plugin.json` を root に置いてエージェント・スキル・フック・MCP・LSP を束ねて配布。

```text
my-plugin/
├── plugin.json
├── agents/<name>.agent.md
├── skills/<name>/SKILL.md
├── hooks/hooks.json
├── .github/mcp.json
└── lsp.json
```

**インストール**:

```bash
/plugin install owner/repo        # GitHub リポジトリ
copilot plugin install ./path     # ローカル
```

## エージェント統合

### 指示ファイル

読み込み対象:

- **個人グローバル**: `~/.copilot/copilot-instructions.md` — 全プロジェクトに適用
- **プロジェクト**: `AGENTS.md` — リポジトリルート / CWD / `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 環境変数（カンマ区切り）で指定したディレクトリ
- **追加**: `.github/instructions/**/*.instructions.md` — `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 配下も含めて自動読み込み

これらは Copilot CLI が自動で読み込む。

### MCP サーバー登録

`~/.copilot/mcp-config.json`（グローバル）に追加:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"]
    }
  }
}
```

CLI フラグで一時的に追加することも可能:

```bash
copilot --additional-mcp-config @/path/to/config.json
```

## 料金プラン

すべての GitHub Copilot プランで利用可能:

- Free（基本機能）
- Pro / Pro+
- Business / Enterprise

## 制限事項

- GitHub アカウントが必須
- GHES（GitHub Enterprise Server）利用時は `GH_HOST` の設定が必要

## システム要件

- macOS, Linux, Windows
- GitHub アカウント + Copilot プラン
