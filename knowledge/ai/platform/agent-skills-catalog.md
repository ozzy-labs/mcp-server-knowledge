---
reviewed: 2026-06-23
tags: [ai-platform, cli, practice]
---

# 用途別 Agent Skills カタログ（エンジニアリング / ドキュメンテーション / 調査）

ソフトウェア開発の実務でよく使われる公開 Agent Skills を、**エンジニアリング / ドキュメンテーション / 調査** の 3 ドメイン別に整理する。Claude Code と Codex CLI の両方を対象とする。フォーマット仕様は `ai/platform/agent-skills-spec.md`、オーサリングの一般指針は `ai/platform/agent-skills-best-practices.md` を参照。

公開スキルは品質・保守状況がまちまちで、実行スクリプトを同梱するものもある。Anthropic / OpenAI 双方が「**信頼できるソースからのみ install する**」ことを推奨している。star 数や CVE 同様、利用前に各スキルの中身を必ず確認すること。

## クロスツールの前提（Claude Code ↔ Codex CLI）

Agent Skills はオープン標準（`SKILL.md` の `name` / `description` 必須）。`SKILL.md` の中身は両ツールで可搬だが、ディスカバリパスと起動方法が異なる。

| | Claude Code | Codex CLI |
|---|---|---|
| 標準ディスカバリ | `.claude/skills/` + クロス慣習 `.agents/skills/` | **主たる場所が `.agents/skills/`**（`$CWD` → 親 → repo root → `$HOME` → `/etc/codex/skills` → built-in） |
| 明示起動 | `/skill-name` | `$skill-name` または `/skills` |
| 暗黙起動 | description マッチで自動委譲（積極的） | description マッチで自動選択だが保守的。`agents/openai.yaml` の `policy.allow_implicit_invocation` で制御 |
| ツール許可 | `allowed-tools`（実験的） | `allowed-tools` は信頼性低。`agents/openai.yaml` policy + `config.toml` の `approval_policy="granular"` → `skill_approval` を使う |
| 配布単位 | plugin marketplace（`/plugin`） | **Plugins**（skills/apps/MCP を束ねる。`openai/plugins`） |

- **相互運用**: `.agents/skills/` に置いた標準準拠スキルは両ツールで動く。ただし Claude 固有 frontmatter（`when_to_use` / `argument-hint` / `paths` / `hooks`）は Codex が無視し、Codex 固有 `agents/openai.yaml` は Claude が無視する。**本文 + `name` / `description` は可搬**だが機能完全互換ではない。
- **Codex のトークン予算**: 起動時のスキル一覧は「コンテキストの最大 2%、不明時は 8,000 文字」に制限。本文は選択時のみロード（progressive disclosure）。
- **AGENTS.md** は OpenAI 発祥で今はクロスベンダ標準（agents.md）。skills とは独立した常時オン指示で、直接の結合はない。
- Codex の旧 `~/.codex/prompts/*.md`（custom prompts）は 2026-01-22 に deprecated、Skills へ移行が公式方針。

## エンジニアリング（要件・設計・実装・テスト・レビュー）

### 公開スキル（エンジニアリング）

