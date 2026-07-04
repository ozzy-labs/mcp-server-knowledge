---
reviewed: 2026-07-04
tags: [ai-workflow, commercial]
aliases: [model-selection, fallbackModel, opusplan, oauth-usage, fast-mode]
---

# Claude Code のモデル選択・切替・フォールバック・使用量管理

Claude Code で「どのモデルを・どの単位で・どう切り替えるか」、指定モデルが使えないときの**フォールバック**、そして**使用量（プラン枠）の観測**をまとめる。CLI 本体の一般仕様は [`claude-code.md`](claude-code.md)、API 側（SDK 実装）の Fable 5 等モデル仕様は [`../platform/anthropic-api.md`](../platform/anthropic-api.md) を参照。

## モデル選択の「単位」

モデルは以下の**4つの単位**で指定できる。**タスク内容に応じた自動選択は無い**（feature request 段階）。すべて手動 or 事前設定で、下位単位が上位を上書きする。

| 単位 | 指定方法 | 種別 |
|---|---|---|
| **session / main loop** | `/model <alias\|name>`・`claude --model`・`ANTHROPIC_MODEL`・settings.json の `model` | 手動（優先順: `/model` > `--model` > env > settings） |
| **skill / command** | `SKILL.md`（およびカスタムコマンド）frontmatter の `model:`（+ `effort:`） | 事前設定・**そのスキル/コマンドがアクティブな間のみ**適用 |
| **subagent** | `.claude/agents/*.md` frontmatter の `model:` / Agent tool の `model` パラメータ / `CLAUDE_CODE_SUBAGENT_MODEL` env | 事前設定（env は frontmatter・パラメータより優先。`inherit` で通常解決） |
| **Workflow ステージ** | Dynamic Workflows の `agent()` 呼び出しごとの `model`（+ `effort`） | 決定論的・段単位＝最も細かい |

- `/model` はセッション中に即切替。v2.1.153 以降は選択が user settings の `model` に保存され既定になる（ピッカーで `s` を選ぶとそのセッション限り）。
- `--model` / `ANTHROPIC_MODEL` は起動したセッション限り。別ターミナルで別モデルを同時に走らせたいときは `/model` ではなく各起動の `--model` を使う。
- `CLAUDE_CODE_SUBAGENT_MODEL` は**全 subagent に適用され、per-invocation の `model` パラメータと subagent frontmatter の両方を上書きする**（`inherit` で通常のモデル解決に戻す）。
- **skill / subagent には `fallback` 相当のキーは無い**（`model:` は指定できるがフォールバック先は指定できない）。フォールバックは後述の session レベル設定のみ。

### `/model` エイリアス

| エイリアス | 挙動 |
|---|---|
| `default` | オーバーライドを解除し、アカウント種別の推奨モデル（または組織デフォルト）へ戻す。エイリアスそのものではない |
| `best` | 組織が Fable 5 を使えるなら Fable 5、なければ最新 Opus |
| `fable` | 最も難しく長丁場のタスク向けに Claude Fable 5 |
| `sonnet` / `opus` / `haiku` | 各ティアの最新（Anthropic API では `opus`→Opus 4.8、`sonnet`→Sonnet 5） |
| `sonnet[1m]` / `opus[1m]` | 100 万トークンコンテキスト |
| `opusplan` | **plan モードは opus・実行モードは sonnet に自動切替**（`opusplan[1m]` で両フェーズ 1M） |

**アカウント種別の `default`**: Max / Team Premium / Enterprise 従量 / Anthropic API → Opus 4.8、Claude Platform on AWS → Opus 4.7、Pro / Team Standard / Enterprise サブスク席 → Sonnet 5、Bedrock / Vertex / Foundry → Sonnet 4.5。**Fable 5 はどのアカウント種別でも既定にならない**（`/model fable` 等で明示選択が必要）。

### effort（推論の深さ）も同じ単位で指定可

