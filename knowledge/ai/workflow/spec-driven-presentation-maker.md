---
reviewed: 2026-06-07
tags: [ai-workflow, spec, oss, aws, python]
aliases: [sdpm, sample-spec-driven-presentation-maker]
---

# Spec-Driven Presentation Maker

AWS Samples が公開する OSS の **spec 駆動プレゼンテーション生成ツールキット**（`aws-samples/sample-spec-driven-presentation-maker`、MIT-0）。「**何を伝えるか（spec）を先に決めて、どう見せるか（slide）は AI が作る**」という SDD の発想をプレゼン制作に適用する。Agent Skill / ローカル MCP / Amazon Bedrock AgentCore Runtime 上のリモート MCP / React Web UI の **4 層構成**で、必要なレイヤーだけを取り入れる設計。

公式: [github.com/aws-samples/sample-spec-driven-presentation-maker](https://github.com/aws-samples/sample-spec-driven-presentation-maker) / [Workshop](https://catalog.us-east-1.prod.workshops.aws/workshops/a275330a-0ae0-40b2-ad35-264e263c3882/en-US)

SDD 概念全体は `ai/practice/spec-driven-development.md`。同領域だが**コード生成向け**の OSS は `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md` を参照。本ツールは spec 出力先が**コードではなく `.pptx`** という点で位置づけが異なる。

## 哲学

| | 従来 | Spec-Driven |
|---|---|---|
| 起点 | 空のスライド | source（資料・要件） |
| 設計 | 作りながら考える | 論理構造を spec として先に確定 |
| 構築 | 手動レイアウト | template に従って AI が自動生成 |
| 品質 | 場当たり | spec ベースでレビュー可能 |

「全機能を最初に固める」waterfall ではなく、**briefing → outline → art direction → spec persisted → slide-by-slide build → PPTX** をループする。

## 4 層アーキテクチャ

| Layer | ディレクトリ | 用途 | AWS |
|---|---|---|:---:|
| **Layer 1** | `skill/` | Engine + reference + template。SKILL.md 対応エージェントから直接呼ぶ | 不要 |
| **Layer 2** | `skill/` + `mcp-local/` | ローカル stdio MCP サーバー。Claude Desktop / Claude Cowork など | 不要 |
| **Layer 3** | + `mcp-server/` + `infra/` | LibreOffice 内蔵の HTTP MCP（Amazon Bedrock AgentCore Runtime にデプロイ） | 必須 |
| **Layer 4** | + `agent/` + `api/` + `web-ui/` | Strands Agent + REST API + React Web UI のフルスタック | 必須 |

各層は前の層の薄いラッパー。1 リポジトリで全部入りだが、**自分の使い方に必要な層だけセットアップする**設計。

## 対応エージェント / クライアント

| Layer | 利用クライアント |
|---|---|
| 1 | **Agent Skill 対応 CLI**: Claude Code / Codex CLI / Cursor / Kiro / VS Code の GitHub Copilot |
| 2 | **ローカル MCP クライアント**: Claude Desktop / Claude Cowork / VS Code / Kiro |
| 3 | **リモート MCP only クライアント**: Claude.ai Web（ローカルプロセス起動不可） |
| 4 | ブラウザの同梱 React Web UI |

リポジトリには `AGENTS.md` と `CLAUDE.md` が同梱されており、`「このリポジトリをセットアップして」`「Layer 2 として Claude Desktop から使えるようにして」`と話しかけるだけでエージェントが適切な層とコマンドを選んでセットアップを進める設計（spec-driven ではなく agent-driven な「ホストオンボーディング」）。

## 前提

- Python 3.10+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)（`tools/uv.md` ではなく `languages/python/uv.md` を参照）
- Layer 3〜4 をローカル CDK で直接デプロイする場合は AWS アカウント + Node.js 18+ + Docker または Finch + AWS CLI が追加で必要

## クイックスタート

### Layer 1（Agent Skill のみ）

```bash
cd skill
uv sync

# アイコン取得（任意・推奨）
uv run python3 scripts/download_aws_icons.py
uv run python3 scripts/download_material_icons.py

# 動作確認
uv run python3 scripts/pptx_builder.py examples
```

`SKILL.md` + engine + reference（design pattern / workflow / guide）+ sample template（dark / light）が `skill/` に同梱。エージェント側のスキルディレクトリにコピーするか symlink で取り込む。

### Layer 2（ローカル MCP）

```bash
cd mcp-local
uv sync
uv run python server.py
```

クライアントの MCP 設定（`claude_desktop_config.json` / `.vscode/mcp.json` 等）に登録:

```json
{
  "mcpServers": {
    "spec-driven-presentation-maker": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/mcp-local", "python", "server.py"]
    }
  }
}
```

接続後、エージェントに「プレゼンテーションを作って」と頼むと以下が走る:

1. MCP Server Instructions から workflow ファイルを読み取り
2. トピック・対象者・目的についてヒアリング
3. **briefing → outline → art direction** を設計し、`specs/` に永続化
4. スライドを 1 枚ずつ構築
5. `.pptx` を出力してプレビュー表示

### Layer 3〜4（AWS デプロイ）

ワンクリック CloudFormation を **東京 / バージニア北部 / オレゴン**で提供。CloudShell から `scripts/deploy.sh` を実行する経路が推奨（ローカルに CDK / Docker をインストール不要、CodeBuild 経由でデプロイ）。

ローカル CDK で直接デプロイする場合:

```bash
cd infra
npm ci
cp config.example.yaml config.yaml
# config.yaml で stacks: data/runtime/agent/webUi を選択
npx cdk deploy --all                                # Docker Desktop 利用時
CDK_DOCKER=finch npx cdk deploy --all               # Finch 利用時
CDK_DOCKER=finch npx cdk deploy --all --require-approval never  # CI/CD
```

デプロイには 15〜30 分。

## モデル設定

デフォルトモデル: **`global.anthropic.claude-sonnet-4-6`**（Amazon Bedrock 経由）。Opus 等への切替えは `infra/config.yaml`:

```yaml
model:
  modelId: "global.anthropic.claude-opus-4-6-v1"
