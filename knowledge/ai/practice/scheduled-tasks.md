---
reviewed: 2026-05-04
tags: [ai-workflow, methodology]
---

# AI エージェントの定期実行

AI コーディングエージェント（Claude Code / Codex 等）を recurring に走らせるための選択肢と選び方。「knowledge ベースを週次で再検証する」「PR レビューを毎朝実行する」「失敗ジョブを夜間に修復する」のような用途で必要になる。各 CLI の個別仕様は `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` 他を参照。

## 選択肢の全体像（Claude Code）

公式 docs の比較表（[Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)）:

| 観点 | Cloud (Routines) | Desktop scheduled tasks | `/loop` |
|---|---|---|---|
| 実行場所 | Anthropic クラウド | 自分のマシン | 自分のマシン |
| マシン起動が必要 | No | Yes | Yes |
| セッション開きっぱなし必要 | No | No | Yes |
| 再起動を跨いで永続 | Yes | Yes | `--resume` で復元（未失効のみ） |
| ローカルファイルにアクセス | No（fresh clone） | Yes | Yes |
| 最小実行間隔 | 1 hour | 1 minute | 1 minute |
| トリガー種別 | schedule + API + GitHub event | schedule のみ | schedule のみ |
| 仕様の安定度 | research preview | GA | GA |

これに **GitHub Actions の `schedule` トリガー**（外部 CI）を加えた 4 つが Claude Code 系の選択肢。OpenAI 系は **Codex Cloud / Workspace Agents** が同等機能を提供する。

## 1. Cloud Routines (`/schedule`)

