---
reviewed: 2026-07-05
tags: [ai-workflow, commercial]
aliases: [codex-model, model_reasoning_effort, gpt-5.5, codex-usage, codex-model-fallback]
---

# Codex CLI のモデル選択・reasoning effort・フォールバック・使用量管理

Codex CLI で「どのモデルを・どの単位で・どう切り替えるか」、reasoning effort（推論の深さ）の指定、モデルが使えないときの**フォールバックの有無**、そして**使用量（ChatGPT プラン枠 / API 従量）の観測**をまとめる。CLI 本体の一般仕様は [`codex-cli.md`](codex-cli.md)、Claude Code の対応する仕組み（対比）は [`claude-code-model-selection.md`](claude-code-model-selection.md) を参照。

> 本記事のモデルラインアップは **rust-v0.142.5（2026-07-01）** 時点。最新は `/model` ピッカーおよび公式 [Models](https://developers.openai.com/codex/models) で確認する。

## モデル選択の「単位」

モデルと reasoning effort は以下の**単位**で指定でき、**Claude Code と同様にタスク内容に応じた自動選択は無い**（すべて手動 or 事前設定）。下位（起動時・実行時に近い）ほど優先される。

| 単位 | 指定方法 | 種別 |
|---|---|---|
| **CLI フラグ（単発）** | `codex -m <model>` / `--model`、`-c model_reasoning_effort="high"`（`--config`） | 手動・その起動限り・**最優先** |
| **`/model`（セッション内）** | TUI の `/model` コマンドでモデル切替 + reasoning level 調整 | 手動・そのセッション限り |
| **profile** | `[profiles.<name>]`（または `$CODEX_HOME/<name>.config.toml`）を `--profile` / `-p` で選択 | 事前設定・プロファイル単位で上書き |
| **project config** | リポジトリの `.codex/config.toml` の `model` / `model_reasoning_effort` | 事前設定・プロジェクト単位 |
| **user config** | `~/.codex/config.toml`（`$CODEX_HOME`）の `model` / `model_reasoning_effort` | 事前設定・グローバル既定 |
| **subagent** | `~/.codex/agents/`（personal）/ `.codex/agents/`（project）の agent file frontmatter の `model` / `model_reasoning_effort` | 事前設定・**省略時は親セッションを継承** |

**優先順位（高い → 低い）**: CLI `-c` / `--model` → profile（`--profile`）→ project `.codex/config.toml` → user `~/.codex/config.toml` → 組み込み既定。subagent は自分の frontmatter に値があればそれを使い、無ければ親セッションのモデル / effort を継承する。

```toml
# ~/.codex/config.toml
model = "gpt-5.5"
model_reasoning_effort = "medium"   # minimal / low / medium / high / xhigh

[profiles.fast]
model = "gpt-5.4-mini"
model_reasoning_effort = "low"
```

```bash
codex -m gpt-5.4 -c model_reasoning_effort="high" "..."   # 単発上書き
codex --profile fast                                        # profile 選択
```

## 現行モデル

`/model` ピッカーで選択できる推奨モデル（`gpt-5.3-codex-spark` を除き ChatGPT サインイン / OpenAI API キーの双方で利用可）:

| モデル | 位置付け | 備考 |
|---|---|---|
| `gpt-5.5` | **現行の推奨デフォルト** | 複雑コーディング・Computer Use・知識作業・リサーチ向けの最新フロンティア。2026-04-23 に Codex で提供開始。公式は「まず `gpt-5.5`」を推奨 |
| `gpt-5.4` | Flagship | プロ用途向けフロンティア。`gpt-5.5` を使わない / アカウントに未ロールアウトのときの**手動の代替** |
| `gpt-5.4-mini` | 軽量・高速 | 応答性重視のコーディング・**subagent 向けの推奨** |
| `gpt-5.3-codex-spark` | research preview | ほぼリアルタイムな反復コーディング向け・text-only。**ChatGPT Pro 限定** |

- **デフォルト**: モデル未指定時は各サーフェス（CLI / IDE / Cloud）が推奨モデルを選ぶ（＝静的なデフォルト。後述のとおり実行時の自動 failover ではない）。
- **deprecated**: `gpt-5.3-codex` と `gpt-5.2` は 2026-05-26 に **ChatGPT サインイン時の Codex で user-selectable モデルとして deprecated**（API キー経由の旧モデル ID 利用とは別）。`gpt-5.5` / `gpt-5.4` / `gpt-5.4-mini` へ移行する。

## reasoning effort（`model_reasoning_effort`）

推論の深さは config / CLI / subagent frontmatter で `model_reasoning_effort` として指定する。

- **値**: `minimal` / `low` / `medium` / `high` / `xhigh`。公式サンプル config は `medium` を例示する（公式リファレンスは明示的な「既定値」を宣言していない）。
- **`xhigh` はモデル依存**（Responses API のみ・サポートするモデルでのみ有効）。
- 併せて `model_reasoning_summary`（`auto` / `concise` / `detailed` / `none`）で推論サマリの出力を制御できる。
- `/model` ではモデル切替と同時に reasoning level も調整できる。

## フォールバック — Codex に自動フォールバックは無い

**重要**: Codex には「指定モデルが使えないとき自動で別モデルに切り替える」機構が公式ドキュメント上**存在しない**。Claude Code の `fallbackModel`（可用性ベースの自動切替）に相当するものは無い。

- 「モデル未指定時は推奨モデルにフォールバック」という記述は**静的なデフォルト選択**の意味で、overload / rate-limit / unavailable での per-request 自動 failover ではない。
- **`gpt-5.4` が "fallback"** と語られるのは、`gpt-5.5` を選ばない / アカウントに未ロールアウトのときに `/model` で**手動で選ぶ代替**という意味。`gpt-5.5` は段階ロールアウトのため「使えない場合の代替」はアカウント可用性の話であり、自動切替ではない。
- したがってモデルが overload / rate-limit のときの退避は、**手動で `/model` を切り替える**か profile を使い分けるしかない。→ Claude Code との最大の違い（[`claude-code-model-selection.md`](claude-code-model-selection.md) の 2 系統フォールバックと対照）。

## 使用量・レート制限

課金経路によってレート制限のモデルが異なる。

| 経路 | レート制限モデル |
|---|---|
| **ChatGPT プラン**（Free / Go / Plus / Pro / Business / Enterprise / Edu） | ローリング **5 時間**窓（ローカル CLI メッセージと Cloud タスクで共有）＋ **週次**上限 |
| **OpenAI API キー** | **従量課金**（使用トークン分のみ。固定のプラン枠は無い） |

- **`/usage`**（v0.140+）: CLI 内でアカウントのトークン使用量・rate-limit 状況を表示する。`/status` でもセッション内で残り枠を確認できる。
- **rate-limit reset banking**（Plus / Pro 対象）: 未使用のリセットを banking し 30 日間利用できる。
- **モデル選択は残枠の持ちに影響する**: `gpt-5.4` / `gpt-5.4-mini` に切り替えると（切替元によっては）ローカルメッセージの usage 上限を延ばせる。小さいモデルは共有枠の消費が遅い（＝総上限が上がるわけではない）。

## 実務パターン

- **既定は `gpt-5.5`**。subagent や機械的・応答性重視の作業は `gpt-5.4-mini` に落として共有枠を温存する。
- **`xhigh` は難タスク限定**（対応モデルのみ）。ルーチンは `low` / `medium` で十分。
- **モデル切替を profile 化**しておくと（例: `[profiles.fast]` = `gpt-5.4-mini` + `low`）`--profile` / `/model` で素早く退避できる。自動フォールバックが無いぶん、profile による手動退避が実質的な代替になる。
- credential / セキュリティ隣接作業でもモデル降格は自動では起きない（Claude Fable の safety 由来の自動降格のような挙動は Codex には無い）。

## 関連

- Codex CLI 本体（インストール・承認ポリシー・subagent・hooks 等）: [`codex-cli.md`](codex-cli.md)
- Claude Code のモデル選択・フォールバック・使用量（対比）: [`claude-code-model-selection.md`](claude-code-model-selection.md)

公式:

- [Models](https://developers.openai.com/codex/models)（現行ラインアップ・deprecation）
- [Config reference](https://developers.openai.com/codex/config-reference) / [Config sample](https://developers.openai.com/codex/config-sample)（`model` / `model_reasoning_effort` / profiles）
- [CLI reference](https://developers.openai.com/codex/cli)（`--model` / `-c` / `/model`）
- [Subagents](https://developers.openai.com/codex/subagents)（agent file の `model` / `model_reasoning_effort`）
- [Pricing](https://developers.openai.com/codex/pricing)（ChatGPT プラン枠 / API 従量 / `/usage` / banking）
- [Changelog](https://developers.openai.com/codex/changelog)
