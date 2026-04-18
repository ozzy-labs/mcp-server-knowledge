# 記事一覧

<!-- このファイルは `scripts/generate-index.mjs` によって自動生成されます。手動で編集せず、対応する記事を修正してから再生成してください。 -->

## `tools/` — CLI・SDK・ライブラリ (24)

| 記事 | reviewed | 概要 |
|---|---|---|
| [actionlint](tools/actionlint.md) | 2026-04-18 | GitHub Actions ワークフローファイル（`.github/workflows/*.yaml`）の静的解析ツール。構文エラー・式の型・shellcheck 連携・未知の runner やアクションを検出する。Go 製の単一バイナリ。 |
| [Anthropic API (Claude API)](tools/anthropic-api.md) | 2026-04-18 | Anthropic が提供する Claude モデルの API。本記事は API 本体（SDK 経由のアプリ実装）を対象。Claude Code CLI は別記事 `tools/claude-code.md` を参照。 |
| [Biome](tools/biome.md) | 2026-04-18 | Rust で書かれた高速な JavaScript / TypeScript / JSON / CSS / GraphQL のフォーマッタ + リンタ。ESLint + Prettier を単一ツールで置き換えることを目標とする。 |
| [Claude Code](tools/claude-code.md) | 2026-04-18 | Anthropic が提供する AI コーディングエージェント CLI。ターミナル上でコードベースの理解・編集・Git 操作・コマンド実行をエージェントが自律的に行う。 |
| [Codex CLI](tools/codex-cli.md) | 2026-04-18 | OpenAI が提供するオープンソースのコーディングエージェント CLI。フルスクリーン TUI でコードの読み取り・編集・コマンド実行を行い、マルチエージェント並列処理もサポートする。拡張機構の横断比較は `standards/agent-extensions.md` を参照。 |
| [Gemini CLI](tools/gemini-cli.md) | 2026-04-18 | Google が提供するオープンソースの AI エージェント CLI。ReAct（Reason and Act）ループにより、複雑なコーディングタスク・デバッグ・自動化をターミナルから実行する。拡張機構の横断比較は `standards/agent-extensions.md` を参照。 |
| [gh (GitHub CLI)](tools/gh-cli.md) | 2026-04-18 | GitHub 公式の CLI。PR・Issue・Actions・Releases・Secrets などブラウザの UI で行う操作をターミナルから実行できる。AI エージェント運用の基盤ツール（Claude Code / Codex CLI も Git/GitHub 操作で多用）。 |
| [GitHub Copilot CLI](tools/github-copilot-cli.md) | 2026-04-18 | GitHub が提供する AI コーディングエージェント CLI。GitHub アカウントと深く統合され、コードの編集・テスト実行・Git ワークフローをエージェントが自律的に行う。2026-02-25 に GA。拡張機構の横断比較は `standards/agent-extensions.md` を参照。 |
| [Gitleaks](tools/gitleaks.md) | 2026-04-18 | Git リポジトリに誤コミットされたシークレット（API キー、トークン、秘密鍵）を検出する CLI。pre-commit や CI で実行する想定。Go 製の単一バイナリ。 |
| [jq](tools/jq.md) | 2026-04-18 | JSON を処理するコマンドラインフィルタ。`grep` / `sed` / `awk` の JSON 版。API 応答の整形、設定ファイルの抽出、CI スクリプトでの値取り出しに必須。C 製の単一バイナリ。 |
| [lefthook](tools/lefthook.md) | 2026-04-18 | Go で書かれた高速な Git フック管理ツール。並列実行、ファイルフィルタ、ステージ更新、複数リポジトリ横断の設定共有をサポート。husky / pre-commit の置き換えとして採用が進む。 |
| [markdownlint](tools/markdownlint.md) | 2026-04-18 | Markdown の構文・スタイルを検証する Linter。`markdownlint-cli2` が現行推奨 CLI。ルール体系は [CommonMark](https://commonmark.org/) + GitHub Flavored Markdown 準拠。 |
| [MCP TypeScript SDK](tools/mcp-typescript-sdk.md) | 2026-04-18 | `@modelcontextprotocol/sdk` — Model Context Protocol のサーバー・クライアント両方を実装する公式 TypeScript SDK。本リポジトリもこれを利用している。 |
| [mise](tools/mise.md) | 2026-04-18 | 開発ツールのバージョン管理 + タスクランナー + 環境変数管理を統合した CLI。asdf の後継として設計され、Go バイナリで起動が高速。Node / Python / Go / Rust / バイナリ単体まで単一設定で管理できる。 |
| [pnpm](tools/pnpm.md) | 2026-04-18 | 高速・ディスク効率の良い Node.js パッケージマネージャ。グローバルストアへのハードリンクで依存を共有し、厳格な node_modules ツリー（hoisting しない）で間接依存への依存を防ぐ。 |
| [Renovate](tools/renovate.md) | 2026-04-18 | 依存関係を自動で最新に保つボット。PR を作って更新を提案し、CI が通れば自動マージまで可能。Dependabot より設定の自由度と対応エコシステムが広い。Mend が開発・運用。 |
| [ShellCheck](tools/shellcheck.md) | 2026-04-18 | Bash / POSIX sh スクリプトの静的解析ツール。よくあるバグ・移植性問題・クオート抜けなど、エディタと目視では拾いきれない問題を検出する。Haskell 製。 |
| [shfmt](tools/shfmt.md) | 2026-04-18 | Go 製のシェルスクリプトフォーマッタ。bash / mksh / POSIX sh のパース + 整形を一貫して行う。shellcheck と並んで shell スクリプト運用のデファクトツール。 |
| [taplo](tools/taplo.md) | 2026-04-18 | Rust 製の TOML フォーマッタ + バリデータ + 言語サーバー。`pyproject.toml` / `Cargo.toml` / `.mise.toml` など TOML 採用が広がるにつれて有用性が増した。 |
| [Trivy](tools/trivy.md) | 2026-04-18 | Aqua Security が提供する包括的なセキュリティスキャナ。コンテナイメージ・ファイルシステム・IaC・Kubernetes マニフェストに対して、脆弱性 (CVE)・シークレット・設定ミス・ライセンスの問題を検出する。Go 製の単一バイナリ。 |
| [Vitest](tools/vitest.md) | 2026-04-18 | Vite ネイティブの高速テストランナー。Jest 互換の API で ESM・TypeScript・JSX をネイティブに扱える。HMR ベースの watch モードが特徴。 |
| [yamlfmt](tools/yamlfmt.md) | 2026-04-18 | Google 製の YAML フォーマッタ。Go で書かれた単一バイナリ。インデント・行末・キー順などを一貫した形に整形する。yamllint（検証）と対になる。 |
| [yamllint](tools/yamllint.md) | 2026-04-18 | YAML ファイルの構文と**スタイル**を検証する Linter。Python 製。インデント、行長、コメントフォーマット、truthy 値の扱い等、YAML 特有の落とし穴を検出する。 |
| [Zod](tools/zod.md) | 2026-04-18 | TypeScript ファーストのスキーマ宣言・バリデーションライブラリ。ランタイム検証と型推論を同じスキーマで実現する。MCP SDK のツール入力スキーマなど、本リポジトリでも中心的に使用。 |

## `standards/` — 規約・設計原則・プロトコル (10)

| 記事 | reviewed | 概要 |
|---|---|---|
| [AI エージェントの拡張機構（Skills / Subagents / Hooks / Plugins）](standards/agent-extensions.md) | 2026-04-18 | Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI の 4 大コーディングエージェント CLI が、2026 年時点でほぼ共通のメンタルモデルで**拡張機構**を持つようになった。本記事はそれらを横断比較する。個別 CLI の仕様は `tools/claude-code.md` / `tools/codex-cli.md` / `tools/gemini-cli.md` / `tools/github-copilot-cli.md` を参照。 |
| [AGENTS.md](standards/agents-md.md) | 2026-04-18 | AI コーディングエージェント向けのプロジェクトガイダンスを記述する共通ファイル。単一の `AGENTS.md` で Codex CLI / Gemini CLI / GitHub Copilot CLI / Cursor / Amp など複数のエージェントにまたがって方針を共有する。 |
| [AI エージェントのコンテキスト管理](standards/ai-context-management.md) | 2026-04-18 | LLM エージェントの実用性は「コンテキストウィンドウをいかに効率よく使うか」で大きく変わる。本記事は Claude Code / Codex CLI / Gemini CLI など現代の AI エージェントで採用されている主要な手法をまとめる。 |
| [Conventional Commits](standards/conventional-commits.md) | 2026-04-18 | コミットメッセージの形式を規約化した仕様。履歴から自動生成（CHANGELOG、セマンティックバージョン）を可能にし、変更の意図を機械可読にする。 |
| [GitHub Flow](standards/github-flow.md) | 2026-04-18 | GitHub が提唱するシンプルな Git ワークフロー。`main` を常にデプロイ可能に保ち、新しい変更は短命な feature branch で行う。Git Flow より軽量で、継続的デリバリーに適している。 |
| [Markdown 執筆スタイル（本リポジトリ向け）](standards/markdown-style.md) | 2026-04-18 | この knowledge base の記事を書くときの執筆規約。AI エージェントが新規記事を追加する・既存記事を更新する際の一貫性を保つため。 |
| [Model Context Protocol (MCP)](standards/mcp-protocol.md) | 2026-04-18 | Anthropic が 2024 年に発表したオープン規格。AI エージェント（クライアント）と外部コンテキスト・ツール（サーバー）を標準化されたプロトコルで接続する。USB-C のように「1 本のインタフェースで多様な周辺機器につなぐ」イメージ。 |
| [マルチエージェント対応リポジトリの設計](standards/multi-agent-repo.md) | 2026-04-18 | 1 つのリポジトリを Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI のいずれでも扱えるようにする設計指針。拡張機構そのものの仕様は `standards/agent-extensions.md`、共通指示ファイルは `standards/agents-md.md` を参照。 |
| [プロンプトインジェクション対策](standards/prompt-injection.md) | 2026-04-18 | LLM エージェントが外部データ（Web ページ、ファイル、ツール結果、メール等）を読み込む際に、その中に埋め込まれた指示に従ってしまう攻撃。MCP サーバー・ツール呼び出しが返す `content` も例外ではなく、エージェント連携を設計する側は常に対策を組み込む必要がある。 |
| [Semantic Versioning (SemVer)](standards/semver.md) | 2026-04-18 | `MAJOR.MINOR.PATCH` の 3 要素でバージョンを表す公開 API 契約。Conventional Commits とセットで、リリース自動化の基盤になる。 |

## `languages/` — 言語別 (2)

| 記事 | reviewed | 概要 |
|---|---|---|
| [Bash / POSIX shell](languages/bash.md) | 2026-04-18 | AI コーディングエージェントが最も頻繁に書く言語のひとつ。落とし穴は大半が「変数展開」「終了コード」「サブシェル境界」に集中する。ツール記事は `tools/shellcheck.md` / `tools/shfmt.md` を参照。 |
| [TypeScript + Node.js ESM](languages/typescript-esm.md) | 2026-04-18 | Node.js で TypeScript を ECMAScript Modules（ESM）として動かすセットアップの要点と落とし穴。CommonJS から移行するプロジェクトで AI エージェントが誤りやすいポイントに重点を置く。 |

## `platforms/` — プラットフォーム (2)

| 記事 | reviewed | 概要 |
|---|---|---|
| [Docker](platforms/docker.md) | 2026-04-18 | アプリケーションをコンテナ（軽量な隔離環境）として配布・実行するプラットフォーム。OCI (Open Container Initiative) 仕様準拠の runtime + CLI + イメージレジストリ + Compose のエコシステム。 |
| [GitHub Actions](platforms/github-actions.md) | 2026-04-18 | GitHub ネイティブの CI/CD プラットフォーム。ワークフローを YAML で定義し、リポジトリへのイベント（push, PR, schedule 等）に応じて実行する。`gh` CLI と並んで GitHub 運用の中核。 |

_Total: 38 articles._