`effort`（`low`/`medium`/`high`/`xhigh`/`max`）は model と同じく **skill / subagent frontmatter の `effort:`** で指定でき、その skill/subagent がアクティブな間だけセッション値を上書きする（env `CLAUDE_CODE_EFFORT_LEVEL` は最優先）。既定 effort は Fable 5・Sonnet 5・Opus 4.8 が `high`、Opus 4.7 が `xhigh`。`max` はセッション限り（env 経由を除く）。`xhigh` は Fable 5 / Sonnet 5 / Opus 4.7-4.8 のみ（Opus 4.6・Sonnet 4.6 は `max` はあるが `xhigh` は無い）。Fable 5 / Sonnet 5 / Opus 4.7+ は常に adaptive reasoning で、**Fable 5 は thinking を off にできない**。

### Fast mode（`/fast`）— モデルは変えず出力を高速化

`/fast` で **Fast mode** をトグルする。`opusplan` のようなモデル切替でも effort 変更でもなく、**同一モデルのまま出力トークンのスループットを上げる（最大約2.5倍・プレミアム単価）別軸**。下位モデルへは降格しない。

- **Opus 4.8 / 4.7 のみ**対応。**Opus 4.7 の fast mode は deprecated**（撤去後は 4.7 での `speed:"fast"` はエラー）で、Opus 4.8 が恒久的な fast 対応ティア。
- Fast mode は **Anthropic API（first-party）専用の research preview**。Claude Platform on AWS / Bedrock / Vertex / Foundry・Batch API・Priority Tier では使えない。
- v2.1.176 以降は `availableModels`（利用可能モデルの許可リスト設定）による制約の対象。API 側の実装は beta ヘッダ `fast-mode-2026-02-01` ＋ トップレベル `speed:"fast"`（`client.beta.messages`）で、標準 Opus とは別の rate limit を持つ。

## フォールバック（指定モデルが使えないとき）

性質の異なる**2系統**があり、混同しないこと。

### 1. Fallback model chains（可用性ベース）

primary モデルが **overloaded / unavailable / 再試行不可のサーバーエラー**のときに次点モデルへ自動切替する。

- **発火しない条件（重要）**: **authentication / billing / rate-limit / request-size / transport エラーでは切り替わらない**（通常の retry / error 処理に従う）。→ **プランの使用量上限（週次枠を含む）に達した状態は rate-limit 系なので、この chain では自動フォールバックされない**。
- 設定: `--fallback-model sonnet,haiku`（カンマ区切り）または settings に配列。**最大3モデル**（重複除去後・超過分は無視）。切替は**そのターン限り**で、次メッセージは再び primary から試す。`"default"` は既定モデルに展開。

```json
{
  "fallbackModel": ["claude-sonnet-5", "claude-haiku-4-5"]
}
```

### 2. Automatic model fallback（Fable 5 の安全性ベース）

Fable 5 はサイバーセキュリティ・生物学の safety classifier を伴い、**フラグされたリクエストを既定 Opus（Anthropic API は Opus 4.8、Claude Platform on AWS は Opus 4.7）で再実行**して以降そのセッションは Opus を継続する（`/model fable` で復帰）。

- **セッション初回リクエストでも発火し得る**（CLAUDE.md・git status・ワークスペース文脈を運ぶため）。セキュリティ/生物学系のリポジトリは文脈だけでトリップする。`claude --safe-mode` で customizations を切って切り分け可能。
- `/config` の「switch models when a message is flagged」を off にすると、フラグ時に自動切替せず「Opus に切替 / プロンプト編集して Fable で再試行」を選ばせられる。非対話 / SDK では refuse でターン終了。
- **オフェンシブセキュリティ（pentest / CTF）や生物学隣接コードは高頻度でトリップ**する（アカウントのフラグではなく、これらドメインでの想定挙動）。→ **credential/セキュリティ系作業に Fable を使うと拒否や降格が頻発し、むしろ不利**。

> まとめると「次点を指定して自動切替」は **`fallbackModel`（可用性）** が担い、Fable の safety 拒否は **別系統で自動 Opus 降格**。**skill / subagent / Workflow ステージに個別の fallback は指定できない**（Workflow でモデル別退避が要るなら script 内で try/catch して別モデルで再試行するしかない）。

## 使用量（プラン枠）の観測

