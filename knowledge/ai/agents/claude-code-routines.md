---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み。`/model` セレクタで **Claude Opus 4.8**（前世代の Opus 4.7 も選択可）と **100 万トークンコンテキスト** を選択でき、トリガー駆動の自律実行プラットフォームとして使える。プロンプト + リポジトリ + コネクタを 1 つの設定として保存し、トリガーで自動起動する。Pro / Max / Team / Enterprise プランで **Claude Code on the web を有効化** している場合に利用可能（research preview）。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines)

## 主要機能

- **Opus 4.8 & 1M Context**: モデルセレクタで選択可能（前世代の Opus 4.7 も引き続き選べる）。大規模リポジトリ全体の依存関係を一度に解析できる。
- **fresh clone モデル**: トリガー毎にリポジトリを default branch から clone し、変更は `claude/`-prefix ブランチに push。**Allow unrestricted branch pushes** を有効化すると既存ブランチへの push も可能。

### 関連機能（Routines 本体ではないが併用される）

- **Dreaming**（[Managed Agents](https://platform.claude.com/docs/en/managed-agents/dreams)）: 過去のセッションログを材料に memory store を再編成する研究プレビュー機能。Routines と同じ Claude Code エコシステムだが別レイヤー。研究プレビュー中は `claude-opus-4-7` / `claude-sonnet-4-6` をサポート。
- **`/ultrareview`**（[Claude Code 本体のスラッシュコマンド](https://code.claude.com/docs/en/ultrareview)）: カレントブランチと default ブランチの diff をレビューする multi-lens パイプライン。Routines 経由でも呼び出せる。

## 動作モデル

- **クラウド実行**: Anthropic 管理 VM 上で動作（ローカルがオフラインでも継続）。
- **完全自律**: 承認プロンプトなし。permission-mode picker も無い。`AskUserQuestion` 系は機能しない前提で設計する。
- **fresh clone**: トリガー毎にリポジトリを default branch から clone。
- **個人アカウント所属**: ルーチンは個人 claude.ai アカウントに紐づき、チーム共有されない。commit / PR は自分の GitHub user、コネクタ操作も自分のリンク先アカウントとして記録される。

## CLI / API での操作

用語の区別: **routine** は「クラウドに保存される設定エンティティ」、**`/schedule`** は「その routine を CLI から操作するスラッシュコマンド」。両者は別物だが対立機能ではなく、`/schedule` が cloud routine の CLI 入口にあたる（同名の Desktop ローカル scheduled task や `/loop` とは別。`ai/practice/scheduled-tasks.md` 参照）。

「作成・管理」と「起動」は別レイヤー。**管理は CLI（一部）と Web、外部からの起動は API** で行う。作成面は Web / Desktop / CLI の 3 つあり、すべて同じ claude.ai アカウントに書き込むため、どこで作っても即座に他面へ反映される。

### CLI (`/schedule`) — 作成と管理（schedule trigger のみ）

| コマンド | 操作 |
|---|---|
| `/schedule <自然言語>` | scheduled routine を作成。例: `/schedule daily PR review at 9am`、one-off は `/schedule in 2 weeks, open a cleanup PR ...` |
| `/schedule list` | 全ルーチンを一覧 |
| `/schedule update` | 既存ルーチンを変更（cron 式の直接指定・コネクタ変更・`enabled` フラグの切替もここ） |
| `/schedule run` | 即時起動 |

- **`/schedule` の正体**: Claude Code CLI の組み込みスラッシュコマンド。近年は bundled skill として実装され、内部で claude.ai の管理エンドポイント（`/v1/code/triggers` の list/get/create/update/run）を **in-process の OAuth トークン**で呼ぶ。**ルーチン管理用の公開 REST API は無い**（curl 想定でもない内部 API）。公開 API は後述 `/fire` の起動のみ。
- **無効化 / 有効化**: `/schedule update` で `enabled` を切替（`false` で設定を残したまま発火を停止、`true` で再開）。Web / Desktop の **Repeats トグル**（pause / resume）でも可。
- **削除は CLI 不可** — Web / Desktop の detail ページからのみ（削除しても過去の実行セッションは残る）。CLI / 公開 API は削除アクションを持たず、CLI でできるのは無効化（`enabled: false`）まで。
- **CLI で作れるトリガーは schedule のみ**。API / GitHub trigger の追加・編集、および API トークンの生成・失効は Web（[claude.ai/code/routines](https://claude.ai/code/routines)）でのみ可能。
- `/schedule` が **"Unknown command"** になる主因（CLI が要件未達だと非表示になる）:
  1. Console API key / Bedrock / Vertex / Foundry 認証になっている。`ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` / `settings.json` の `apiKeyHelper` は claude.ai ログインより優先されるため外す（`/schedule` は claude.ai サブスクリプションログインが必須）。
  2. `DISABLE_TELEMETRY` / `DO_NOT_TRACK` / `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` / `DISABLE_GROWTHBOOK` が feature flag 取得を止めている。
  3. Claude Code on the web セッション内（Web UI で操作する）。
  4. CLI が v2.1.81 未満（`claude update`）。

### create body のフィールド能力境界

`/schedule` の create が叩く `POST /v1/code/triggers` の body は **strict schema**（未知フィールドを reject）。CLI/API で設定できるフィールドと Web UI でしか設定できないフィールドが分かれる。

**CLI / API で設定可能**（既存 routine で実証）:

| 項目 | create body 内のパス |
|---|---|
| model（例 `claude-opus-4-8[1m]`） | `job_config.ccr.session_context.model` |
| カスタム instructions（prompt 全文） | `job_config.ccr.events[].data.message.content` |
| 対象リポジトリ | `job_config.ccr.session_context.sources[].git_repository.url` |
| allowed_tools | `job_config.ccr.session_context.allowed_tools` |
| 環境（environment） | `job_config.ccr.environment_id` |
| cron（最小 1h・UTC） / `run_once_at` / `enabled` / `mcp_connections` | top-level |

→ **model も instructions も CLI/API で設定できる**。公開 docs の会話フロー記述だけを見て「instructions / model は Web UI 専用」と誤解しないこと。`/schedule`(CLI) は **`allow_unrestricted_git_push` 以外すべて**を登録できる。

**Web UI 専用**（create body に入れると reject）:

- **`allow_unrestricted_git_push`**（Web UI の **Allow unrestricted branch pushes**）は create body に渡すと strict schema が弾く:

  ```text
  HTTP 400
  {"type":"error","error":{"type":"invalid_request_error",
   "message":"allow_unrestricted_git_push: Extra inputs are not permitted"}}
  ```

  この権限は Web の Permissions でのみ設定可能。`claude/`-prefix 以外の既存ブランチ（`main` 等）への push を許可する設定なので、「routine が自分の PR を main に auto-merge する」設計は CLI 登録だけでは完結せず、Web で 1 度この権限を付与する必要がある。

### API — 起動（fire）専用、CRUD は不可

HTTP API でできるのは **既存ルーチンの起動のみ**。list / create / update / delete の管理 API は存在しない（`/fire` は claude.ai ユーザー専用で、Claude Platform API の一部ではない）。

```bash
curl -X POST https://api.anthropic.com/v1/claude_code/routines/trig_01ABCDEFGHJKLMNOPQRSTUVW/fire \
  -H "Authorization: Bearer sk-ant-oat01-xxxxx" \
  -H "anthropic-beta: experimental-cc-routine-2026-04-01" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"text": "Sentry alert SEN-4521 fired in prod. Stack trace attached."}'
```

- ベース URL は **`https://api.anthropic.com`**、パスは `/v1/claude_code/routines/{routine_id}/fire`。
- 認証は **per-routine の bearer token**（Web の API トリガー設定で `Generate token`。一度だけ表示・再取得不可。`Regenerate` / `Revoke` で更新）。
- body の `text` は任意のフリーテキストで **パースされない**（JSON を渡しても文字列として届く。アラート本文や失敗ログの受け渡しに使う）。
- 成功レスポンスは **セッション作成時に即返る**（完了は待たない）:

  ```json
  { "type": "routine_fire",
    "claude_code_session_id": "session_01...",
    "claude_code_session_url": "https://claude.ai/code/session_01..." }
  ```

- beta header `experimental-cc-routine-2026-04-01` 必須。破壊的変更は新しい日付の beta header で出荷され、直近 2 つの旧バージョンは移行猶予として動き続ける。
- フル API リファレンス: [Trigger a routine via API](https://platform.claude.com/docs/en/api/claude-code/routines-fire)（Claude Platform docs）。

### Web / Desktop — フル管理

detail ページで **Run now**・**pause / resume**（Repeats トグル）・編集・削除が可能。Team / Enterprise admin は [claude.ai/admin-settings/claude-code](https://claude.ai/admin-settings/claude-code) の **Routines トグル** で組織全体を無効化でき、無効化すると既存ルーチンも停止する。

## トリガー

1 つのルーチンに複数トリガーを併用できる（例: 夜間スケジュール + deploy script からの API + 新規 PR への反応）。

| トリガー | 用途 | 作成・編集面 |
|---|---|---|
| **Scheduled** | 周期実行 or 一回限り。最小間隔は **1 時間**（短いと reject）。one-off は発火後 auto-disable し UI 上 **Ran** 表示。 | CLI / Web / Desktop |
| **API** | per-routine の HTTP POST (`/fire`) で外部から起動。bearer token 認証。 | **Web のみ** |
| **GitHub** | Pull request / Release の 2 カテゴリのイベントに反応（フィルタ可）。research preview 中は per-routine / per-account の hourly cap あり。 | **Web のみ**（Claude GitHub App 必須） |

## 利用枠

research preview 中の参考値（変動するため、最新は [claude.ai/code/routines](https://claude.ai/code/routines) や [claude.ai/settings/usage](https://claude.ai/settings/usage) で確認）:

| プラン | 1 日あたりの目安 |
|---|---|
| **Pro** | 5 回 |
| **Max** | 15 回 |
| **Team / Enterprise** | 25 回 |

- サブスク枠はインタラクティブセッションと同様に消費される（API 課金は発生しない）。usage credits を有効化していれば daily cap / サブスク枠超過後も従量で続行できる。
- **one-off run は daily cap に含まれない**（ただしサブスク枠は通常通り消費）。

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — ルーチンは承認 prompt を返さない。
2. **Setup script でリポ依存処理を試みる** — Setup script はリポ clone 前に実行される。`uv sync` 等は手順 1 に記述する。
3. **network access の制限を忘れる** — Default 環境は Trusted で、許可外ホストへの outbound は `403` + `x-deny-reason: host_not_allowed`。RSS フィード取得や自前サービスへの到達には Custom / Full が必要。
4. **`routine_id` プレフィックスの誤認** — 正解は **`trig_`**。
5. **`/fire` のレスポンスで完了を待つ** — エンドポイントはセッション作成時に即リターンする。
6. **公開 API でルーチンを CRUD しようとする** — 公開 API は起動専用。作成・更新は CLI（schedule trigger のみ）か Web、トークンの生成・失効は Web のみ。
7. **`/web-setup` で GitHub App が入ると誤解** — `/web-setup` は clone 用のリポアクセスを付与するだけ。GitHub trigger には別途 Claude GitHub App のインストールが必要（trigger 設定時に促される）。
8. **CLI / API でルーチンを削除しようとする** — 削除アクションは存在しない。CLI（`/schedule`）でできるのは無効化（`/schedule update` の `enabled: false`）まで。削除は Web / Desktop の detail ページからのみ。
9. **`allow_unrestricted_git_push` を create body に渡せると誤解** — create API は strict schema で未知フィールドを弾き、`400 Extra inputs are not permitted` を返す。この権限（既存ブランチへの push 許可）は Web UI の Permissions でのみ設定可能で、CLI/API では設定できない。
