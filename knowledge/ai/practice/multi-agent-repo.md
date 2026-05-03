---
reviewed: 2026-04-18
tags: [ai-workflow, methodology]
---

# マルチエージェント対応リポジトリの設計

1 つのリポジトリを Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI のいずれでも扱えるようにする設計指針。拡張機構そのものの仕様は `ai/platform/agent-extensions.md`、共通指示ファイルは `ai/platform/agents-md.md` を参照。

## 設計目標

| 目標 | アプローチ |
|---|---|
| 指示の DRY | `AGENTS.md` を single source of truth。CLI 固有ファイルは差分のみ |
| Skills の再利用 | `.agents/skills/` に置き、複数 CLI から発見させる |
| Hooks の一貫性 | 共通の shell スクリプトを呼び出し、各 CLI の hooks.json から参照 |
| チーム共有 | project スコープを Git で共有、user スコープは個人に任せる |
| 新 CLI 対応の容易さ | CLI 固有設定を薄くし、汎用資産を厚くする |

## 推奨ディレクトリ構成

```text
<repo>/
├── AGENTS.md                       # 全 CLI 共通の指示
├── CLAUDE.md                       # Claude Code 固有の差分
├── .agents/
│   └── skills/                     # 4 CLI が発見する共通スキル
│       └── <skill-name>/SKILL.md
├── .claude/
│   ├── settings.json               # Claude Code 権限・フック
│   ├── agents/<name>.md            # Claude Code 固有 subagent
│   ├── commands/<name>.md          # Claude Code 固有 command
│   └── rules/                      # 追加ルール
├── .codex/
│   └── config.toml                 # Codex CLI 固有設定
├── .gemini/
│   ├── settings.json               # Gemini CLI 固有設定
│   └── commands/<ns>/<cmd>.toml    # Gemini 固有 command
├── .github/
│   ├── agents/<name>.agent.md      # Copilot CLI 固有 agent
│   ├── hooks/hooks.json            # Copilot CLI hooks
│   └── skills/                     # （任意）Copilot 専用 skill
├── .mcp.json                       # プロジェクト MCP（Claude/Gemini/Copilot）
└── scripts/
    └── hooks/                      # shell で書いた共通フック
        ├── pre-tool-use.sh
        └── post-tool-use.sh
```

**原則**:

- **`.agents/skills/` を中心に据える**。4 CLI すべてが読める唯一の共通ディレクトリ
- **CLI 固有ディレクトリには CLI 固有機能だけ**を置く。汎用資産は共通側に
- **`.mcp.json` は Claude Code が読む名前だが、Gemini/Copilot も類似パスを参照可能** — 詳細は `ai/platform/mcp-protocol.md`

## 指示ファイルの分担

```text
AGENTS.md          ... プロジェクト概要 / Tech Stack / 主要コマンド / 規約リンク
  │
  ├─ CLAUDE.md     ... 「共通方針は AGENTS.md を参照」+ Claude 固有のスキル／フック言及
  ├─ GEMINI.md     ... Gemini 固有の追加コンテキスト（任意）
  └─ .github/copilot-instructions.md ... レガシー互換のみ
```

**DRY の要**: `CLAUDE.md` の先頭で「共通方針は AGENTS.md を参照」とリダイレクトし、Claude Code 固有の事項（Skills 一覧、出力スタイル、ステータスラインなど）だけを残す。この手法は Gemini CLI / Copilot CLI でも同様に機能する。

## Skills の相互運用設計

### 共通 Skill の置き場所

```text
.agents/skills/code-review/SKILL.md
.agents/skills/release-notes/SKILL.md
```

| CLI | 読み取り挙動 |
|---|---|
| Codex CLI | `.agents/skills/` を **一次配置**として読む |
| Gemini CLI | `.gemini/skills/` または `.agents/skills/` を読む |
| Copilot CLI | `.github/skills/` / `.claude/skills/` / `.agents/skills/` を全て読む |
| Claude Code | デフォルトでは `.claude/skills/` のみ |