サブスク（Pro / Max / Team / Enterprise）の**使用量上限**は、非公開だが実在する OAuth エンドポイントで観測できる（Claude Code の `/usage` コマンドと statusline の `rate_limits` のデータ源）。

```bash
# トークンは表示せず read-only GET のみ
TOKEN=$(jq -r .claudeAiOauth.accessToken ~/.claude/.credentials.json)  # macOS は keychain
curl -s https://api.anthropic.com/api/oauth/usage \
  -H "Authorization: Bearer $TOKEN" -H "anthropic-beta: oauth-2025-04-20" | jq .
```

レスポンス（要点）: `five_hour` / `seven_day` の各 `utilization`（消費%）・`resets_at`（ISO 8601）に加え、**`limits[]` 配列に枠ごとの内訳**が入る（各エントリの消費%は `percent` フィールド ── トップレベル窓の `utilization` とはフィールド名が違うだけで同じ「消費%」を指す）。`kind` は `session`（5時間）/ `weekly_all`（週次全体・通常これが `is_active:true` の律速）/ **`weekly_scoped`（モデル別枠。`scope.model.display_name` に対象モデル名）**。

```jsonc
{
  "five_hour": { "utilization": 18.0, "resets_at": "..." },
  "seven_day": { "utilization": 41.0, "resets_at": "..." },
  "limits": [
    { "kind": "session",       "percent": 18, "is_active": false },
    { "kind": "weekly_all",    "percent": 41, "is_active": true  },
    { "kind": "weekly_scoped", "percent": 19, "is_active": false,
      "scope": { "model": { "display_name": "Fable" } } }   // ← Fable 専用の週次別枠
  ]
}
```

- **Fable 5 は専用の週次別枠（`weekly_scoped`）を持つ**（Max プランで観測、2026-07 時点。`seven_day_opus`/`_sonnet` は null だが Fable だけ scoped で返る）。
- **モデル別週次枠を使い切ったときの挙動は公式未文書**。ただし前述のとおり `fallbackModel` は rate-limit / 使用量上限では発火しないため、**週次枠の枯渇は自動フォールバックされない前提が安全**（ブロック / エラーで停止し得る）。→ `weekly_scoped` % を監視し、枯渇前に手動で `/model` を下位モデルへ切替えるのが確実。

## 実務パターン：上位モデル枠の配分

Fable 5 のような上位モデルは**トークン単価が高く（Opus の約2倍）専用の週次枠が別建て**なので、希少資源として配分する。

- **上位モデルは「仕様が固まった・長丁場・非セキュリティ」の難タスクに集中**。ルーチンや機械的作業は Sonnet / Haiku。
- **「難段だけ上位」を実現する単位は Workflow ステージ（`agent()` の per-stage `model`）か上位固定 subagent への委譲**。skill / session を丸ごと上位モデルにすると機械段まで枠を食う。
- credential / セキュリティ隣接は Fable の safety classifier で拒否・降格が頻発するため **Opus 等のまま**。
- 保険として session に `fallbackModel:[opus,sonnet]` を置くと overload 時だけ自動退避できる（**週次枠の枯渇はカバーしない**ので、そこは使用量監視＋手動切替で担保）。

## 関連

- Dynamic Workflows でのステージ単位モデル指定: [`claude-code-dynamic-workflows.md`](claude-code-dynamic-workflows.md)
- Fable 5 の API 挙動（thinking 常時 on・refusal・データ保持要件・プロンプト調整）: [`../platform/anthropic-api.md`](../platform/anthropic-api.md)

公式:

- [Model configuration](https://code.claude.com/docs/en/model-config)（aliases / fallback model chains / automatic model fallback / effort / fast mode）
- [Subagents](https://code.claude.com/docs/en/sub-agents) / [Skills](https://code.claude.com/docs/en/skills)（frontmatter の `model` / `effort`）
- [Manage costs](https://code.claude.com/docs/en/costs)（使用量）
- [Introducing Claude Fable 5](https://platform.claude.com/docs/en/about-claude/models/introducing-claude-fable-5-and-claude-mythos-5)
