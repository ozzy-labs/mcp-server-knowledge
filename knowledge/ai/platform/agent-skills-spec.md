---
reviewed: 2026-05-10
tags: [ai-platform, standards, specification]
---

# Agent Skills 標準仕様 (`SKILL.md`)

AI エージェントに特定の専門知識やタスク手順をオンデマンドで提供するためのオープン標準フォーマット。2026 年時点で Claude Code, Codex CLI, Gemini CLI, GitHub Copilot CLI の主要 4 CLI が採用しており、一度定義したスキルを複数のエージェント間で共有できる。

## 設計思想: Progressive Disclosure

エージェントの起動時にすべての指示（コンテキスト）をロードするのではなく、**必要な時だけロードする**仕組み。

1. **Discovery**: 起動時は全スキルの `description` のみを読み込む（コンテキスト節約）。
2. **Activation**: ユーザーの依頼が `description` に合致した際に、エージェントがスキルをアクティベート（または提案）。
3. **Load**: アクティベートされたスキルの全文（`SKILL.md`）と関連リソースがコンテキストに注入される。

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
allowed-tools: [Read, Grep] # スキル有効中に承認をスキップするツール
---

# Instructions
ここには、スキルがアクティブになった際にエージェントが従うべき具体的な手順、制約事項、
ペルソナ、および `scripts/` 内のツールの使用方法などを記述する。
```

### 主要フィールド

| フィールド | 必須 | 説明 |
|---|---|---|
| `name` | Yes | スキルの一意な識別子。 |
| `description` | **Yes** | **最重要。** 自動委譲や `activate_skill` の判定に使用される。 |
| `allowed-tools` | No | ユーザーの確認なしで実行を許可するツールのリスト。 |

## 発見ティア (Discovery Tiers)

エージェントは通常、以下の順序でスキルをスキャンする（下ほど優先度が高い）。

1. **Built-in**: CLI に組み込まれた標準スキル。
2. **User**: `~/.agents/skills/` (全プロジェクト共通の個人スキル)。
3. **Workspace**: `./.agents/skills/` (プロジェクト固有のスキル)。

## 参考

- [Agent Skills Open Standard](https://agentskills.io/)
- 関連: `ai/platform/agent-extensions.md` (CLI ごとの対応状況比較)