**Claude Code を参加させるトリック**: Claude Code の `.claude/skills/` にシンボリックリンクで共通ディレクトリを参照させる。

```bash
ln -s ../../.agents/skills ./.claude/skills
```

> **注意**: Windows では symlink 作成に admin 権限または developer mode が必要。代替として `mklink /J` のジャンクションを使うか、共通 skill をプラグイン化して配布する（`ai/platform/agent-extensions.md` の Plugins 節）。

### SKILL.md の書き方（4 CLI 共通）

```markdown
---
name: code-review
description: Review code for security and best practices. Use when reviewing PRs or changed files.
allowed-tools: Read Grep Glob
---

# Code Review

## 観点
- セキュリティ脆弱性
- パフォーマンス問題
- テストカバレッジ
```

**共通で使えるフィールド**: `name`, `description`, `allowed-tools`

**CLI 固有のフィールドは別ファイルに切り出す**:

- Codex CLI 固有: `agents/openai.yaml`（同ディレクトリ内）
- Claude Code 固有: `when_to_use` / `argument-hint` / `paths` / `hooks`（他 CLI では無視される）

CLI 固有フィールドを SKILL.md に混ぜても**他 CLI は無視するだけ**なので致命的ではないが、可搬性を重視するなら最小共通仕様に留める。

## Subagents の設計

**Subagents は CLI 間の相互運用性が低い**。各 CLI のディレクトリ・frontmatter フォーマットが異なるため、1 つの定義を共有するのは現実的でない。

推奨アプローチ:

1. **Skills で代用できるなら Skills にする**。Skill を `context: fork` で子エージェント起動できる CLI もある（Claude Code）
2. **CLI 固有機能が必要な場合のみ subagent を書く**。各 CLI の `agents/` ディレクトリに個別配置
3. **定義内容は類似する**ので、`.agents/agents-template/<name>.md` にテンプレートを置き、各 CLI 用に生成するスクリプトを用意する手もある

## Hooks の一貫化

各 CLI の hooks フォーマットは異なるが、**shell スクリプトを共通化**できる。

### 共通 shell スクリプト

```bash
# scripts/hooks/pre-tool-use.sh
#!/usr/bin/env bash
# stdin JSON のフィールド名は CLI ごとに異なる（Claude Code は tool_name、
# Codex / Copilot はそれぞれ別スキーマ）。実装前に各 CLI のドキュメントで
# 受け取る JSON 構造を確認し、分岐を調整すること
input=$(cat)
if echo "$input" | jq -e '.tool_name == "Bash" and (.tool_input.command | test("rm -rf"))' > /dev/null; then
  echo '{"permissionDecision": "deny", "reason": "destructive rm blocked"}'
  exit 0
fi
exit 0
```

