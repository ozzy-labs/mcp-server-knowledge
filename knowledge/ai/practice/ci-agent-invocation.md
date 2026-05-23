---
reviewed: 2026-05-23
tags: [ai-workflow, methodology, github]
---

# CI から AI エージェント CLI を呼び出す（課金と利用規約）

GitHub Actions などの CI から Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI をオンデマンド（PR レビュー・自動修正など）で起動するときの、認証方式・**追加課金の有無**・**利用規約上の可否**をまとめる。定期実行（cron / Routines / `/loop`）は `ai/practice/scheduled-tasks.md`、各 CLI の個別仕様は `ai/agents/` 配下を参照。

「契約済みサブスク料以外の追加課金（API 従量・premium request 超過・Vertex 従量）を出さずに使えるか」を主軸に整理する。結論を先に言うと、**サブスク枠で規約も含めてクリーンに CI 自動化できるのは Gemini と Copilot、Codex はベンダー管理クラウド経由なら可、Claude は自前 CI ではサブスク枠の経路が弱い**。

## 3 つの実行パターン

CI から呼ぶ手段は大きく 3 系統に分かれ、課金と規約の性質が異なる。

| パターン | 実行場所 | 課金 | 規約 |
|---|---|---|---|
| A. ベンダー管理クラウド連携 | プロバイダ側 | **サブスク込み（追加なし）** | ○（公式機能） |
| B. 自前 runner の公式 Action + API/利用キー | 自前 GHA runner | **従量課金** | ○ |
| C. サブスク認証情報を自前 CI に持ち込み | 自前 GHA runner | サブスク枠 | ✗ コンシューマー規約に抵触しやすい |

パターン C（Codex の `auth.json` 持ち込み、Claude のサブスク OAuth トークン CI 利用）は「技術的には動く」が、両社のコンシューマー規約の禁止条項に触れる（後述）。**追加課金を避けたいなら C ではなく A を狙う**のが基本方針。

## 課金・規約サマリー（4 CLI 比較）

| CLI | 追加課金ゼロの正規ルート | 従量ルート | サブスク認証情報の CI 持ち込み |
|---|---|---|---|
| **Gemini** | AI Studio API キー無料枠 / Code Assist ライセンス | Vertex AI + WIF | （個人 OAuth は CI 非対応） |
| **Copilot** | PAT + premium request 月次枠内 | 枠超過分 | PAT は GitHub 正規認証＝規約クリーン |
| **Codex** | Codex Cloud `@codex` 連携（ChatGPT プラン込み） | `openai/codex-action` + API キー | ✗ `auth.json` 持ち込みは規約抵触 |
| **Claude** | （自前 CI に該当なし） | API キー / Bedrock / Vertex | ✗ OAuth トークン CI 利用は規約外 |

## Claude Code

公式 Action `anthropics/claude-code-action@v1`。`@claude` メンションで起動、クイックスタートは Claude Code 内で `/install-github-app`（リポ管理者向け）。

### 認証と課金

| 入力 | 認証 | 課金 |
|---|---|---|
| `anthropic_api_key` | Anthropic 直 API キー | 従量 |
| `claude_code_oauth_token` | サブスク OAuth トークン（入力としては実在） | サブスク枠だが**規約外**（下記） |
| `anthropic_federation_rule_id` ほか | Anthropic Workload Identity Federation（鍵レス） | 従量 |
| `use_bedrock: "true"` | AWS Bedrock（OIDC、`id-token: write`） | AWS 請求 |
| `use_vertex: "true"` | Google Vertex AI（WIF） | GCP 請求 |

最小構成（API キー）:

