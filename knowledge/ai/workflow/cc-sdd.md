---
reviewed: 2026-05-04
tags: [ai-workflow, spec, oss, npm, javascript]
stability: beta
---

# cc-sdd

OSS の SDD オーケストレータ（gotalab/cc-sdd）。npm パッケージとして配布され、`npx cc-sdd@latest` 一発で **17 個の Agent Skill**（discovery / spec / impl / steering 等）を 8 種類の AI コーディングエージェントに対してインストールする。「Kiro-inspired」を明言しており、Kiro の spec 形式（EARS + design + tasks）と互換。

公式: [github.com/gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) / npm: [cc-sdd](https://www.npmjs.com/package/cc-sdd)

SDD 概念全体は `ai/practice/spec-driven-development.md` を参照。同領域の比較は `ai/workflow/kiro.md` / `ai/workflow/github-spec-kit.md`。

## インストール

```bash
cd your-project
npx cc-sdd@latest
```

デフォルトは Claude Code skills + 英語ドキュメント。エージェント・言語の切替:

```bash
npx cc-sdd@latest --codex-skills --lang ja          # Codex CLI / 日本語
npx cc-sdd@latest --cursor-skills --lang zh-TW       # Cursor IDE / 繁体字
npx cc-sdd@latest --gemini-skills                    # Gemini CLI
npx cc-sdd@latest --copilot-skills                   # GitHub Copilot
npx cc-sdd@latest --windsurf-skills                  # Windsurf IDE
npx cc-sdd@latest --opencode-skills                  # OpenCode
npx cc-sdd@latest --antigravity                      # Antigravity（experimental）
```

13 言語に対応（`--lang ja`, `zh-TW`, `en` ほか）。

## 動作モデル

- **Agent Skills として配布**: 17 skill が `SKILL.md` 経由で progressive disclosure ロード。詳細は `ai/platform/agent-extensions.md`
- **Kiro 互換 spec**: `requirements.md`（EARS）/ `design.md`（File Structure Plan 含む）/ `tasks.md`（`_Boundary:_` + `_Depends:_`）
- **per-task subagent**: `/kiro-impl` の各タスクで fresh implementer + 独立 reviewer + auto-debug を spawn
- **TDD 強制**: implementer は RED → GREEN サイクル、feature flag 後ろで実装
- **boundary-first**: design.md の File Structure Plan からタスク境界を決め、reviewer は境界違反を検出

## SDD ワークフロー（v3 Skills mode）

エージェント側に `/kiro-*` slash command が登録される。

### 主要 slash commands

| Command | 役割 |
|---|---|
| `/kiro-discovery` | エントリポイント。新規 work を分類（既存 spec 拡張 / spec なし直接実装 / 新規 spec / 複数 spec 分割 / 混合）。`brief.md` と必要なら `roadmap.md` を生成 |
| `/kiro-spec-init` | 単一 spec の初期化 |
| `/kiro-spec-requirements` | EARS 記法で要件定義 |
| `/kiro-spec-design` | アーキテクチャ + Mermaid 図 + File Structure Plan |
| `/kiro-spec-tasks` | 境界・依存 annotation 付きタスクリスト |
| `/kiro-spec-batch` | roadmap から複数 spec を並列生成 + cross-spec review |
| `/kiro-impl` | 長時間自律実行（per-task subagent + reviewer + auto-debug） |
| `/kiro-steering` | プロジェクト全体に効くガイダンスファイル更新 |
| `/kiro-validate-gap` | 既存 system に対する gap 検証 |

### 推奨フロー

| シナリオ | フロー |
|---|---|
| 新機能 / 製品サイズの企画 | `kiro-discovery` → `kiro-spec-init` → `kiro-spec-requirements` → `kiro-spec-design` → `kiro-spec-tasks` → `kiro-impl` |
| 既存システム拡張 | `kiro-steering` → `kiro-discovery` or `kiro-spec-init` → 任意 `kiro-validate-gap` → `kiro-spec-design` → `kiro-spec-tasks` → `kiro-impl` |
| 大型施策の分解 | `kiro-discovery` → `kiro-spec-batch` |
| spec 不要な小変更 | `kiro-discovery` → 直接実装 |

### `/kiro-impl` の内部

各タスクで以下を独立 subagent として spawn:

1. **Implementer**: TDD（RED → GREEN）で feature flag 後ろに実装
2. **Reviewer**: 独立した文脈で review。境界違反 / 仕様逸脱を検出
3. **Auto-debug**: implementer が詰まる or reviewer が 2 回 reject した時、clean context で root cause 調査

学びは `tasks.md` 内の `## Implementation Notes` を介して後続タスクに伝播。1 task / 1 iteration、中断後の再実行が安全。

## 対応エージェント（v3 Skills mode）

| エージェント | install フラグ | 安定度 |
|---|---|---|
| **Claude Code** | `--claude-skills`（デフォルト） | Stable |
| **Codex** | `--codex-skills` | Stable |
| **Cursor IDE** | `--cursor-skills` | Beta |
| **GitHub Copilot** | `--copilot-skills` | Beta |
| **Windsurf IDE** | `--windsurf-skills` | Beta |
| **OpenCode** | `--opencode-skills` | Beta |
| **Gemini CLI** | `--gemini-skills` | Beta |
| **Antigravity** | `--antigravity` | Beta（experimental） |
| **Qwen Code** | `--qwen` | Legacy（commands mode のみ） |

8 つの Skills variants は**同じ 17 skill セットを共有**。「Beta」は機能差ではなく platform integration の実運用量の差。

レガシーモード（slash command 直配置の `--claude` / `--cursor` 等）は v3 で deprecated。`/kiro:*` 命名は legacy で、現行は `/kiro-*`（コロンなし）。

## 哲学

> spec は「エージェントへの命令書」ではなく「コードの部分間の契約」として扱う。コードが真実、spec は境界を明示するもの。

cc-sdd は spec を contract として位置づけ、人間は phase gate（spec 確定時）で承認、エージェントは contract の内側を自由に動く、という分業を狙う。

詳細: [Why cc-sdd?](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/why-cc-sdd.md)

## 他ツールとの差分

| | cc-sdd | Kiro | GitHub Spec Kit |
|---|---|---|---|
| 提供元 | OSS（gotalab） | AWS | GitHub 公式 |
| 形態 | npm package | IDE + CLI | Python CLI |
| 入口 | `npx cc-sdd@latest` | `curl install.sh` / Desktop | `uv tool install` |
| エージェント数 | 8 | 1（Kiro 単体） | 30+ |
| spec 形式 | Kiro 互換（EARS） | EARS native | core templates 上書き可 |
| autonomous impl | あり（`/kiro-impl` per-task subagent + reviewer + auto-debug） | あり（IDE 内） | あり（`/speckit.implement`） |
| TDD 強制 | あり（RED → GREEN + feature flag） | あり | extension 経由 |
| boundary annotation | あり（`_Boundary:_` / `_Depends:_`） | なし | extension 経由 |
| ライセンス | MIT | 商用 | MIT |

cc-sdd は **「Kiro の spec 形式を Kiro 以外でも使う」**用途と **「より厳格な per-task subagent + boundary discipline」**を求める用途に向く。

## AI エージェントがよくやるミス

1. **`/kiro:*`（コロン付き）を使う** — v2.x までの命名。v3 Skills mode は `/kiro-*`（ハイフン）。Migration Guide 参照
2. **`--claude` / `--cursor` 等の legacy mode で install** — 現行は `--*-skills`。legacy は deprecated（Codex は blocked = 廃止）
3. **デフォルト install で全エージェント分が入ると思う** — 1 回の `npx cc-sdd@latest` で**1 つのエージェント**しか install されない。複数エージェントには複数回実行が必要
4. **`/kiro-impl` を 1 セッションで全タスク消化させようとする** — 各タスクは別 subagent で走る設計。並行 / 中断・再開可能だが、メインセッションで全部待つとコンテキスト窓を消費する
5. **`requirements.md` を箇条書きで書く** — Kiro 互換の EARS 記法が前提。`/kiro-spec-requirements` 経由で生成しないと後段の reviewer が境界違反を誤検出
6. **`design.md` の File Structure Plan を省略** — `tasks.md` の `_Boundary:_` annotation の元になる。これを省くと per-task subagent が境界外を触り、reviewer が reject ループに入る
7. **`/kiro-discovery` を skip して `/kiro-spec-init` から始める** — discovery は work の routing（既存 spec 拡張か新規か等）を行う。skip すると spec の重複・矛盾が発生
8. **legacy `/kiro:*` 命名のドキュメントを参考にする** — v3 Migration Guide で破壊的変更が多数。executive summary だけでも目を通す

## 参考

- [github.com/gotalab/cc-sdd](https://github.com/gotalab/cc-sdd)
- [npm: cc-sdd](https://www.npmjs.com/package/cc-sdd)
- [Skill Reference](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/skill-reference.md)
- [Migration Guide (v2.x → v3.0)](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/migration-guide.md#5-v2x-to-v30)
- [Why cc-sdd? A philosophy note](https://github.com/gotalab/cc-sdd/blob/main/docs/guides/why-cc-sdd.md)
- 関連: `ai/practice/spec-driven-development.md` / `ai/workflow/kiro.md` / `ai/workflow/github-spec-kit.md` / `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/platform/agent-extensions.md`
