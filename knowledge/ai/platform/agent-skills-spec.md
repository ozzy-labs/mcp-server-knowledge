---
reviewed: 2026-06-07
tags: [ai-platform, standards, specification]
---

# Agent Skills 標準仕様 (`SKILL.md`)

AI エージェントに特定の専門知識やタスク手順をオンデマンドで提供するためのオープン標準フォーマット。2026 年時点で Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI の主要 4 CLI が採用しており、一度定義したスキルを複数のエージェント間で共有できる。

## 設計思想: Progressive Disclosure

エージェントの起動時にすべての指示（コンテキスト）をロードするのではなく、**必要な時だけロードする**仕組み。

1. **Discovery**: 起動時は全スキルの `description` のみを読み込む（コンテキスト節約）。
2. **Activation**: ユーザーの依頼が `description` に合致した際に、エージェントがスキルをアクティベート（または提案）。
3. **Execution**: アクティベートされたスキルの全文（`SKILL.md`）がロードされ、必要に応じて `scripts/` / `references/` / `assets/` 内のリソースがオンデマンドで読み込まれる。

仕様上の目安: メタデータ約 100 トークン（常駐）、本文 5000 トークン未満を推奨（`SKILL.md` は 500 行以内）、リソースは参照時のみロード。

## ディレクトリ構造

スキルは自己完結型のディレクトリとして構成される。ディレクトリ名がデフォルトのスキル名となる。

```text
.agents/skills/my-skill/
├── SKILL.md               # (必須) メタデータと指示書
├── scripts/               # (任意) スキル専用の実行スクリプト
├── references/            # (任意) 静的ドキュメント、スキーマ定義
└── assets/                # (任意) テンプレート、バイナリ
```

## SKILL.md の仕様

YAML フロントマターと Markdown 本文で構成される。

```markdown
---
name: skill-identifier      # スキル名（ケバブケース推奨）
description: |              # 発見の鍵。いつ、何のために使うかを具体的に記述
  このスキルが解決する課題と、エージェントが起動すべきトリガー条件。
allowed-tools: Read Grep    # (任意) 承認をスキップするツール（スペース区切り文字列。Experimental）
---

# Instructions
ここには、スキルがアクティブになった際にエージェントが従うべき具体的な手順、制約事項、
ペルソナ、および `scripts/` 内のツールの使用方法などを記述する。
```

### 主要フィールド

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | スキルの一意な識別子。最大 64 文字、小文字英数字とハイフンのみ、親ディレクトリ名と一致。 |
| `description` | **Yes** | **最重要。** 最大 1024 文字。自動委譲や `activate_skill` の判定に使用される。 |
| `license` | No | スキルに適用されるライセンス名、またはバンドルした LICENSE ファイルへの参照。 |
| `compatibility` | No | 最大 500 文字。動作環境の要件（想定プロダクト・必要パッケージ・ネットワーク要件など）。 |
| `metadata` | No | 任意の key-value マッピング（`author` / `version` 等）。仕様外プロパティの格納用。 |
| `allowed-tools` | No | ユーザーの確認なしで実行を許可するツールの**スペース区切り文字列**（例 `Bash(git:*) Read`）。**Experimental** で実装間の対応差あり。 |

## 発見ティア (Discovery Tiers)

**注意**: Agent Skills 仕様は `SKILL.md` の中身（フォーマット・フィールド）のみを定義し、スキルの**置き場所は規定しない**。以下のティアと `.agents/skills/` 系パスは、クライアント実装ガイド由来の**クロスクライアント慣習**であり、各 CLI 固有のパス（`.claude/skills/` 等）と併存する。

エージェントは通常、以下のスコープをスキャンする。

1. **Built-in**: CLI に組み込まれた標準スキル（デプロイ成果物にバンドル）。
2. **User**: `~/.agents/skills/`（全プロジェクト共通）＋ クライアント固有 `~/.<client>/skills/`。
3. **Project (Workspace)**: `<project>/.agents/skills/`（プロジェクト固有）＋ クライアント固有 `<project>/.<client>/skills/`。

`.agents/skills/` はクライアント間でスキルを相互運用するための共通慣習。**名前衝突時は project レベルが user レベルを上書きする**のが各実装共通の規則。

## 参考

- [Agent Skills Open Standard](https://agentskills.io/)
- 関連: `ai/platform/agent-extensions.md` (CLI ごとの対応状況比較)