```yaml
name: Claude
on:
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write
jobs:
  claude-response:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

Bedrock / Vertex は `aws-actions/configure-aws-credentials@v4` / `google-github-actions/auth@v2` で先に認証し、`use_bedrock` / `use_vertex` を立てて `claude_args: '--model <id>'` でモデル指定する。モデル ID は現行世代（Sonnet 4.6 / Opus 4.7 系）の Bedrock / Vertex 表記に置き換える。

**Claude には「サブスク込みで自前 CI を回す」正規ルートが無い。** サブスク枠で背景実行したい場合は Anthropic クラウドの Routines（`ai/practice/scheduled-tasks.md`）が該当し、自前 GitHub Actions は API キー / Bedrock / Vertex（従量）が正規。

## Codex CLI

サブスク込みで GitHub 自動化できる**唯一の追加課金ゼロ・規約準拠ルートが Codex Cloud**。自前 runner で回す場合は API キー（従量）。

### A. Codex Cloud `@codex` 連携（サブスク込み・推奨）

OpenAI 管理のクラウドが実行する GitHub ネイティブ連携。`chatgpt.com/codex` で GitHub アカウントを接続するだけで開始できる。

- **対応プラン**: ChatGPT Plus / Pro / Business / Edu / Enterprise（公式: "Access is included with ... not through OpenAI API keys."）→ **API 課金なし**
- **起動**: PR コメントに `@codex review`（手動）、設定で自動レビューを有効化、`@codex fix the P1 issue` で修正
- **レビュー方針**: 既定で P0/P1 のみ flag。`AGENTS.md` の `Review guidelines` セクションを尊重
- **Environments**（`/codex/cloud/environments`）: リポ・setup script（pnpm 等の依存導入）・インターネットアクセス（setup フェーズのみ既定有効、agent フェーズは既定無効）・secrets（暗号化、setup script のみ参照可）を設定。コンテナ状態は最大 12h キャッシュ

### B. `openai/codex-action@v1`（自前 runner・従量）

```yaml
name: Codex pull request review
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  codex:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
      - uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt-file: .github/codex/prompts/review.md
```

認証は `openai-api-key`（`OPENAI_API_KEY`）＝**API 従量課金**。主要入力は `prompt` / `prompt-file`、`safety-strategy`（既定 `drop-sudo`、Windows は `unsafe`）、`sandbox`（`workspace-write` / `read-only` / `danger-full-access`）。Linux / macOS runner 推奨。

### C. `auth.json` 持ち込み（非推奨）

ChatGPT サインインで生成される `~/.codex/auth.json` を Secret 化して CI に書き戻せばサブスク枠で動くが、規約抵触（後述）に加え、アクセストークン失効（CI は揮発性で refresh が書き戻されない）で不安定。**A で代替できるので使う理由がない**。

## Gemini CLI

公式 Action `google-gemini/run-gemini-cli`。認証方式で課金とバックエンドが切り替わる。

| 入力 | 認証 | 課金 |
|---|---|---|
| `gemini_api_key: ${{ secrets.GEMINI_API_KEY }}` | AI Studio API キー | **無料枠内なら追加なし**（超過で従量、無料枠はデータ学習利用の可能性） |
| `use_gemini_code_assist: true`（`GOOGLE_GENAI_USE_GCA`） | Gemini Code Assist ライセンス | 月額定額（トークン課金なし） |
| `use_vertex_ai: true` + `gcp_workload_identity_provider` + `gcp_project_id` | Vertex AI + WIF | 従量 |

```yaml
- uses: google-gemini/run-gemini-cli@main
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

個人 Google アカウントの OAuth はヘッドレス非対応で CI 不可。**追加課金ゼロを狙うなら AI Studio 無料枠か Code Assist ライセンス。** API キーは規約上も自動アクセスが想定された認証なのでクリーン。

## GitHub Copilot CLI

`copilot` を GitHub Actions で非対話実行する。premium request の月次枠内なら追加課金なし。

- **認証**: 自動発行の `GITHUB_TOKEN` は **Copilot 権限を持たず使用不可**。Copilot 利用権限（`Copilot Requests` 等）を付与した Fine-grained PAT を Secret 化し、`COPILOT_GITHUB_TOKEN` または `GH_TOKEN` に設定
- **非対話実行**: `copilot -p "<prompt>" --allow-all-tools --yes`
- **課金**: プラン（Pro / Pro+ / Business / Enterprise）の premium request 月次枠を消費。**枠内なら追加課金なし**、超過分は従量（Spending Limit 推奨）。GitHub Actions の実行時間（分）も別途消費
- **規約**: PAT は GitHub の正規認証（API キー相当）なので、Codex / Claude のような「コンシューマー認証情報の流用」には当たらず比較的クリーン

