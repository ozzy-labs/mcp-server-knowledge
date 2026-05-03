# Claude Code Routines: Knowledge Staleness Verification

knowledge MCP の記事を Claude Code Routines で定期再検証し、上流 docs / リリースノート / spec 変更を自動検出する仕組み。

設計の全体像と意思決定ログは [#90](https://github.com/ozzy-labs/knowledge-mcp-server/issues/90) を参照。

## ファイル構成

```text
.claude/routines/
├── README.md           # 本ファイル: 運用手順 / allowlist / トラブルシューティング
├── daily.md            # daily routine prompt (8 articles, 02:00 JST)
├── weekly.md           # weekly routine prompt (24 articles, 03:00 JST Saturday)
└── monthly.md          # monthly routine prompt (31 articles + audit, 04:00 JST 1st)

scripts/staleness/
├── sources.yaml        # 65 entries: 記事 → 取得ソース mapping (SSOT)
├── sources.schema.json # JSON Schema Draft-07
├── validate.mjs        # Node ajv + yaml の validator
└── setup.sh            # Routines Environment 用セットアップ
```

各 routine は Routines Web UI に配置され、本リポジトリ内の prompt（`.claude/routines/*.md`）の内容を貼り付ける形で運用する。Web UI 側の prompt と本ファイルの内容は **手動同期** する（自動同期はサポートされていない）。

## 実行内容（要約）

| Routine | 起動 (JST) | 対象 | 想定実行時間 |
|---|---|---|---|
| daily | 毎日 02:00 | Daily group 8 件 | 約 10 分 |
| weekly | 毎週土 03:00 | Weekly group 24 件 | 約 30 分 |
| monthly | 毎月 1 日 04:00 | Monthly group 31 件 + audit | 約 60 分 |

並列起動許容（土曜＝月初時のみ全 routine 同日 fire、daily run cap 15/日に対し最大 3 fire 消費）。
全 routine で **Claude Opus 4.7** を使用する。

## アーキテクチャ

```text
[Routines Web UI]
   ├── (cron) ──> [Routine prompt: daily.md / weekly.md / monthly.md]
   │                       │
   │                       │ /update --non-interactive --auto-ship --staleness-group <name>
   │                       ▼
   │              [skill: update]
   │                       │
   │                       │ yq -o json sources.yaml | jq
   │                       ▼
   │              [scripts/staleness/sources.yaml]
   │                       │
   │                       ▼
   │              [並列 fetch: docs / gh release / curl / WebFetch]
   │                       │
   │                       ▼
   │              [confidence 判定: high / medium / low / fail]
   │                       │
   │           ┌───────────┼────────────┬──────────────┐
   │           ▼           ▼            ▼              ▼
   │       [個別 PR]   [個別 PR +    [バッチ PR]   [fail issue]
   │       (high)      needs-review] (low)         (fetch-failed)
   │                   (medium)
   │
   └── repo: ozzy-labs/knowledge-mcp-server
```

## GitHub セットアップ手順

### ラベル作成

```bash
gh label create staleness:needs-review \
  --description "Routine 検証で要レビュー判定された記事更新 PR" \
  --color FBCA04
gh label create staleness:fetch-failed \
  --description "Routine がソース取得に失敗した記事" \
  --color D73A4A
```

### Branch protection

`main` の保護に加え、以下の設定を確認する:

- `claude/staleness/*` ブランチへの push を許可（routine bot の Personal Access Token 経由で push）
- PR merge 後の自動ブランチ削除を有効化（Settings → General → Pull Requests → Automatically delete head branches）

## Routines Web UI 設定手順

URL: <https://claude.ai/code/routines>

### Environment 作成

| 項目 | 値 |
|---|---|
| Name | `knowledge-staleness` |
| Repositories | `ozzy-labs/knowledge-mcp-server` |
| Network access | **Allowlist** + 後述の ~52 ドメイン |
| Env vars | `GH_TOKEN` (user の Personal Access Token, `repo` + `workflow` scope) |
| Setup script | `scripts/staleness/setup.sh` の内容を貼り付け |
| Connectors | **すべて無効化** |
| Allow unrestricted branch pushes | **OFF**（`claude/staleness/*` のみ） |

### 3 Routines 作成

| Name | Schedule (JST) | Prompt |
|---|---|---|
| `knowledge-staleness-daily` | Daily 02:00 | `.claude/routines/daily.md` |
| `knowledge-staleness-weekly` | Weekly Sat 03:00 | `.claude/routines/weekly.md` |
| `knowledge-staleness-monthly` | Monthly 1st 04:00 | `.claude/routines/monthly.md` |

すべて **Model: Claude Opus 4.7**、**Environment: knowledge-staleness**。

## ネットワーク allowlist

sources.yaml から自動抽出 + GitHub / npm / PyPI / endoflife.date の API 用ドメインを追加した一覧。

### sources.yaml 由来のドメイン（52 件）

`scripts/staleness/sources.yaml` の `docs[]` / `rss[]` から抽出。再生成コマンド:

```bash
yq -o json scripts/staleness/sources.yaml | jq -r '
  to_entries
  | map(select(.key != "defaults"))
  | map(.value.sources // {})
  | map([(.docs // []), (.rss // [])] | add)
  | flatten | .[]
' | sed -E 's|^https?://([^/]+).*|\1|' | sort -u
```

```text
agents.md
ai.google.dev
ast-grep.github.io
astro.build
aws.amazon.com
bats-core.readthedocs.io
biomejs.dev
chezmoi.io
cli.github.com
cloudblog.withgoogle.com
code.claude.com
commitlint.js.org
containers.dev
conventionalcommits.org
developers.openai.com
devguide.python.org
docs.anthropic.com
docs.astral.sh
docs.astro.build
docs.aws.amazon.com
docs.docker.com
docs.github.com
docs.npmjs.com
docs.python.org
docs.renovatebot.com
github.blog
jqlang.org
just.systems
kiro.dev
lefthook.dev
mikefarah.gitbook.io
mise.jdx.dev
modelcontextprotocol.io
nodejs.org
openai.com
owasp.org
platform.claude.com
pnpm.io
prettier.io
semver.org
shellcheck.net
simonwillison.net
taplo.tamasfe.dev
tiswww.case.edu
trivy.dev
tsdown.dev
vitest.dev
www.anthropic.com
www.docker.com
www.typescriptlang.org
yamllint.readthedocs.io
zod.dev
```

### API / インフラ用ドメイン（手動追加）

```text
api.github.com               # gh CLI / GitHub REST API
github.com                   # gh push / PR / issue / git clone
objects.githubusercontent.com # GitHub release asset download
raw.githubusercontent.com    # raw_files: の curl 取得
registry.npmjs.org           # npm registry API
pypi.org                     # PyPI JSON API
endoflife.date               # eol: の API
cli.github.com               # gh CLI 配布物 (setup.sh)
github-cloud.s3.amazonaws.com # gh CLI release 配布
deb.debian.org               # apt (gh CLI install in setup.sh)
```

## トラブルシューティング

### Daily run cap (15/day) に到達した

- ユーザーアカウントの Daily run cap は 15/日。平均 1.17 fire/日 で十分余裕あり
- 短時間に多数の手動 `Run now` を行うと cap に当たる可能性あり。直近の手動実行は控える

### `pnpm install --frozen-lockfile` が setup script で失敗

- `pnpm-lock.yaml` の整合性を疑う。ローカルで `pnpm install --frozen-lockfile` を再現する
- 失敗時は最後の commit を確認し、依存関係変更を含む PR が原因か特定する

### PR レビューが溢れる

- `staleness:needs-review` ラベルでフィルタしてレビューする
- 1 週間以上手付かずの PR は close + 翌週 routine で再検出を期待する（routine は冪等）

### `staleness:fetch-failed` issue が連発する

- 特定ドメインの allowlist 漏れを疑う。Routines の `network_access_log` で fetch 元ドメインを特定し、本 README の allowlist を更新する
- 一次源の URL が完全に消えた場合は `sources.yaml` の該当エントリを更新する

### Routines 仕様が変わった

- Routines は research preview。仕様変更を検知したら以下の記事も更新する:
  - `knowledge/ai/agents/claude-code-routines.md`
  - `knowledge/ai/practice/scheduled-tasks.md`

## 検証チェックリスト

新規セットアップ時 / 仕様変更時に以下を実機で確認する:

- [ ] daily routine を **Run now** で 1 回実行 → PR / バッチ PR / issue が想定どおり立つ
- [ ] weekly routine を **Run now** で 1 回実行 → 同様に確認
- [ ] monthly routine を **Run now** で 1 回実行 → audit 結果が含まれる
- [ ] `staleness:needs-review` / `staleness:fetch-failed` ラベルが正しく付与される
- [ ] PR ブランチが `claude/staleness/<path>/<YYYYMMDD>` または `claude/staleness/batch/<routine>/<YYYYMMDD>` 形式
- [ ] 1 週間運用して daily fire が安定
- [ ] 1 ヶ月運用して weekly / monthly fire が安定
