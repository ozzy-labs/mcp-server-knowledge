---
reviewed: 2026-05-03
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み。プロンプト・対象リポジトリ・MCP コネクタを「ルーチン」として保存し、**スケジュール / API / GitHub イベント**のいずれかで起動する。research preview。Pro / Max / Team / Enterprise プランで利用可能。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines) / 管理 UI: [claude.ai/code/routines](https://claude.ai/code/routines) / API リファレンス: [Trigger a routine via API](https://platform.claude.com/docs/en/api/claude-code/routines-fire)

スケジューリング全体の選択肢比較（Routines vs Desktop vs `/loop` vs GitHub Actions）は `standards/scheduled-tasks.md` を参照。

## 動作モデル

- **クラウド実行**: Anthropic 管理 VM 上で動く（ノート閉じても継続）
- **完全自律**: permission prompt なし。`AskUserQuestion` 系は機能しない前提でプロンプトを書く
- **アカウント単位**: 個人アカウントに紐づく。チームメイトと共有されない
- **アイデンティティ継承**: commit / PR / Slack 投稿等の連携は接続済み GitHub / connector アカウントで行われる（あなたとして残る）
- **fresh clone**: トリガー毎にリポジトリを default branch から clone

## トリガー 3 種

1 つのルーチンに複数トリガーを併設可能（例: 週次スケジュール + PR opened + 外部 deploy 後の API 呼び出し）。

| トリガー | 用途 | 設定可能な場所 |
|---|---|---|
| **Scheduled** | recurring or 一回限り | Web / CLI |
| **API** | HTTP POST で起動。アラート・CI と連携 | Web のみ |
| **GitHub** | PR / Release イベントに反応 | Web のみ |

## 作成方法

### Web

[claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**。フォームで以下を設定:

- **Prompt**: ルーチン実行時に走るプロンプト（自律実行が前提なので self-contained に書く）
- **Model**: モデル選択（毎回これで実行）
- **Repositories**: 1 つ以上の GitHub リポジトリ
- **Environment**: cloud environment（network access / env vars / setup script）
- **Connectors**: 接続済み MCP コネクタから per-routine で選択
- **Permissions**: `Allow unrestricted branch pushes`（既定はオフ、後述）
- **Triggers**: schedule / API / GitHub のいずれか（複数可）

### CLI

```bash
/schedule daily PR review at 9am                              # recurring
/schedule tomorrow at 9am, summarize yesterday's merged PRs  # one-off
/schedule list                                                # 一覧
/schedule update <id>                                         # 編集（cron 式の指定もここから）
/schedule run <id>                                            # 即時実行
```

CLI は **schedule trigger のみ作成可**。API / GitHub trigger は Web から追加する必要がある。

### Desktop アプリ

Routines サイドバー → **New routine** → **Remote**（**Local** を選ぶと Desktop scheduled task になる）。

3 つの surface（Web / CLI / Desktop）はすべて同じクラウドアカウントに書き込むので、どこで作っても他から見える。

## スケジュール仕様

- **プリセット**: hourly / daily / weekdays / weekly
- **カスタム間隔**: `/schedule update` で 5 フィールドの cron 式を指定可能。最小は **1 時間**（より短い式は reject）
- **タイムゾーン**: ローカルタイムで入力 → 自動で UTC 変換。クラウドの実行場所に依存しない
- **stagger**: 同一ルーチンの fire には決定論的な数分のオフセットが乗る（API トラフィック分散）
- **one-off**: 自然言語で記述（`/schedule in 2 weeks, ...`）。fire 後は auto-disabled

## API トリガー詳細

API トリガーを追加すると、ルーチン専用の HTTP endpoint と bearer token が発行される。

### endpoint

```text
POST https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire
```

`routine_id` は仕様上 **`trig_` プレフィックス**（パス変数名と異なる点に注意）。

### 必須ヘッダ

| ヘッダ | 値 |
|---|---|
| `Authorization` | `Bearer sk-ant-oat01-...`（per-routine token） |
| `anthropic-beta` | `experimental-cc-routine-2026-04-01`（欠落で 400） |
| `anthropic-version` | `2023-06-01` |
| `Content-Type` | `application/json`（body 送信時） |

### リクエストボディ

```json
{ "text": "Sentry alert SEN-4521 fired in prod. Stack trace attached." }
```

| フィールド | 必須 | 説明 |
|---|---|---|
| `text` | No | 実行毎の追加コンテキスト。最大 65,536 文字。**parse されず literal string として渡る** |

### レスポンス

```json
{
  "type": "routine_fire",
  "claude_code_session_id": "session_01HJKLMNOPQRSTUVWXYZ",
  "claude_code_session_url": "https://claude.ai/code/session_01HJKLMNOPQRSTUVWXYZ"
}
```

セッション作成と同時に返る。**完了は待たない**（output stream もしない）。`claude_code_session_url` をブラウザで開いて進行を観察する。

### エラー

| HTTP | type | 原因 |
|---|---|---|
| 400 | `invalid_request_error` | `anthropic-beta` 欠落、`text` 65,536 超、ルーチン paused 等 |
| 401 | `authentication_error` | token 不正 / token とルーチンの不一致 |
| 403 | `permission_error` | アカウント/組織に endpoint アクセス権なし |
| 404 | `not_found_error` | ルーチン不存在 |
| 429 | `rate_limit_error` | 日次 cap or サブスク枠到達。`Retry-After` ヘッダ付与 |
| 500 | `api_error` | サーバー内部エラー |
| 503 | `overloaded_error` | 一時過負荷（**Claude Platform は 529 だがここは 503**） |

### 注意事項

- **idempotency key なし**。webhook がリトライすると複数セッションが作られる
- **token は generate 時 1 回のみ表示**。再表示不可
- **token は per-routine スコープ**: 1 ルーチン起動のみ可。read access なし
- SDK 非対応（`x-api-key` の Anthropic API とは認証モデルが別系統）

## GitHub トリガー

Claude GitHub App をリポジトリにインストール必須（`/web-setup` の repo clone 権限とは別）。

### 対応イベント

| Event | サブアクション |
|---|---|
| Pull request | opened / closed / assigned / labeled / synchronized 等 |
| Release | created / published / edited / deleted |

### PR フィルタ

複数フィールド × オペレータ（equals / contains / starts with / is one of / matches regex 等）。**全条件 AND**。

| Filter | マッチ対象 |
|---|---|
| Author | PR 作者の GitHub username |
| Title / Body | PR のタイトル / 本文 |
| Base branch / Head branch | ブランチ名 |
| Labels | 付与ラベル |
| Is draft / Is merged | bool |

`matches regex` は **field 値全体に対するマッチ**。`hotfix` を含むタイトルにマッチさせたい場合は `.*hotfix.*` と書く。部分一致したいだけなら `contains` を使う方が安全。

### 制限

- **per-routine + per-account の hourly cap**（research preview）。超過 event は drop
- セッション再利用なし。同じ PR の 2 イベントは 2 つの独立セッションを作る

## クラウド環境とリポジトリ権限

詳細は [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web) を参照。Routines 視点で重要な点:

- 各 run は **fresh VM + fresh clone**（ローカル設定や untracked file は反映されない）
- Network access はデフォルト **Trusted**（GitHub・主要 package registry が allowlist）
- 環境変数 / setup script は Environment 単位で設定（snapshot キャッシュされ、setup script は通常 1 回のみ走る）
- リソース上限: 約 4 vCPU / 16 GB RAM / 30 GB disk
- **`gh` CLI はプリインストールされていない**。setup script で `apt install gh` + env var `GH_TOKEN` で導入する

### ブランチ push 権限

デフォルトは `claude/`-prefix のブランチにのみ push 可能（保護ブランチ誤改変防止）。既存ブランチに push したい場合は ルーチンの **Permissions → Allow unrestricted branch pushes** を有効化する必要がある。

### Connectors（MCP）

Routine 作成時、接続済みコネクタは **全部 default で included**。不要なものは外して権限スコープを最小化する。included なコネクタは run 中に**承認なしで全 tool が使える**（write 含む）。

ローカル stdio MCP サーバー（`pnpm` で起動するような）はクラウドからは直接見えない。クラウドで使いたい場合:

1. リモート MCP（HTTP/SSE）として deploy する、または
2. setup script で repo を clone・ビルド・実行する、または
3. Routine プロンプトをファイル直接編集ベースに変えて MCP 不使用にする

## 利用枠と課金

公式から引用:

> Routines draw down subscription usage the same way interactive sessions do.

- Pro / Max / Team / Enterprise の**サブスク枠から消費**（API 課金は発生しない）
- **日次 routine run cap** あり（プラン依存、現在値は [claude.ai/code/routines](https://claude.ai/code/routines) で確認）
- **One-off run** は daily cap に含まれないが、サブスク枠は通常通り消費
- サブスク枠 / daily cap 超過時、**extra usage 有効**なら従量に流れる。無効なら次の window までリジェクト

## 利用ポリシー（重要）

[Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) より、サブスク枠の OAuth 認証は "ordinary use of Claude Code and other native Anthropic applications" 限定と明記されている。Routines は Anthropic 公式アプリ内で動くため policy 上 OK だが、以下は範囲外:

- API トリガーを使って**自プロダクト/サービスの一部として組み込む** → API key 認証推奨
- チーム共有のサービスとして他人にトリガーさせる → 同上

詳細: `standards/scheduled-tasks.md` の「認証と課金」節。

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — Routines は完全自律実行で承認 prompt を返さない。`/update` のような「完了後にユーザーに確認」を含むスキルは、プロンプト側で「確認は省略、ship まで一気通貫」と明示するか、確認ステップ抜きの代替フローを書く必要がある
2. **`routine_id` を `routine_` で始まると思い込む** — 仕様上のプレフィックスは **`trig_`**。パス変数名と実値が一致しない
3. **`/fire` のレスポンスで完了を待つ** — endpoint はセッション作成と同時に return する。完了確認は session URL を別途 poll する
4. **idempotency を期待してリトライ** — idempotency key なし。webhook の自動リトライは多重起動を生む。caller 側で重複制御
5. **既存 main ブランチへの直接 push を期待** — デフォルトは `claude/`-prefix のみ。明示的に **Allow unrestricted branch pushes** が必要
6. **ローカルの MCP サーバーが使えると思う** — fresh VM はローカル stdio サーバーに到達できない。リモート MCP / setup script / プロンプト書き換えで回避
7. **`gh` コマンドが pre-install されていると思う** — されていない。`apt install gh` + `GH_TOKEN` で導入。`gh issue` / `gh pr` 系は cloud session の built-in GitHub tools を使う方が proxy 経由で安全
8. **lefthook / pre-commit hook が動かないと思い込む** — fresh clone なので `node_modules` と git hooks の install が必要。setup script で `pnpm install` を入れるか、SessionStart hook を repo に commit
9. **token を control versioning に commit** — 1 ルーチンスコープでも漏洩は致命的。Generate 時表示の 1 回でコピーして secret store に保管、commit しない

## 参考

- [Automate work with routines](https://code.claude.com/docs/en/routines)
- [Trigger a routine via API（API リファレンス）](https://platform.claude.com/docs/en/api/claude-code/routines-fire)
- [Claude Code on the web（cloud environment / setup scripts / network access）](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Legal and compliance（OAuth と API key の使い分け）](https://code.claude.com/docs/en/legal-and-compliance)
- 関連: `standards/scheduled-tasks.md` / `tools/claude-code.md` / `standards/mcp-protocol.md`
