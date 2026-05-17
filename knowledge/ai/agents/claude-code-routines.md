---
reviewed: 2026-05-17
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み。`/model` セレクタで **Claude Opus 4.7** と **100 万トークンコンテキスト** を選択でき、トリガー駆動の自律実行プラットフォームとして使える。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines)

## 主要機能

- **Opus 4.7 & 1M Context**: モデルセレクタで選択可能。大規模リポジトリ全体の依存関係を一度に解析できる。
- **fresh clone モデル**: トリガー毎にリポジトリを default branch から clone し、変更は `claude/`-prefix ブランチに push。**Allow unrestricted branch pushes** を有効化すると既存ブランチへの push も可能。

### 関連機能（Routines 本体ではないが併用される）

- **Dreaming**（[Managed Agents](https://platform.claude.com/docs/en/managed-agents/dreams)）: 過去のセッションログを材料に memory store を再編成する研究プレビュー機能。Routines と同じ Claude Code エコシステムだが別レイヤー。研究プレビュー中は `claude-opus-4-7` / `claude-sonnet-4-6` をサポート。
- **`/ultrareview`**（[Claude Code 本体のスラッシュコマンド](https://code.claude.com/docs/en/ultrareview)）: カレントブランチと default ブランチの diff をレビューする multi-lens パイプライン。Routines 経由でも呼び出せる。

## 動作モデル

- **クラウド実行**: Anthropic 管理 VM 上で動作（ローカルがオフラインでも継続）。
- **完全自律**: 承認プロンプトなし。`AskUserQuestion` 系は機能しない前提で設計する。
- **fresh clone**: トリガー毎にリポジトリを default branch から clone。

## トリガー

| トリガー | 用途 |
|---|---|
| **Scheduled** | 特定周期（Cron 式対応）や一回限りの実行。最小実行間隔は 1 時間。 |
| **API** | HTTP POST (`/fire`) で外部から起動。`experimental-cc-routine-2026-04-01` beta header が必須。 |
| **GitHub** | Pull request / Release の 2 カテゴリのイベントに反応。 |

## 利用枠

research preview 中の参考値（変動するため、最新は [claude.ai/code/routines](https://claude.ai/code/routines) や `settings/usage` で確認）:

| プラン | 1 日あたりの目安 |
|---|---|
| **Pro** | 5 回 |
| **Max** | 15 回 |
| **Team / Enterprise** | 25 回 |

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — ルーチンは承認 prompt を返さない。
2. **Setup script でリポ依存処理を試みる** — Setup script はリポ clone 前に実行される。`uv sync` 等は手順 1 に記述する。
3. **`network_access: trusted` の制限を忘れる** — RSS フィード取得等は `full` が必要。
4. **`routine_id` プレフィックスの誤認** — 正解は **`trig_`**。
5. **`/fire` のレスポンスで完了を待つ** — エンドポイントはセッション作成時に即リターンする。
