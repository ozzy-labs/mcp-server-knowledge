---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, gcp]
---

# Gemini CLI

Google が提供するオープンソースの AI エージェント CLI。ReAct（Reason and Act）ループにより、複雑なコーディングタスク・デバッグ・自動化をターミナルから実行する。

## インストール

```bash
# npm（Node.js 20+ 必要）
npm install -g @google/gemini-cli

# npx（インストール不要）
npx @google/gemini-cli

# MacPorts
sudo port install gemini-cli
```

Google Cloud Shell にはプリインストール済み。

## 認証

3 つの認証方式:

- **Sign in with Google (OAuth)** — 個人 Google アカウント
- **Gemini API key** — `GEMINI_API_KEY` 環境変数（[AI Studio](https://aistudio.google.com/) で取得）
- **Vertex AI** — エンタープライズ / 組織アカウント用

`/auth` コマンドで対話的に変更可能。組織アカウントや Code Assist ライセンスを使う場合は `GOOGLE_CLOUD_PROJECT` 設定が必須。Headless 用途では API Key または Vertex AI 推奨。

## 基本コマンド

```bash
gemini                   # インタラクティブセッション開始
gemini --version         # バージョン表示
gemini --help            # ヘルプ表示
gemini update            # CLI を最新版に更新
```

## セッション内コマンド（主要抜粋）

| コマンド | 説明 |
|---|---|
| `/about` | バージョン情報表示 |
| `/auth` | 認証方式の対話的変更 |
| `/memory` | メモリ管理（add, list, inbox, refresh, show）。v0.42 で Auto Memory inbox フロー追加 |
| `/bug-memory` | メモリ関連バグ報告（v0.42 新規） |
| `/model` | 使用モデルの変更 |
| `/agents` | サブエージェント管理（list / reload / enable / disable / config） |
| `/plan` | Plan Mode への切替 |
| `/chat` `/clear` `/compress` | 会話操作・コンテキスト圧縮 |
| `/commands` | カスタムコマンド管理（list / reload、list は v0.42 新規） |
| `/extensions` | Extensions 管理（install / uninstall / list / update / enable / disable / link / new / validate / delete-alias） |
| `/skills` | Skills 管理（list / link / disable / enable / reload） |
| `/hooks` | Hooks 管理（list / panel / enable / disable / enable-all / disable-all） |
| `/mcp` | MCP サーバー管理 |
| `/ide` | IDE 連携 |
| `/init` `/resume` `/quit` `/exit --delete` | 初期化 / 再開 / 終了 |

公式の全量は `gh api repos/google-gemini/gemini-cli/contents/docs/reference/commands.md` または [docs](https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/commands.md) を参照。

## 主要機能

- **ReAct ループ**: 推論と行動を交互に繰り返す自律型アーキテクチャ
- **リアルタイム音声モード (v0.41+)**: 音声入出力対応。v0.42 で UX 改善（マイク表示・wave animation・Gemini Live バックエンドのプライバシー警告・カーソル位置への transcription 挿入）
- **Auto Memory inbox (v0.42)**: canonical-patch contract で会話からメモリを自動キャプチャ
- **ワークスペース・トラスト**: 自動化スクリプト実行時の信頼済みフォルダ管理
- **オフライン検索**: `ripgrep` がバンドルされ、高速なローカル検索が可能
- **4 層メモリ管理システム**: プロンプト駆動型の高度な記憶保持機能
- **MCP 統合**: Model Context Protocol サーバーとの連携

## 選択可能なモデル（v0.42 時点）

`--model` フラグ（または `/model` ダイアログ）でエイリアス指定。

| エイリアス | 解決先 |
|---|---|
| `auto` | Auto (Gemini 3) → `gemini-3-pro-preview` / `gemini-3-flash-preview`、Auto (Gemini 2.5) → `gemini-2.5-pro` / `gemini-2.5-flash` |
| `pro` | `gemini-2.5-pro` |
| `flash` | `gemini-2.5-flash` |
| `flash-lite` | `gemini-2.5-flash-lite` |

Gemini 3.1 系（`gemini-3.1-pro-preview` 等）は `/model` Manual または `-m gemini-3.1-pro-preview` で直接指定可能（順次ロールアウト中）。

**Gemma 4**: v0.41 で実験追加、v0.42 で Gemini API 経由のデフォルト有効化（#26307）。

フォールバック: Gemini 3 Pro が上限到達時は Gemini 2.5 Pro → 2.5 Flash に自動降格。

## 承認モード

`default`（確認あり）/ `auto_edit`（編集自動）/ `plan`（計画のみ）/ `yolo`（全アクション自動承認）の 4 モード。`--approval-mode` フラグまたは `settings.json` の `general.defaultApprovalMode` で指定する。`yolo` はコマンドラインからのみ有効化可能（`--yolo` / `-y` は deprecated、`--approval-mode=yolo` を推奨）。`security.disableYoloMode` で無効化できる。

## サンドボックス

Docker / Podman / OS ネイティブサンドボックスに対応。`settings.json` で詳細設定可能。

## Skills

2026-03 頃に追加された新機能。`Agent Skills` オープン標準準拠。

**探索ディレクトリ**（precedence: 低 → 高、後勝ち）:

1. Built-in
2. Extension bundled
3. User: `~/.gemini/skills/` または `~/.agents/skills/`
4. Workspace: `.gemini/skills/` または `.agents/skills/`

`.agents/skills/` のほうが `.gemini/skills/` より優先される（他 CLI との相互運用のため）。

**管理**: `/skills list | link | disable | enable | reload` および `gemini skills install`。`/skills disable` `/skills enable` のデフォルトスコープは user、`--scope workspace` で workspace に変更可能。アクティベーション時は `activate_skill` ツール経由でユーザー確認後、SKILL.md の本文とディレクトリ構造が会話履歴に注入される。

## サブエージェント

`.gemini/agents/`（project）または `~/.gemini/agents/`（user）に定義。

**frontmatter**:

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | slug |
| `description` | Yes | 用途 |
| `kind` | - | `local` / `remote` |
| `tools` | - | ワイルドカード `*`, `mcp_*`, `mcp_server_*` 対応 |
| `mcpServers` | - | inline 定義 |
| `model` | - | `inherit` 可 |
| `temperature` | - | 0.0-2.0 |
| `max_turns` | - | デフォルト 30 |
| `timeout_mins` | - | デフォルト 10 |

**ビルトイン**: `generalist` / `cli_help` / `codebase_investigator` / `browser_agent`（experimental、Chrome 144+ 必要）。

**呼び出し**: 自動委譲、または `@subagent-name` で強制呼び出し。**再帰不可**（subagent から subagent を呼べない）。

## カスタムコマンド

`.gemini/commands/*.toml` に TOML 形式で定義。サブディレクトリでネームスペース: `git/commit.toml` → `/git:commit`。

```toml
prompt = "以下のコミット: {{args}}\n\n!{git diff --staged}\n\n@{README.md}"
description = "ステージ済み変更のコミットメッセージを提案"
```

**プレースホルダ**:

- `{{args}}` — コマンド引数
- `!{shell command}` — シェルコマンドの実行結果を埋め込み
- `@{file}` — ファイル内容を埋め込み

**優先度**: Project `.gemini/commands/` > User `~/.gemini/commands/` > Extensions（同名衝突時に `<extension>.<command>` にプレフィックス）。

## Hooks

2025 年末〜2026 年初頭に追加。`settings.json` の `hooks` セクション。

**対応イベント（11 種類）**:

| カテゴリ | イベント |
|---|---|
| セッション | `SessionStart`, `SessionEnd` |
| エージェント | `BeforeAgent`, `AfterAgent` |
| モデル | `BeforeModel`, `AfterModel` |
| ツール | `BeforeToolSelection`, `BeforeTool`, `AfterTool` |
| コンテキスト | `PreCompress` |
| その他 | `Notification` |

exit 0 = success（ブロック含む全ロジックで推奨）、exit 2 = システムブロック（アクション中断）、その他 = 警告（続行）。Hook には JSON で `session_id` / `transcript_path` / `cwd` / `hook_event_name` / `timestamp` 等のフィールドが渡される。

Hook 定義のフィールド: `type` / `command` / `name` / `timeout`（デフォルト 60000ms） / `description` / `sequential`（並列/直列制御） / `matcher`。

**管理コマンド**: `/hooks panel`, `/hooks enable-all` など。

**セキュリティ**: プロジェクト hooks はフィンガープリントされ、変更時に警告が出る。

## Extensions

`gemini-extension.json` で定義するパッケージ。含められるもの: `commands/`, `hooks/hooks.json`, `skills/`, `agents/`, `policies/`, `themes/`, `mcpServers`, `contextFileName`, `excludeTools`, `settings`。

```bash
gemini extensions install <github-url>
gemini extensions uninstall <name>   # v0.42 で `delete` エイリアス追加
gemini extensions list
gemini extensions update <name>
gemini extensions enable|disable <name>
gemini extensions link|new|validate <path>
```

## エージェント統合

### 指示ファイル

`AGENTS.md` をプロジェクトルートに配置。Gemini CLI が自動で読み込む。追加で `GEMINI.md` や `CONTEXT.md` もコンテキストとして読み込み可能。

### MCP サーバー登録

`.gemini/settings.json`（プロジェクト単位）または `~/.gemini/settings.json`（グローバル）:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["/path/to/mcp-server-knowledge/dist/index.js"],
      "timeout": 15000,
      "trust": false
    }
  }
}
```

MCP サーバー固有の設定:

| フィールド | 説明 |
|---|---|
| `command` | 起動コマンド |
| `args` | コマンド引数 |
| `env` | 環境変数 |
| `cwd` | 作業ディレクトリ |
| `url` | SSE ベースサーバーの URL |
| `timeout` | タイムアウト（ミリ秒） |
| `trust` | true にするとツール呼び出し確認をスキップ |
| `includeTools` | 使用するツールのホワイトリスト |
| `excludeTools` | 除外するツールのブラックリスト |

## 無料枠

個人 Google アカウントで利用可能。無料枠のリクエスト制限あり（認証方式により異なる）。

有料オプション:

- **Google AI Pro / AI Ultra**: 個人向け、固定価格で上限拡大
- **Vertex AI**: エンタープライズ向け、従量課金

## 制限事項

- Node.js 20+ が必須
- Google Cloud アカウントの無料枠有効化に問題がある場合は `GOOGLE_CLOUD_PROJECT` の設定が必要

## システム要件

- macOS, Linux, Windows
- Node.js 20+
- RAM: 4 GB 以上推奨