| スキル | 配布元 | 用途 | フェーズ |
|---|---|---|---|
| `mcp-builder` | `anthropics/skills`（公式） | MCP サーバー構築ガイド（FastMCP / TS SDK） | 設計・実装 |
| `webapp-testing` | `anthropics/skills`（公式） | Playwright でローカル Web アプリをテスト | テスト |
| `web-artifacts-builder` | `anthropics/skills`（公式） | React/Tailwind/shadcn の UI 構築 | 実装 |
| `frontend-design` | `anthropics/skills`（公式） | 意図的な UI ビジュアルデザイン | 設計（UI） |
| `skill-creator` | `anthropics/skills`（公式） | スキルの作成・改善・eval 計測（メタ） | プロセス整備 |
| `/code-review`, `/security-review`, `/run`, `/verify` | Claude Code 同梱 | diff レビュー / 脆弱性レビュー / アプリ起動検証 | レビュー・テスト |
| `anthropics/claude-code-security-review` | 公式 GitHub Action | SQLi/XSS/認証認可/依存脆弱性スキャン | レビュー（CI） |
| `kiro-spec-requirements/-design/-tasks/-impl` 他 | `gotalab/cc-sdd`（17 skills） | EARS 要件 → 設計 → タスク → 実装の SDD。Claude/**Codex 両対応**（`--codex-skills`） | 要件〜実装 |
| `speckit-specify/-plan/-tasks/-clarify/-analyze` | `github/spec-kit` | 仕様駆動。Codex は `$speckit-*`、`--skills` で導入 | 要件・設計 |
| `getsentry/sentry-pr-code-review`, `trailofbits/differential-review` | ベンダ公式（VoltAgent 集約） | PR コードレビュー / 差分レビュー | レビュー |
| Codex Security plugin / `gh-address-comments` | `openai/plugins`（公式） | 脆弱性スキャン / PR コメント対応 | レビュー |

> Codex の公式スキルは `openai/skills`（**deprecated**）から `openai/plugins`（plugin 形式）へ移行。`build-web-apps` / `build-ios-apps` / `build-macos-apps` 等が実装系。SE 専用の role テンプレートは `openai/role-specific-plugins` には未収録。

### ベストプラクティス（エンジニアリング）

- **核心は自由度（degrees of freedom）の調整**。「崖に挟まれた狭い橋＝低自由度（固定スクリプト）」vs「障害物のない野原＝高自由度（散文）」。
  - 高: コードレビュー・設計判断（散文の手順）
  - 中: 推奨パターンのある codegen（擬似コード/パラメータ付き）
  - 低: **DB マイグレーション・テスト実行**（`migrate.py --verify --backup`、「フラグ追加・変更禁止」）
- **壊れやすく一貫性が要る処理はスクリプト化**: 生成させるより `validate_form.py` を書く。実行意図は `Run`（実行）/ `See ... for the algorithm`（参照）で区別。
- **プロセス型 skill は checklist + feedback loop**: コピー可能な `- [ ]` チェックリスト + 「validator 実行 → 修正 → 繰り返し」。破壊的操作は **plan-validate-execute**（plan を `changes.json` に書く → 検証 → 実行 → 確認）。TDD ループ・レビュー手順・SDD フローに適用できる。
- **知識型 skill は `references/` にドメイン別・1 階層**（API スキーマ・規約）。読まれるまでトークン消費ゼロ。

## ドキュメンテーション（提案書・仕様書・設計書・技術文書・スライド）

### 公開スキル（ドキュメンテーション）

| スキル | 配布元 | 用途 |
|---|---|---|
| `doc-coauthoring` | `anthropics/skills`（公式） | 提案 / 技術仕様 / 意思決定文書（RFC/PRD）の共同執筆。context → refinement → reader testing の 3 段階。リソースなしの純手順型 |
| `internal-comms` | `anthropics/skills`（公式） | 社内コミュニケーション（3P 更新 / newsletter / FAQ / status / incident）。`examples/` に書式別スタイルガイド |
| `docx` / `pptx` / `pdf` / `xlsx` | `anthropics/skills`（公式・**source-available / 非 OSS**） | Office 文書の生成・編集・抽出・変換。`scripts/`（pack/unpack/validate, soffice, markitdown）+ OOXML schema |
| `theme-factory` | `anthropics/skills`（公式） | アーティファクト（slides/docs/HTML）を 10 プリセット or 生成テーマでスタイリング。`assets/` + `themes/*.md` |
| `brand-guidelines` | `anthropics/skills`（公式） | ブランドカラー/タイポを後処理で適用（知識型） |
| cc-sdd `kiro-spec-requirements/-design`, Spec Kit `speckit-specify/-checklist` | `gotalab/cc-sdd` / `github/spec-kit` | 要件 / 設計 / 仕様文書の生成（Codex 対応）。Spec Kit の `checklist` は「仕様の英語ユニットテスト」 |
| `garrytan/document-release` | コミュニティ | 出荷コードに合わせて docs を更新 |
| Mermaid 系（`Agents365-ai/mermaid-skill` 等） | コミュニティ | NL → `.mmd`、検証ループ、多種ダイアグラム。ADR/README に図を埋め込む用途 |
| `notion` / `google-slides` plugin | `openai/plugins`（公式・Codex） | Notion / Google Slides 連携 |

### ベストプラクティス（ドキュメンテーション）

- **リソース配置の使い分け**:
  - `assets/` = 出力に使うテンプレート・boilerplate（docx/pptx テンプレ、レターヘッド、テーマ）
  - `references/` = スタイルガイド・執筆規約（読んで従う。100 行超は目次必須）
  - `scripts/` = 決定的な生成・変換（markitdown で読込、soffice で `.doc`→`.docx`、PDF フォーム入力、OOXML validate）
- **構造化執筆ワークフロー**（`doc-coauthoring` が範例）: ①context gathering（5–10 個の明確化質問）→②refinement（3–5 セクション骨子、不確実箇所優先、`str_replace` で部分編集）→③**reader testing**（コンテキストなしの別 Claude に読ませ、読者の疑問を予測させて gap が出なくなるまで反復）。
- **skill の型を意識する**: 手順型（co-authoring、リソースなし・高自由度）/ テンプレート型（docx/pptx、`assets`+`scripts`・低自由度・「既存テンプレ規約が常に優先」）/ 知識型（brand-guidelines、`references` 中心）。
- **ブランド・トーン**: ブランド適用は生成後の後処理パスとして分離。トーンは「汎用指示 1 本」ではなく書式別 reference にルーティング。`description` は三人称・トリガー明示。

## 調査（ディープリサーチ・Web リサーチ・コードベース探索・データ分析）

### 公開スキル（調査）

| スキル | 配布元 | 用途 |
|---|---|---|
| `xlsx` | `anthropics/skills`（公式） | スプレッドシートのデータ分析（pandas / openpyxl）。公式で最もデータ分析に近い |
| `webapp-testing` | `anthropics/skills`（公式） | Web アプリの調査・検証（Playwright） |
| `deep-research` | **Claude Code harness 組み込み** | fan-out Web 検索 → ソース取得 → 主張を敵対的に検証 → 引用付きレポート合成 |
| `Weizhena/Deep-Research-skills` | コミュニティ（最多 star） | アウトライン生成 → 並列エージェント Web 調査 → Markdown レポート（HITL）。Claude/OpenCode/Codex 対応 |
| `glebis/claude-skills`（Deep Research / Firecrawl Research 他） | コミュニティ | 外部 Deep Research API ラップ、スクレイプ + BibTeX、GRADE 評価ヘルスリサーチ |
| `jamditis/claude-skills-journalism` | コミュニティ | 14 skill。SIFT / C2PA によるソース検証、fact-check、データジャーナリズム（pandas/polars/DuckDB） |
| `petar-nauka/fact-check-skill` | コミュニティ | SIFT + CRAAP + claim 分解の 11 段階パイプライン |
| `trailofbits/audit-context-building` | ベンダ公式 | コードベースの深い構造的コンテキスト構築 |
| Data Analytics / Financial Markets role plugin | `openai/role-specific-plugins`（公式・Codex） | メトリクス調査・データ検証 / 株式リサーチ・メモ |

> ⚠️ **`anthropics/skills` に汎用「deep-research」公式スキルは存在しない**。公式の調査隣接は `xlsx`（データ分析）と `webapp-testing`（Web 調査）のみ。Claude Code の `deep-research` は harness が実行時に注入する組み込みで、ディスク上にも公開リポにも無い（公開アーティファクトではない）。Codex 側にも汎用公式 deep-research スキルは無い。

### ベストプラクティス（調査）

- **orchestrator-worker / fan-out**（Anthropic「multi-agent research system」由来）: lead が 3–5（複雑時 10+）の subagent を並列起動、各 subagent も 3+ ツール並列。広探索（breadth-first）では multi-agent が単一 Opus を **90.2% 上回った**。
- **skill か agent オーケストレーションか**: 自己完結・逐次の調査手順 + ツール/ルーブリック同梱なら **skill**。1 コンテキストに収まらない並列広探索が要るなら **orchestrator + 並列 subagent** に昇格（skill はその入口/プロンプトになる）。全 agent が同一コンテキスト共有や依存が多い場合（多くのコーディング）は multi-agent を避ける。
- **検証と引用規律**: 主張をソース位置に対応づける（`CitationAgent` 相当）。LLM judge で引用正確性を採点。**単一ソースの主張は flag、ソース衝突は均さず明示**。
- **ハルシネーション回避**: 多ソース triangulation、不確実性の明示。
- **トークン/コンテキスト管理**: multi-agent は chat の約 15× トークンを消費（「トークン量だけで eval 分散の 80% を説明」）。**start wide, then narrow down**（要約してからドリル）、複雑度に応じた労力配分、subagent は lead に返す前に findings を圧縮。`references/` にソース評価ルーブリック（CRAAP/SIFT）、`scripts/` に fetch/parse/dedup を置く。

## 共通の選定・運用指針

- **公式 > ベンダ公式 > コミュニティ**の順で信頼。awesome 系（`ComposioHQ/awesome-claude-skills` 66k★、`VoltAgent/awesome-agent-skills` 26k★）は**索引**であり、star は個々のスキル品質を保証しない。
- **クロスツール運用**は `.agents/skills/` に標準準拠で置く。Claude/Codex 固有 frontmatter は相手側で無視される前提で本文を可搬に保つ。
- **セキュリティ**: コミュニティスキルは実行スクリプト同梱。導入前に scripts/依存/外部誘導指示（プロンプトインジェクション経路）を監査。`allowed-tools` は実験的で境界として信用しない。

## 参考

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/built-multi-agent-research-system)
- [anthropics/skills（公式公開スキル）](https://github.com/anthropics/skills)
- [anthropics/claude-code-security-review](https://github.com/anthropics/claude-code-security-review)
- [Codex Agent Skills（OpenAI 公式）](https://developers.openai.com/codex/skills)
- [openai/plugins（Codex 公式プラグイン）](https://github.com/openai/plugins) / [openai/role-specific-plugins](https://github.com/openai/role-specific-plugins)
- [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) / [github/spec-kit](https://github.com/github/spec-kit)
- 関連: `ai/platform/agent-skills-best-practices.md`（オーサリング指針）, `ai/platform/agent-skills-spec.md`（仕様）, `ai/agents/codex-cli.md`, `ai/workflow/cc-sdd.md`, `ai/workflow/github-spec-kit.md`