[Automate work with routines](https://code.claude.com/docs/en/routines)。Anthropic のクラウド VM で Claude Code を定期実行する。Pro / Max / Team / Enterprise プランで利用可能（research preview）。

### 何ができるか

- **トリガー 3 種を組み合わせ可能**: Scheduled (cron) / API (HTTP POST) / GitHub event (PR opened など)
- リポジトリを fresh clone → 作業 → `claude/`-prefix のブランチに push → PR 作成
- MCP コネクタを per-routine で選択
- 完全自律実行（permission prompt なし）

### 作成方法

- Web: [claude.ai/code/routines](https://claude.ai/code/routines)
- CLI: `/schedule daily PR review at 9am` のように自然言語で（CLI は schedule trigger のみ作成可、API/GitHub trigger は Web で追加）
- Desktop アプリ: Routines サイドバーから **New routine → Remote**

### 制約

- 最小実行間隔は **1 時間**
- 1 アカウント当たりの **日次 routine run cap** あり（[claude.ai/code/routines](https://claude.ai/code/routines) で確認）
- デフォルトは `claude/`-prefix ブランチへのみ push（既存ブランチに書く場合は **Allow unrestricted branch pushes** を明示的に有効化）
- One-off run は daily cap に含まれないが、サブスク枠は通常通り消費
- 仕様変更の可能性あり（research preview）

### 課金

公式: > Routines draw down subscription usage the same way interactive sessions do.

サブスク枠から消費される（API 課金は発生しない）。サブスク枠を超えた場合、"extra usage" を有効化していれば従量に流れる。

## 2. Desktop scheduled tasks

[Schedule recurring tasks in Claude Code Desktop](https://code.claude.com/docs/en/desktop-scheduled-tasks)。Desktop アプリ内で動くローカル版。

- アプリ起動中かつマシンが起きている時のみ実行（ノート閉じると停止）
- ローカルファイルに直接アクセス可能（clone 不要）
- 最小実行間隔 **1 分**
- 7 日以内の missed run を **1 回だけ** catch up
- タスクごとに permission mode 設定可能（Ask モードだと承認待ちで stall）
- 定義は `~/.claude/scheduled-tasks/<task-name>/SKILL.md` に保存される

クラウドに送りたくないコード、ローカルにしかない依存、Routines の daily cap 到達時の代替として有効。

## 3. `/loop`（セッション内）

[Run prompts on a schedule](https://code.claude.com/docs/en/scheduled-tasks)。**現在のセッション中のみ**動く軽量スケジューラ。Claude Code v2.1.72+ 必須。

```text
/loop 5m check if the deployment finished
/loop check whether CI passed and address any review comments
/loop
/loop 20m /review-pr 1234
```

| 入力 | 挙動 |
|---|---|
| interval + prompt | 固定 cron で実行 |
| prompt のみ | Claude が iteration ごとに interval（1 分〜1 時間）を動的決定 |
| interval のみ / 引数なし | 組み込みメンテナンスプロンプトが走る（または `loop.md` を読む） |

- セッションスコープ（`--continue` / `--resume` で復元、ただし 7 日以内）
- **7 日で自動失効**
- セッション内最大 50 タスク
- `Esc` で待機中ループを停止
- `.claude/loop.md` または `~/.claude/loop.md` でデフォルトプロンプトを上書き
- 内部的には `CronCreate` / `CronList` / `CronDelete` ツールを使用

ビルドの様子見・PR ベイビーシッティング・短期ポーリング向け。長期 cron 用途には不向き。

## 4. GitHub Actions の `schedule` トリガー

CI で定期実行する古典的方法。詳細は `platforms/github-actions.md`。

```yaml
on:
  schedule:
    - cron: "0 9 * * 1"   # 毎週月曜 09:00 UTC
```

エージェント CLI を Action 内で起動する場合、Anthropic の利用ポリシーにより **API key 認証推奨**（後述）。サブスクの OAuth トークンは技術的には使えるが、CI 自動化は "ordinary individual use" の範囲外と明文化されている。

## 5. OpenAI Codex Cloud / Workspace Agents

ChatGPT 系の同等機能は 2 つに分かれている。

| プロダクト | 何ができるか | 対応プラン |
|---|---|---|
| [Codex cloud](https://developers.openai.com/codex/cloud) | Codex CLI が cloud 環境で非同期タスクを実行（ノート閉じても継続、並列可） | ChatGPT Plus / Pro / Business / Edu / Enterprise（Free 除く） |
| [Workspace agents](https://openai.com/index/introducing-workspace-agents-in-chatgpt/) | チーム共有エージェント、スケジュール実行、Slack 連携 | Business / Enterprise / Edu / Teachers のみ（research preview） |

> **注意**: Workspace Agents は **ChatGPT Plus / Pro では利用不可**。チーム/エンタープライズプラン限定。2026-05-06 までは無料、以降クレジットベース課金。

Anthropic Routines に最も近いのは Workspace Agents（スケジュール実行 + ノート閉じても継続）だが、個人プランでは選択肢から外れる。Plus / Pro ユーザーが OpenAI 側で背景実行を使いたい場合は Codex cloud が候補。

## 認証と課金（重要）

[Anthropic Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance) の "Authentication and credential use" より:

> OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support **ordinary use of Claude Code and other native Anthropic applications**.
>
> Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use **API key authentication** through Claude Console or a supported cloud provider.

意味するところ:

| 実行手段 | サブスクの OAuth で動かしてよいか | 推奨認証 |
|---|---|---|
| Routines / Desktop / `/loop` | Yes（Anthropic 公式アプリ内で動く） | OAuth (サブスク枠) |
| GitHub Actions / 自前 CI | No（"ordinary individual use" の範囲外） | `ANTHROPIC_API_KEY`（従量課金） |
| プロダクト組み込み | No | API key |

「サブスクで動くから無料」と「Anthropic がポリシー的に許容する用途」は別軸。CI 自動化を OAuth で運用すると、policy 上の措置（Anthropic は事前通知なしで取りうる）と個人アカウント枠の浪費の両方がリスクになる。

## 選び方フロー

```text
ノートを閉じても動いてほしい？
├─ Yes → 公式アプリの範囲内で済ませたい（policy 準拠 & 追加課金なし）？
│        ├─ Yes → Cloud Routines
│        └─ No  → GitHub Actions + ANTHROPIC_API_KEY
└─ No  → セッションを開きっぱなしにできる？
         ├─ Yes → /loop
         └─ No  → Desktop scheduled tasks
```

追加の判断軸:

- **ローカルファイル必須** → Desktop or `/loop`（Routines は fresh clone で `~/.gitignore` 配下や untracked file を見れない）
- **GitHub event トリガー** → Routines（PR opened / Release published 等）or GitHub Actions
- **API トリガー（外部システムから叩く）** → Routines の `/fire` endpoint
- **1 時間より短い間隔が必須** → Routines 不可。Desktop / `/loop` / GitHub Actions
- **チーム運用・個人枠を消費したくない** → API key 利用の GitHub Actions が無難

## AI エージェントがよくやるミス

1. **GitHub Actions で OAuth トークンを使う** — `CLAUDE_CODE_OAUTH_TOKEN` は技術的に動くが、Anthropic の利用ポリシーで CI 自動化は API key 推奨と明文化されている。policy 違反リスクと個人アカウント枠の浪費の両方
2. **`/loop` で長期 cron を作る** — `/loop` は 7 日失効 + セッションスコープ。月次レポートや週次更新は Routines / Desktop / GitHub Actions
3. **Routines に main 直 push を期待する** — デフォルトでは `claude/`-prefix ブランチにしか push できない。既存ブランチに書くなら **Allow unrestricted branch pushes** を有効化する必要あり
4. **Desktop scheduled tasks を「ノート閉じても動く」と誤解** — 動かない。アプリ起動中かつマシンが起きている時のみ
5. **Routines の cron に 30 分を指定** — 最小は 1 時間。短い周期が必要なら別手段
6. **catch-up を当てにする** — Desktop は 7 日内の missed run を 1 回だけ catch up、Routines は仕様非公開、`/loop` と GitHub Actions は catch up なし。時刻が重要ならプロンプト内にガードを書く（例: 「今 17:00 を過ぎていたらスキップしてサマリのみ」）
7. **fresh clone を忘れる** — Routines は毎回 fresh clone なので `.gitignore` のローカル設定や untracked file は反映されない。必要な設定は repo にコミット、または `.claude/settings.json` の SessionStart hook で再構成

## 参考

- [Routines（クラウド定期実行）](https://code.claude.com/docs/en/routines)
- [Desktop scheduled tasks](https://code.claude.com/docs/en/desktop-scheduled-tasks)
- [`/loop` とセッション内スケジューラ](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web)
- [Legal and compliance（OAuth と API key の使い分け）](https://code.claude.com/docs/en/legal-and-compliance)
- [OpenAI Codex Cloud](https://developers.openai.com/codex/cloud)
- [OpenAI Workspace Agents](https://openai.com/index/introducing-workspace-agents-in-chatgpt/)
- 関連: `platforms/github-actions.md` / `ai/agents/claude-code.md` / `ai/practice/multi-agent-repo.md`