```yaml
env:
  COPILOT_GITHUB_TOKEN: ${{ secrets.COPILOT_CLI_TOKEN }}
```

## 利用規約（一次ソース）

サブスク認証情報を自前 CI に持ち込む方式（Codex `auth.json` / Claude OAuth トークン）は、両社のコンシューマー規約の禁止条項に該当する。

### OpenAI — Terms of Use（Effective: 2026-01-01）

- **Registration and access**: "You may not share your account credentials or make your account available to anyone else"
- **Using our Services**（禁止行為）: "Automatically or programmatically extract data or Output" / "sell or distribute any of our Services"

→ `auth.json` を共有 CI に置く＝認証情報の共有、サブスク認証で CI から出力を取得＝プログラム的抽出、のいずれにも触れる。

### Anthropic — Consumer Terms（Effective: 2025-10-08）

- §2: "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else." / "You also may not make your Account available to anyone else."
- §3（禁止）: "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."

加えて Anthropic の Legal and compliance（[OAuth と API key の使い分け](https://code.claude.com/docs/en/legal-and-compliance)）は、OAuth 認証は「Claude Code その他ネイティブ Anthropic アプリの ordinary use」専用であり、**プロダクト/サービス構築（Agent SDK 含む）は API キー認証を使うべき**と明文化している。GitHub Actions / 自前 CI は前者の範囲外＝API キーが正規。

## 推奨

追加課金ゼロ＋規約準拠を両立できる順:

1. **Gemini CLI** — AI Studio 無料枠 or Code Assist 定額。API キー認証で規約クリーン、最も手早い
2. **Copilot CLI** — PAT + premium request 枠内。GitHub 正規認証でクリーン、GitHub 完結の運用と好相性
3. **Codex Cloud `@codex`** — ChatGPT プラン込み・規約準拠。ただし自前 runner ではなく OpenAI クラウド実行

契約済み資産から選ぶなら: ChatGPT 課金済み → Codex Cloud、Copilot 契約済み → Copilot CLI + PAT、Google 寄り → Gemini、**Claude Max のみ → 自前 CI で追加課金ゼロ＋規約準拠の妙手は無い**（Routines で代替、または GitHub Actions は API 従量を許容）。

## AI エージェントがよくやるミス

1. **サブスク認証情報を自前 CI に持ち込む** — Codex `auth.json` / Claude OAuth トークンは技術的に動くが規約抵触。Codex は Codex Cloud `@codex`、Claude は API/Bedrock/Vertex が正規
2. **Copilot に `GITHUB_TOKEN` を使う** — Copilot 権限が無く失敗する。Copilot 権限付き PAT が必須
3. **Gemini を個人 OAuth で CI 実行しようとする** — ヘッドレス非対応。API キー or Code Assist or Vertex+WIF を使う
4. **「サブスクで動く＝無料かつ合法」と混同する** — 課金（枠を食うか従量か）と規約（許容される用途か）は別軸。両方を確認する

## 参考

- [OpenAI Codex Cloud](https://developers.openai.com/codex/cloud) / [Codex GitHub integration](https://developers.openai.com/codex/integrations/github) / [Codex GitHub Action](https://developers.openai.com/codex/github-action)
- [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action)（`docs/setup.md` / `docs/cloud-providers.md`）
- [Anthropic Consumer Terms](https://www.anthropic.com/legal/consumer-terms) / [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- [google-gemini/run-gemini-cli](https://github.com/google-gemini/run-gemini-cli) / [Gemini Code Assist pricing](https://cloud.google.com/products/gemini/code-assist)
- 関連: `ai/practice/scheduled-tasks.md` / `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
