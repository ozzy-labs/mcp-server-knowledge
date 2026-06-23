---
reviewed: 2026-06-23
tags: [github, cli, ai-agent]
stability: beta
aliases: [gh skills]
---

# gh skill（GitHub CLI の Agent Skills 管理）

GitHub CLI（`gh`）組み込みのサブコマンドで、GitHub リポジトリから Agent Skills（`SKILL.md`）を install / list / preview / publish / search / update する。1 つのコマンドで GitHub Copilot・Claude Code・Cursor・Codex・Gemini CLI など 40+ のエージェントに対し、ホスト固有のディレクトリへスキルを配置できるクロスツールのパッケージマネージャ的な位置づけ。

**preview 機能**（gh 2.94.0 時点。仕様は予告なく変更され得る）。エイリアス `gh skills`。スキルは [agentskills.io](https://agentskills.io/specification) のオープン標準（`skills/*/SKILL.md` 規約）で自動検出される。

## スコープとディレクトリモデル

スキルの配置先は **スコープ × エージェント** で決まる。

- **scope（既定 `project`）**: `project` = 現在の git リポジトリ内、`user` = ホームディレクトリ（全プロジェクトで有効）
- **agent（非対話時の既定 `github-copilot`）**: 各エージェントのホスト固有ディレクトリに配置
- project スコープでは多くのエージェント（GitHub Copilot, Cursor, Codex, Gemini CLI, Antigravity, Amp, Cline, OpenCode, Warp 等）が **`.agents/skills` を共有**する。同一の配置先に解決される複数ホストを選んでも、スキルはそこに 1 回だけインストールされる。
- `--dir` で `--agent` / `--scope` を上書きして任意ディレクトリに配置できる。

インストール済みスキルには **source tracking メタデータが frontmatter に注入**され（`metadata.github-*`）、`gh skill update` が変更検知に使う。

## サブコマンド

| コマンド | 用途 | 主なエイリアス |
|---|---|---|
| `install` | リポジトリ / ローカルからスキルを導入 | `add` |
| `list` | インストール済みスキルを一覧 | `ls` |
| `preview` | `SKILL.md` を導入せず端末で閲覧 | `show` |
| `publish` | ローカルのスキルを検証し GitHub Release で公開 | — |
| `search` | 公開リポジトリ横断でスキルを検索 | — |
| `update` | 導入済みスキルを最新へ更新 | — |

### install

```bash
gh skill install <repository> [<skill[@version]>] [flags]
```

- **引数**: 第 1 引数は `OWNER/REPO`。`--from-local` でローカルディレクトリから導入（symlink ではなくコピー + local-path 追跡メタデータ注入）。
- **スキル指定**: 名前 / 名前空間付き（`author/skill`）/ リポジトリ内の正確なパス（`skills/author/skill`、`.../SKILL.md`）。**大きなリポでは名前ではなくパス指定にするとツリー全走査を回避でき高速**。
- **バージョン解決順**: ①最新のタグ付き release → ②デフォルトブランチ HEAD。`@VERSION` または `--pin <tag|SHA>` で固定。
- **主なフラグ**: `--agent`（対象エージェント）, `--scope {project|user}`, `--dir`, `--all`（プロンプトなしで全スキル導入）, `-f/--force`, `--from-local`, `--pin`, `--allow-hidden-dirs`（`.claude/skills/` 等の隠しディレクトリも対象）, `--upstream`（再公開スキルを検出した際に上流から導入）。
- 非対話実行時は `repository` と「スキル名 or `--all`」が必須。

```bash
# 対話的に repo / skill / agent を選択
gh skill install

# 特定スキルを Claude Code 用に user スコープで導入
gh skill install github/awesome-copilot git-commit --agent claude-code --scope user

# バージョン固定
gh skill install github/awesome-copilot git-commit@v1.2.0

# 全スキルを一括導入
gh skill install github/awesome-copilot --all
```

### list

```bash
gh skill list [--agent <host>] [--scope {project|user}] [--dir <path>] [--json <fields>]
```

既知の全エージェントホストを project / user 両スコープで走査する。JSON フィールド: `agentHosts, path, pinned, scope, skillName, sourceURL, version`。

### preview

導入せずに `SKILL.md` をページャで表示する。先にファイルツリーを示し、対話時は scripts/references 等を file picker で個別に閲覧できる。`@VERSION` でタグ / ブランチ / SHA 指定可。

### publish

```bash
gh skill publish [<directory>] [--dry-run] [--fix] [--tag v1.0.0]
```

ローカルリポのスキルを Agent Skills 仕様に対して**検証**し、GitHub Release を作って公開する。検出規約は install と同じ（`skills/*/SKILL.md`、`skills/{scope}/*/SKILL.md`、root の `*/SKILL.md`、`plugins/{scope}/skills/*/SKILL.md`）。

検証項目:

- スキル名が agentskills.io の厳密な命名規則に一致
- スキル名がディレクトリ名と一致
- 必須 frontmatter（`name` / `description`）の存在
- `allowed-tools` が配列ではなく**文字列**であること
- install メタデータ（`metadata.github-*`）が含まれていれば除去

公開は対話的に「リポジトリへの `agent-skills` トピック付与 → バージョンタグ選択（semver 推奨）→ 自動生成ノート付き Release 作成」を案内する。`--dry-run` で検証のみ、`--tag` で非対話公開、`--fix` で install メタデータ除去のみ（公開せず、レビュー & commit 後に再実行）。

### search

GitHub Code Search API で `SKILL.md` の name / description にマッチするスキルを公開リポジトリ横断検索する。name に query を含むものが上位。`--owner` でユーザー / Org に限定、`--limit`（既定 15）/ `--page`。対話時は結果から直接インストール可。JSON フィールド: `description, namespace, path, repo, skillName, stars`。

### update

ローカルの tree SHA（`SKILL.md` frontmatter）と remote を比較して更新を検知する。`--pin` 済みスキルは notice 付きでスキップ（`--unpin` で対象化）。GitHub メタデータの無いスキル（手動 / 他ツール導入）は対話時にソースリポを尋ね、`--all` / 非対話ではスキップ。`--force` で remote と一致していても再ダウンロード（ローカル変更を上書き。ただしローカル追加ファイルは消さない）。`--dry-run` で読み取りのみ。

## Agent Skills エコシステムでの位置づけ

- 各 CLI 固有の plugin marketplace（Claude Code の `/plugin`、Codex の `openai/plugins`）と異なり、`gh skill` は **`gh` 一本で多数のエージェントへ横断配布**できる。ソースは普通の GitHub リポジトリ（`agent-skills` トピック）と Release。
- 配置は `ai/platform/agent-skills-spec.md` のディスカバリ慣習に従い、`.agents/skills`（クロスクライアント）や各ホスト固有ディレクトリに解決される。
- スキルの選び方・用途別カタログは `ai/platform/agent-skills-catalog.md`、オーサリング指針は `ai/platform/agent-skills-best-practices.md` を参照。

## 参考

- [GitHub CLI manual](https://cli.github.com/manual/)（`gh skill <command> --help` が正本）
- [Agent Skills specification](https://agentskills.io/specification)
- 関連: `platforms/github/gh-cli.md`, `platforms/github/gh-extensions.md`, `ai/platform/agent-skills-spec.md`, `ai/platform/agent-skills-catalog.md`