### 各 CLI からの参照

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "bash ./scripts/hooks/pre-tool-use.sh" }
        ]
      }
    ]
  }
}
```

```json
// .github/hooks/hooks.json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "type": "command", "bash": "./scripts/hooks/pre-tool-use.sh", "timeoutSec": 30 }
    ]
  }
}
```

**注意**: stdin の JSON スキーマは CLI ごとに異なる（例: Claude Code は `tool_name` / `tool_input`）。実際に使う前に各 CLI のドキュメントでキー名を確認し、スクリプト側を調整する必要がある。Gemini CLI の環境変数は `CLAUDE_PROJECT_DIR` を互換エイリアスとして提供する点も覚えておく。

## MCP 設定の共有

`.mcp.json` を Claude Code が読み、類似パスを他 CLI も読む。プロジェクトスコープ MCP の単一定義は以下の形で実現できる:

```json
{
  "mcpServers": {
    "knowledge": {
      "command": "node",
      "args": ["./node_modules/@ozzylabs/knowledge-mcp-server/dist/index.js"]
    }
  }
}
```

各 CLI の設定ファイルから参照:

- Claude Code: `.mcp.json` を自動読み取り
- Gemini CLI: `.gemini/settings.json` の `mcpServers` に同内容を複製（または `extends` 経由）
- Codex CLI: `config.toml` の `[mcp_servers.knowledge]` に同内容を複製
- Copilot CLI: `.github/mcp.json` または `~/.copilot/mcp-config.json` に複製

**自動同期スクリプト**: `.mcp.json` を single source of truth にして、他 CLI 用の設定を生成する `scripts/sync-mcp.mjs` を用意すると保守が楽。

## スコープ設計

```text
┌────────────────────────────────────────┐
│ Enterprise / Managed settings           │ ← 組織ポリシーで上書き
├────────────────────────────────────────┤
│ Project (Git 管理、.claude/ / .github/) │ ← チーム共有
├────────────────────────────────────────┤
│ Personal (~/.claude/ / ~/.codex/ 等)    │ ← 個人設定
└────────────────────────────────────────┘
```

| 置く層 | 内容 |
|---|---|
| Project | プロジェクト固有のスキル、ルール、禁止事項、MCP 設定 |
| Personal | 好みの出力スタイル、個人の補助スキル、認証情報 |
| Managed | 組織全体の deny list、強制フック |

`.gitignore` に `*.local.json` / `**/secrets/**` を入れ、プロジェクト層から個人情報を排除する。

## CI/CD との統合

エージェントリポジトリを複数人で運用する際、以下を CI で検査する:

- `SKILL.md` の frontmatter バリデーション（`name` / `description` 必須）
- `AGENTS.md` / `CLAUDE.md` の行数上限（肥大化防止）
- `.mcp.json` と各 CLI 設定の内容一致（同期スクリプトの副産物）
- Hooks スクリプトのテスト（モック JSON を流して exit code / 出力を検証）

markdownlint + zod 等のランタイムバリデータで静的チェック可能。

## 採用判断のフレーム

**すべての CLI に対応する必要はない**。チームが使う CLI だけサポートするのが現実的。

| チーム構成 | 推奨対応 |
|---|---|
| Claude Code 単独 | `CLAUDE.md` + `.claude/` のみ。`AGENTS.md` は任意 |
| Claude Code + Codex CLI | `AGENTS.md` + `CLAUDE.md` + `.agents/skills/` |
| 全員バラバラ | 共通化のコストに見合うかを慎重に判断。最低限 `AGENTS.md` + 共通 skill |

**オーバーエンジニアリング警告**: 未使用の CLI のために設定を書き続けるのはコスト。実際に使われている CLI だけ対応する。

## AI エージェントがよくやるミス

1. **`AGENTS.md` と `CLAUDE.md` に同じ内容を複製** — DRY の目的が崩れる。`CLAUDE.md` は差分のみ
2. **Skills を `.claude/skills/` だけに置く** — 他 CLI が発見しない。共通化するなら `.agents/skills/`
3. **Subagent 定義を 4 CLI で無理に統一しようとする** — フォーマットが違う。CLI 固有で十分
4. **Hooks を JSON ごと複製して差分管理できなくする** — 共通 shell スクリプトを作り、各 hooks.json から参照
5. **`.mcp.json` の内容を手動で各 CLI に同期** — 設定のズレでトラブル。同期スクリプトを書く
6. **使っていない CLI のサポートを先回りで書く** — 死に設定が増える。実需要ベースで追加

## 参考

- 本リポジトリの `ai/platform/agent-extensions.md` — 拡張機構の横断仕様
- 本リポジトリの `ai/platform/agents-md.md` — `AGENTS.md` の書き方
- 本リポジトリの `ai/practice/ai-context-management.md` — 指示ファイルの肥大化対策
- 本リポジトリの `ai/platform/mcp-protocol.md` — MCP サーバー設計
- 本リポジトリの `ai/practice/prompt-injection.md` — Skills / Hooks のセキュリティ