```

データ主権が要件のときは cross-region inference profile を避ける。Bedrock Model Invocation Logging は `features.enableInvocationLogging: true` で任意有効化。

## Spec / Template の構造

| ファイル | 役割 |
|---|---|
| `.pptx` | テンプレート。**任意の `.pptx`** を template として使える（layout / colors / fonts / placeholder を自動解析） |
| `slides.json` | プレゼンテーションの spec。`type` / `src` / `x` / `y` / `width` / `height` を持つ slide object のリスト |
| `manifest.json` | アセットメタデータ（icons / images の一覧） |
| `config.json` | ユーザー設定（出力ディレクトリ、追加アセットソース） |
| `.html` | カスタムスタイルガイド（CSS variables） |

アセット参照は `"assets:{source}/{name}"`（例: `"assets:aws/Lambda"`）の形式。

ユーザーローカルの persistent ディレクトリ:

- macOS / Linux: `~/.config/sdpm/`
- Windows: `%APPDATA%\sdpm\`

パッケージ更新後もテンプレ / スタイル / アセットが残る。

## ユースケース

- **資料からの自動構成**: URL / PDF / CSV / 議事録 / 業界別データを入力に、spec → PPTX を一気通貫で生成
- **テンプレ準拠の量産**: 社内テンプレ `.pptx` を template に指定すれば layout・色・フォントが揃った deck が量産できる
- **Teams / Slack 連携**: `docs/en/teams-slack-integration.md` で chat 経由のリクエストを受ける運用パターンを提供
- **Workshop**: 製造 / 金融 / ヘルスケア / IT の業界別シナリオで実データから slide を起こす公式ハンズオン

## 他 SDD ツールとの差分

| | SDPM | cc-sdd | GitHub Spec Kit | Kiro |
|---|---|---|---|---|
| 出力物 | **`.pptx`** | コード | コード | コード |
| 提供元 | AWS Samples | OSS（gotalab） | GitHub 公式 | AWS |
| spec 形式 | `slides.json` + `.pptx` template | EARS + design + tasks | core template（上書き可） | EARS native |
| デプロイ形態 | Skill / ローカル MCP / AWS リモート MCP / Web UI | npm package | Python CLI | IDE + CLI |
| 主要 LLM | Bedrock 経由 Claude Sonnet 4.6（変更可） | エージェント側に依存 | エージェント側に依存 | Claude Sonnet 4.5 既定 |
| エージェント数 | 5〜（SKILL.md 対応 + MCP 対応） | 8 | 40+ | 1（Kiro 単体） |
| ライセンス | MIT-0 | MIT | MIT | 商用 |

**「spec 駆動で作るのはコードではなく deck」**である点が他 3 ツールとの最大の差分。SDD の方法論を共有しつつ、エンジンと出力は別物。

## セキュリティ

「**production 利用ではなく demonstration / educational sample**」と明示。デフォルトで実装済みの control:

- S3: public access blocked、SSE-S3、versioning
- DynamoDB: encryption at rest、PITR
- TLS in transit
- API Gateway: Cognito JWT authorizer
- CloudFront: OAI、HTTPS-only、security headers
- IAM: least-privilege（wildcard resource なし）

デフォルトでは **入っていない** 環境依存 control（要評価）:

1. CloudTrail（アカウント単位設定の競合回避のため）
2. VPC endpoint（このスタックは VPC 内 deploy ではないため）
3. WAF の IP allowlist（環境依存、`config.yaml` で設定）
4. CORS の絞り込み
5. S3 access logging
6. Cognito MFA / compromised-credentials 検出
7. Bedrock cross-region inference profile（データ主権要件があれば回避）

## AI エージェントがよくやるミス

1. **Layer 1 だけで足りるのに AWS 全層をデプロイする** — Claude Code / Codex CLI / Cursor / Kiro なら Skill だけで動く。MCP 経由が要らないなら Layer 2 以降は不要
2. **spec を書かずに「これでスライド作って」と頼む** — briefing → outline → art direction の workflow が走らないと出力が不安定。MCP Server Instructions で workflow を読ませる経路を踏む
3. **任意の `.pptx` をテンプレに置けばそのまま動くと思う** — layout / placeholder の解析は自動だが、極端に独自レイアウトの slide master だと marker が見つからず失敗。`docs/*/custom-template.md` に従って placeholder を整備する
4. **デフォルトモデルが Sonnet なのを把握せず Opus を期待する** — `infra/config.yaml` の `model.modelId` を明示する
5. **AGENTS.md / CLAUDE.md を読ませずに手動で `pip install` を試みる** — リポジトリ同梱の指示ファイルをエージェントに読ませれば自動でセットアップする設計。手作業より速い
6. **Layer 3 デプロイで Docker 不在エラーに遭う** — `CDK_DOCKER=finch` で Finch にフォールバックできる。CloudShell 経由なら local Docker 不要
7. **Cognito MFA / WAF を本番想定で外したまま動かす** — sample stack の前提を超える運用には security team review が必須
8. **アセット参照を `icons:Lambda` のまま書く** — backward compatibility は残るが現行は `assets:{source}/{name}`（例: `assets:aws/Lambda`）
9. **`~/.config/sdpm/` の存在を知らずパッケージ再 install で template が消えると誤認** — ユーザーローカル persistent ディレクトリにあるので消えない

## 参考

- [aws-samples/sample-spec-driven-presentation-maker](https://github.com/aws-samples/sample-spec-driven-presentation-maker)
- [Architecture](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/architecture.md) / [Getting Started](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/getting-started.md) / [Custom Templates](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/custom-template.md)
- [Workshop（業界別ハンズオン）](https://catalog.us-east-1.prod.workshops.aws/workshops/a275330a-0ae0-40b2-ad35-264e263c3882/en-US)
- 関連: `ai/practice/spec-driven-development.md` / `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md` / `ai/platform/agent-skills-spec.md` / `ai/platform/mcp-protocol.md`
