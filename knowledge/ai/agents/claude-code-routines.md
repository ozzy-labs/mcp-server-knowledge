---
reviewed: 2026-05-06
tags: [ai-workflow, commercial, cloud-hosted]
stability: research-preview
---

# Claude Code Routines

Anthropic 管理のクラウドインフラで Claude Code を非対話に動かす仕組み。プロンプト・対象リポジトリ・MCP コネクタを「ルーチン」として保存し、**スケジュール / API / GitHub イベント**のいずれかで起動する。research preview。Pro / Max / Team / Enterprise プランで利用可能。

公式: [Automate work with routines](https://code.claude.com/docs/en/routines) / 管理 UI: [claude.ai/code/routines](https://claude.ai/code/routines) / API リファレンス: [Trigger a routine via API](https://platform.claude.com/docs/en/api/claude-code/routines-fire)

スケジューリング全体の選択肢比較（Routines vs Desktop vs `/loop` vs GitHub Actions）は `ai/practice/scheduled-tasks.md` を参照。

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

[claude.ai/code/routines](https://claude.ai/code/routines) → **New routine**。フォームで以下を設定（順序は UI に合わせている）:

- **Name**: ルーチン名
- **Instructions**: ルーチン実行時に走るプロンプト本体（自律実行が前提なので self-contained に書く）
- **Model**: モデル選択（毎回これで実行）
- **Repositories**: 1 つ以上の GitHub リポジトリ
- **Environment**: cloud environment 設定。サブフィールドは `Name` / `Network access`（None / Trusted / Full / Custom の 4 値）/ `Environment variables`（名前のみ。値は secret として別管理）/ `Setup script`
- **Trigger**: schedule / API / GitHub のいずれか（複数可）
- **Connectors**: 接続済み MCP コネクタから per-routine で選択
- **Permissions**: `Allow unrestricted branch pushes`（リポジトリ単位の bool、既定オフ、後述）

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
- 環境変数 / setup script は Environment 単位で設定（snapshot キャッシュされ、setup script は通常 1 回のみ走る）
- リソース上限: 約 4 vCPU / 16 GB RAM / 30 GB disk
- ベースイメージは Ubuntu noble（24.04）。**deadsnakes / ondrej-php の PPA がプリ設定**されており、`ppa.launchpadcontent.net` は trusted allowlist 外なので trusted モードでの `apt-get update` は 403 で失敗する

### Network access

選択肢は 4 つ（既定は **Trusted**）。ルーチンの目的に応じて選び分ける。

| 値          | allowlist                          | 適するルーチン                                             |
| ----------- | ---------------------------------- | ---------------------------------------------------------- |
| **None**    | egress 不可                        | リポ内データ加工のみで完結（lint・整形・統計算出等）       |
| **Trusted** | GitHub・主要 package registry のみ | GitHub 操作中心（PR 作成・コードレビュー・依存更新等）     |
| **Full**    | 任意の外部 URL                     | RSS feed 取得・外部 API 呼び出し・多ドメインスクレイピング |
| **Custom**  | ユーザー定義 allowlist             | trusted では足りないが full は広すぎる場合                 |

trusted の allowlist は意外に狭く、以下のようなドメインは含まれない。curl / fetch が **403 で沈黙のうちに失敗**するので注意:

- `astral.sh`（uv の公式インストーラ `curl https://astral.sh/uv/install.sh | sh`）
- `ppa.launchpadcontent.net`（deadsnakes / ondrej-php 等の PPA）
- `aws.amazon.com` / `databricks.com` / `openai.com` 等の技術ブログ feed
- `get.docker.com` / `deb.nodesource.com` 等の curl pipe 配布

回避策は (1) **Full に切り替える**、(2) **GitHub Releases から prebuilt バイナリを落とす**（GitHub は trusted に含まれる）、または (3) **Custom で必要ドメインだけ追加**。

uv を GitHub Releases から取得する例:

```bash
mkdir -p "$HOME/.local/bin"
curl -LsSf https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz \
  | tar -xz -C "$HOME/.local/bin" --strip-components=1 \
    uv-x86_64-unknown-linux-gnu/uv uv-x86_64-unknown-linux-gnu/uvx
```

### Setup script の実行タイミング

Setup script は **Environment スナップショット作成時に 1 回だけ走り、各 run のリポ clone より前**に実行される。スナップショットがキャッシュされ、各 run は fresh clone をその上に重ねる動作。

そのため setup script の cwd には `pyproject.toml` / `package.json` 等のリポルートが存在せず、**リポ非依存のツールインストールのみ**を行う。以下は setup 時に失敗する:

- `uv sync --frozen` / `uv pip install -r requirements.txt` / `uv run <project-cli> ...`（`error: No pyproject.toml found in current directory or any parent directory`）
- `pnpm install` / `npm install` / `yarn install`
- `lefthook install` / `pre-commit install`（hook 設定ファイルがない）
- リポ内ファイルを参照するサニティチェック

リポを必要とする処理は **instructions（プロンプト本体）の手順 1** に置く:

```text
## 手順
1. リポの依存をインストール: `uv sync --frozen`（Setup script はリポ clone 前に走るため、依存解決はランタイム側で行う）
2. （以下、本来の手順）
```

### `gh` CLI

`gh` はベースイメージにプリインストールされていない。**built-in GitHub tools を優先**し、setup での apt install は避ける:

- ブランチ push、PR 作成、issue コメント等は cloud session の built-in GitHub tools が proxy 経由で安全に処理する
- どうしても `gh` バイナリを置きたい場合、apt は trusted で PPA 由来の 403 を踏むため GitHub Releases から取る方が安定:

```bash
GH_VER=$(curl -sSL -o /dev/null -w '%{url_effective}' https://github.com/cli/cli/releases/latest | sed 's|.*/v||')
curl -LsSf "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_linux_amd64.tar.gz" | tar -xz -C /tmp
sudo install "/tmp/gh_${GH_VER}_linux_amd64/bin/gh" /usr/local/bin/gh
```

apt 経由で入れたい場合は先に PPA を削除する:

```bash
sudo rm -f /etc/apt/sources.list.d/deadsnakes-*.{list,sources} \
            /etc/apt/sources.list.d/ondrej-*.{list,sources}
sudo apt-get update -qq
sudo apt-get install -y -qq gh
```

### Git push 権限

デフォルトは `claude/`-prefix のブランチにのみ push 可能（保護ブランチ誤改変防止）。既存ブランチに push したい場合は ルーチンの **Permissions → Allow unrestricted branch pushes** を該当リポジトリに対して有効化する必要がある（リポジトリ単位の設定）。

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

詳細: `ai/practice/scheduled-tasks.md` の「認証と課金」節。

## AI エージェントがよくやるミス

1. **`AskUserQuestion` を含むスキルをルーチン化** — Routines は完全自律実行で承認 prompt を返さない。`/update` のような「完了後にユーザーに確認」を含むスキルは、プロンプト側で「確認は省略、ship まで一気通貫」と明示するか、確認ステップ抜きの代替フローを書く必要がある
2. **`routine_id` を `routine_` で始まると思い込む** — 仕様上のプレフィックスは **`trig_`**。パス変数名と実値が一致しない
3. **`/fire` のレスポンスで完了を待つ** — endpoint はセッション作成と同時に return する。完了確認は session URL を別途 poll する
4. **idempotency を期待してリトライ** — idempotency key なし。webhook の自動リトライは多重起動を生む。caller 側で重複制御
5. **既存 main ブランチへの直接 push を期待** — デフォルトは `claude/`-prefix のみ。該当リポジトリに対して明示的に **Allow unrestricted branch pushes** を有効化する必要がある（リポジトリ単位）
6. **ローカルの MCP サーバーが使えると思う** — fresh VM はローカル stdio サーバーに到達できない。リモート MCP / setup script / プロンプト書き換えで回避
7. **`gh` コマンドが pre-install されていると思う** — されていない。`gh issue` / `gh pr` 系は cloud session の **built-in GitHub tools を使う方が proxy 経由で安全**（推奨）。どうしても apt 経由で入れる場合、ベースイメージの PPA（deadsnakes / ondrej-php）が trusted allowlist 外で `apt-get update` が 403 になる。先に PPA 削除が必要
8. **Setup script でリポ依存処理をしようとする** — Setup script は **Environment スナップショット作成時に 1 回だけ走り、各 run のリポ clone より前**に実行される。setup の cwd には `pyproject.toml` / `package.json` が存在せず、`uv sync` / `pnpm install` / `lefthook install` 等は `No <file> found` で失敗する。これらは instructions の最初の手順（`uv sync --frozen` 等）に置く
9. **token を control versioning に commit** — 1 ルーチンスコープでも漏洩は致命的。Generate 時表示の 1 回でコピーして secret store に保管、commit しない
10. **trusted で外部 fetch ルーチンを動かす** — trusted の allowlist は GitHub と主要 package registry のみ。RSS feed・外部 API・任意ドメイン取得を業務本体とするルーチンは **`network_access: full`** が必要。trusted のままだと allowlist 外のドメインが沈黙のうちに 403 で落ち、**業務件数が静かに減る**（エラーで止まらず success 扱いになる feed 実装が多い）
11. **curl pipe インストーラを setup で使う** — `curl https://astral.sh/uv/install.sh | sh`、`curl https://get.docker.com | sh` 等は配布ドメイン（`astral.sh` 等）が trusted allowlist 外のことが多く、いきなり 403 で落ちる。GitHub Releases の prebuilt バイナリを直接 tar 展開する方が安定（GitHub は trusted に含まれる）

## 参考

- [Automate work with routines](https://code.claude.com/docs/en/routines)
- [Trigger a routine via API（API リファレンス）](https://platform.claude.com/docs/en/api/claude-code/routines-fire)
- [Claude Code on the web（cloud environment / setup scripts / network access）](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Legal and compliance（OAuth と API key の使い分け）](https://code.claude.com/docs/en/legal-and-compliance)
- 関連: `ai/practice/scheduled-tasks.md` / `ai/agents/claude-code.md` / `ai/platform/mcp-protocol.md`
