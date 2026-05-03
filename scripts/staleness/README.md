# Staleness verification

`scripts/staleness/sources.yaml` をもとに knowledge MCP の記事 65 件を再検証する仕組み。実行手段は 2 系統:

| 手段 | 概要 | docs |
|---|---|---|
| **手動実行**（推奨, 現状） | `status.sh` で対象を確認し、ローカル Claude Code から `/update --staleness-group <name>` を叩く | 本ファイル |
| Routines（クラウド自動実行） | Anthropic 管理の VM 上で daily/weekly/monthly に自動実行 | [`.claude/routines/README.md`](../../.claude/routines/README.md) |

## ファイル構成

```text
scripts/staleness/
├── README.md           # このファイル: 手動運用ガイド
├── sources.yaml        # 65 entries: 記事 → 取得ソース mapping (SSOT)
├── sources.schema.json # JSON Schema Draft-07
├── validate.mjs        # ajv + yaml validator (CI / lefthook で使用)
├── status.sh           # 各 group の reviewed 状況を表示し、次に流す group を提案
└── setup.sh            # Routines Environment 用 (手動運用では未使用)
```

## 手動運用フロー

### 1. 状況確認

```bash
pnpm run staleness:status
# または
scripts/staleness/status.sh
```

各 group の記事ごとに `reviewed` 日付と経過日数を表示し、最後に次に流すべき group を提案する。

しきい値:

| Group | OVERDUE 判定 |
|---|---|
| daily | > 1 日 |
| weekly | > 7 日 |
| monthly | > 30 日 |

出力例:

```text
DAILY (threshold > 1 days)
  ai/agents/claude-code         reviewed 2026-04-18 ( 16 days ago)  OVERDUE
  ai/agents/codex-cli           reviewed 2026-04-18 ( 16 days ago)  OVERDUE
  ...
  -- 8 articles, 7 overdue, oldest 16 days

Suggested next:
  /update --staleness-group daily  (7 overdue, oldest 16 days)
```

### 2. 該当 group を更新

ローカル Claude Code セッションで:

```text
/update --staleness-group daily
```

`update` skill が以下を実行する（[`.agents/skills/update/SKILL.md`](../../.agents/skills/update/SKILL.md) 参照）:

1. `sources.yaml` を読み、`group: daily` かつ `skip: true` でない記事を抽出
2. 各記事につき、定義された method (`docs` / `github_releases` / `rss` / `raw_files` / `npm` / `pypi` / `eol` / `web_search` / `related_internal`) で並列フェッチ
3. 既存記事との差分から confidence を 4 段階で判定 (`high` / `medium` / `low` / `fail`)
4. confidence 別に編集・PR 起票方針を決める

手動モードでは completion 後に AskUserQuestion で「ship まで進める？」と聞かれる。`Ship` を選べば lint → commit → push → PR まで一気通貫。

### 3. weekly / monthly も同様

```text
/update --staleness-group weekly
/update --staleness-group monthly
```

monthly は 30+ 件あるので時間がかかる。途中でセッション切れたら個別記事指定 (`/update <path>`) でリトライ可能。

### 4. 単一記事だけ更新

`reviewed` を強制更新したい記事がある場合:

```text
/update ai/agents/claude-code
```

（group 指定なしの単一指定）

## 推奨ペース

`status.sh` の OVERDUE 判定に従えば自然に以下の頻度になる:

- daily group: 1〜2 日に 1 回
- weekly group: 週 1 回（土曜想定）
- monthly group: 月 1 回（月初想定）

毎回 status を見て「OVERDUE が出た group だけ流す」運用が省エネ。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `status.sh` が `[no reviewed field]` を出す | 該当記事の frontmatter に `reviewed:` がない。手で追加するか `/update <path>` で更新 |
| `[parse error]` | `reviewed:` の値が `YYYY-MM-DD` 形式でない |
| `[MISSING ...]` | `sources.yaml` に登録されているが knowledge ファイルが存在しない。記事を追加するか sources.yaml から削除 |
| `/update --staleness-group <name>` が始まらない | skill の `--staleness-group` 解析を確認。`/update` 単体で動くなら skill 側 OK |
| Web fetch が長時間止まる | 単一記事で再実行 (`/update <path>`)、または特定 source method を skip するよう sources.yaml を一時修正 |

## sources.yaml の更新

新規 knowledge 記事を追加した時:

1. `scripts/staleness/sources.yaml` に該当記事を追加（`group` と `sources` を最低限定義）
2. `pnpm run validate-staleness-sources` で schema 検証
3. `pnpm run staleness:status` で表示されることを確認
4. 通常の commit / PR

`skip: true` で OFF にする場合は `skip_reason` を必須で書く（人間 / agent 後任向けの説明）。
