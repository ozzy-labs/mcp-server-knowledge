---
reviewed: 2026-05-11
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み（research preview）。プロンプト・リポジトリ・コネクタを保存した「ルーチン」を、Scheduled / API / GitHub event の各トリガーで自動実行する。Claude Code on the web が有効な Pro / Max / Team / Enterprise プランで利用可能。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines)

## 作成・管理

- Web: [claude.ai/code/routines](https://claude.ai/code/routines)
- CLI: `/schedule` で会話的に作成（schedule trigger のみ。API / GitHub trigger は Web 限定）
- Desktop アプリ: **Routines → New routine → Remote**
- ルーチン作成フォームでモデルを選択でき、毎回そのモデルで実行される

## 動作モデル

- **クラウド実行**: Anthropic 管理 VM 上で動作（ローカルがオフラインでも継続）。
- **完全自律**: 承認プロンプトなし。`AskUserQuestion` 系は機能しない前提で設計する。
- **fresh clone**: トリガー毎にリポジトリを default branch から clone。

## トリガー

| トリガー | 用途 |
|---|---|
| **Scheduled** | hourly / daily / weekdays / weekly のプリセット、または一回限りの実行。最小間隔 **1 時間**（カスタム cron は `/schedule update` で設定、1 時間未満は拒否される）。one-off は実行後に自動 disable され daily cap を消費しない。 |
| **API** | per-routine の HTTP POST endpoint (`/fire`) を bearer token で叩いて起動。`text` フィールドで run-specific context を渡せる（最大 65,536 文字、freeform string）。 |
| **GitHub** | Pull request / Release イベントに反応。フィルタは author / title / body / base branch / head branch / labels / is draft / is merged。Claude GitHub App のインストールが必須。 |

## 利用枠

| プラン | 1 日あたりの上限 |
|---|---|
| **Pro** | 5 回 |
| **Max** | 15 回 |
| **Team/Enterprise** | 25 回以上（順次緩和中） |

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — ルーチンは承認 prompt を返さない（permission-mode picker なし、approval prompt なし）。
2. **Setup script でリポ依存処理を試みる** — Setup script は環境キャッシュされ clone 前に実行される。`uv sync` 等はプロンプトに記述する。
3. **`network_access: trusted` の制限を忘れる** — 許可外ホストは `403 x-deny-reason: host_not_allowed`。任意ドメイン許可は `Custom`、全開放は `Full`。MCP コネクタ通信は Anthropic 経由なので allowlist 不要。
4. **`routine_id` プレフィックスの誤認** — URL では `routine_id` だが、実際の値は **`trig_`** プレフィックス。
5. **`/fire` のレスポンスで完了を待つ** — エンドポイントはセッション作成時に即リターンする（`claude_code_session_id` / `claude_code_session_url` のみ返る）。`anthropic-beta: experimental-cc-routine-2026-04-01` ヘッダ必須。
6. **既存ブランチに直 push できると思い込む** — デフォルトは `claude/`-prefix のみ。**Allow unrestricted branch pushes** を per-repository で有効化する必要がある。
7. **GitHub trigger を `/web-setup` だけで有効化** — `/web-setup` は clone 用のリポアクセスを付けるだけで、webhook 配信には Claude GitHub App のインストールが別途必要。
