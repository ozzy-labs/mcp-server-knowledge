---
reviewed: 2026-05-10
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み。2026年5月のアップデートにより、**Claude Opus 4.7** と **100万トークンコンテキスト** を標準サポートし、自律的な「クラウドエージェントプラットフォーム」へと進化した。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines)

## 主要な最新機能 (2026-05)

- **Opus 4.7 & 1M Context**: 大規模リポジトリ全体の依存関係を一度に解析可能。
- **Dreaming (研究プレビュー)**: 過去のセッションを振り返り、パターンを学習して自己改善する機能。実行を重ねるごとに精度が向上する。
- **Native Git Worktrees**: `worktree.baseRef` 設定により、独立したブランチで並行してタスクを実行可能。
- **`/ultrareview`**: クラウド上のエージェント群が並行してバグハンティングを行い、結果を集約する。

## 動作モデル

- **クラウド実行**: Anthropic 管理 VM 上で動作（ローカルがオフラインでも継続）。
- **完全自律**: 承認プロンプトなし。`AskUserQuestion` 系は機能しない前提で設計する。
- **fresh clone**: トリガー毎にリポジトリを default branch から clone。

## トリガー

| トリガー | 用途 |
|---|---|
| **Scheduled** | 特定周期（Cron 式対応）や一回限りの実行。 |
| **API** | HTTP POST (`/fire`) で外部から起動。 |
| **GitHub** | PR 作成や Push 等のイベントに反応。 |

## 利用枠 (2026-05 改定)

| プラン | 1 日あたりの上限 |
|---|---|
| **Pro** | 5 回 |
| **Max** | 15 回 |
| **Team/Enterprise** | 25 回以上（順次緩和中） |

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — ルーチンは承認 prompt を返さない。
2. **Setup script でリポ依存処理を試みる** — Setup script はリポ clone 前に実行される。`uv sync` 等は手順 1 に記述する。
3. **`network_access: trusted` の制限を忘れる** — RSS フィード取得等は `full` が必要。
4. **`routine_id` プレフィックスの誤認** — 正解は **`trig_`**。
5. **`/fire` のレスポンスで完了を待つ** — エンドポイントはセッション作成時に即リターンする。
