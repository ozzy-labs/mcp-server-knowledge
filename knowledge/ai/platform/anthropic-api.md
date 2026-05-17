---
reviewed: 2026-05-17
tags: [library, commercial, cloud-hosted, ai-workflow]
aliases: [claude-api]
---

# Anthropic API (Claude API)

Anthropic が提供する Claude モデルの API。本記事は API 本体（SDK 経由のアプリ実装）を対象。Claude Code CLI は別記事 `ai/agents/claude-code.md` を参照。

公式: [platform.claude.com/docs](https://platform.claude.com/docs)

## SDK インストールと認証

```bash
# Python
pip install anthropic

# TypeScript / JavaScript
npm install @anthropic-ai/sdk
```

認証は環境変数 `ANTHROPIC_API_KEY`（または SDK コンストラクタ `apiKey` 引数）。SDK が `x-api-key` / `anthropic-version` / `content-type` ヘッダを自動付与する。

### 最小 Messages リクエスト

```python
import anthropic

client = anthropic.Anthropic()  # env var から読む
message = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude"}],
)
print(message.content[0].text)
```

## 現行モデル（2026-05 時点）

| モデル | API ID | コンテキスト | 最大出力 | 位置付け | 価格 (入力/出力 per 1M) |
|---|---|---|---|---|---|
| **Opus 4.7** | `claude-opus-4-7` | 1M | 128K | 最高精度。複雑推論・agentic coding。Extended thinking 非対応（adaptive thinking のみ） | $5 / $25 |
| **Sonnet 4.6** | `claude-sonnet-4-6` | 1M | 64K | 速度と知性のバランス（デフォルト推奨）。extended/adaptive 両対応 | $3 / $15 |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 200K | 64K | 最速・最安。near-frontier 知性。extended thinking 対応 | $1 / $5 |

Opus 4.7 は 2026-04-16 リリース。1M context は **2026-03-13 に Opus 4.6 / Sonnet 4.6 で GA**（ヘッダ不要、標準価格）。旧モデル向け beta ヘッダ `context-1m-2025-08-07` は 2026-04-30 に Sonnet 4.5 / Sonnet 4 から廃止され効果なし。`claude-opus` / `claude-sonnet` のエイリアスは各ティアの最新を指す（プロダクション用途ではピン留め推奨）。Sonnet 4 / Opus 4 は 2026-06-15 retire 予定。

## プロンプトキャッシング — 最重要の最適化

静的なシステムプロンプト・ドキュメント・ツール定義にキャッシュブレークポイントを置くと、次以降のリクエストで**キャッシュヒット分は入力単価の 10%** になる。ITPM レートリミット消費も大幅減。

**自動キャッシング（2026-02-19 launch）**: `cache_control` を 1 箇所付けるだけで、会話伸長に応じて自動でキャッシュポイントが前進する。手動 breakpoint 管理は不要。block-level cache control と併用可。

### 配置

```python
message = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    system=[
        {"type": "text", "text": "You are a helpful assistant."},
        {
            "type": "text",
            "text": "<大きなドキュメント>",
            "cache_control": {"type": "ephemeral"},
        },
    ],
    messages=[{"role": "user", "content": "このドキュメントに対する質問..."}],
)
```

- **TTL**: デフォルト 5 分 / 拡張 1 時間（**2025-08-13 に GA、ヘッダ不要**。旧 beta ヘッダ `extended-cache-ttl-2025-04-11` は廃止）
- **ブレークポイント上限**: 1 リクエストあたり最大 4 個
- **無効化**: ブレークポイントより前のコンテンツが変わるとそれ以降のキャッシュは失効する
- **対象ブロック**: `system` / `messages.content` のテキスト・画像・PDF、ツール定義

### 効果の目安

キャッシュヒット率 80% で、実効スループット約 5x（2M ITPM → 10M ITPM 相当）。レイテンシも 15〜20% 改善。長いシステムプロンプトを採用するエージェント・RAG では必須の最適化。

## Tool Use

```python
tools = [
    {
        "name": "search",
        "description": "Search the web.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    }
]
```

### 呼び出しループ

1. ユーザーメッセージ → モデルが `stop_reason: "tool_use"` で `tool_use` ブロックを返す
2. `tool_use.id` と `input` を読み、ツールを実行
3. 次リクエストに `{"role": "user", "content": [{"type": "tool_result", "tool_use_id": "<id>", "content": "<result>"}]}` を追加
4. `stop_reason` が `end_turn` になるまで反復

### `tool_choice`

| 値 | 挙動 |
|---|---|
| `"auto"`（デフォルト） | モデルが使うかどうか判断 |
| `"any"` | 何らかのツールを必ず呼ぶ |
| `{"type": "tool", "name": "<name>"}` | 特定ツールを強制 |

### 落とし穴

- `tool_result` の `tool_use_id` が厳密に一致していないと 400 エラー
- 旧モデルはキャッシュトークンも ITPM に計上されていた。料金表の注釈を確認
- `stop_reason: "tool_use"` を無視して応答を切ると無限ループ・破綻の原因

## Extended / Adaptive Thinking

Opus 4.6 以降は **adaptive thinking** が推奨。Opus 4.7 では `thinking: {type: "enabled", budget_tokens: N}` を渡すと **400 エラー** が返る（deprecated ではなくリジェクト）。Opus 4.7 は extended thinking 自体に非対応で adaptive のみサポート。

Opus 4.7 では `temperature` / `top_p` / `top_k` のサポート挙動が以前のモデルと異なる可能性がある。adaptive thinking 利用時はこれらをデフォルトのまま送るのが安全（最新挙動は API リファレンスを参照）。

```python
# Opus 4.7: adaptive thinking + effort 指定
message = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=16000,
    thinking={"type": "adaptive"},
    effort="medium",  # low / medium / high
    messages=[{"role": "user", "content": "複雑な問題..."}],
)
```

`effort` パラメータは `budget_tokens` の代替で、`thinking` と**並列のトップレベルパラメータ**として渡す（`output_config` 配下ではない）。公式が現行サポートする値は `low` / `medium` / `high` の 3 段階。

Opus 4.7 では **`thinking.display` のデフォルトが `"omitted"`** に変更（Opus 4.6 はデフォルト `"summarized"`）。ストリーミング中に thinking 内容を表示したい場合は明示的に `"display": "summarized"` を指定すること。

- **用途**: 多段推論、数学、デバッグ、深い分析
- **コスト**: thinking トークンは通常入力の約 3x 単価
- **キャッシングと併用可**: thinking はキャッシュと独立。固定システムプロンプトをキャッシュしつつ新クエリで thinking を使える
- **`thinking.display: "omitted"`** (2026-03-16): 応答から thinking 内容を省略しレスポンスを高速化（`signature` は保持）。**Opus 4.7 ではこれがデフォルト**。Opus 4.6 のデフォルトは `"summarized"` だった

## Message Batches API

非同期バッチ処理。**50% 割引** + 24 時間以内 SLA（公式説明では **1 時間未満で完了することが多い**）。1 バッチ 100,000 リクエスト上限。

```python
batch = client.messages.batches.create(
    requests=[
        {
            "custom_id": "req-1",
            "params": {
                "model": "claude-opus-4-7",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": "..."}],
            },
        },
    ],
)
```

結果取得は `client.messages.batches.retrieve(batch.id)` のポーリング、または webhook。結果順序は非保証なので `custom_id` で紐付ける。夜間評価・ログ要約・大量生成に最適。

## レートリミット

### レスポンスヘッダ

| ヘッダ | 意味 |
|---|---|
| `anthropic-ratelimit-requests-remaining` | 現ウィンドウの残リクエスト数 |
| `anthropic-ratelimit-input-tokens-remaining` | 未キャッシュ入力トークン残（キャッシュヒットは消費しない） |
| `anthropic-ratelimit-output-tokens-remaining` | 出力トークン残 |
| `retry-after` | 429 時の待機秒数 |

### 対応

- 429 → `retry-after` を尊重 + 指数バックオフ（1s, 2s, 4s, ...）
- ITPM 逼迫 → キャッシュ率を上げる（Usage ページで hit rate を確認、目標 60%+）
- Tier 1 デフォルト: 50 RPM、30K ITPM (Opus/Sonnet)、50K ITPM (Haiku)。利用実績で自動昇格

## Files API（beta）

```python
file = client.beta.files.upload(
    file=("doc.pdf", open("doc.pdf", "rb")),
)

message = client.beta.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    messages=[{
        "role": "user",
        "content": [
            {"type": "document", "source": {"type": "file", "file_id": file.id}},
            {"type": "text", "text": "要約して"},
        ],
    }],
)
```

beta ヘッダ `files-api-2025-04-14` が必要。レスポンスに `citation` ブロックが含まれ、回答中のスニペットをファイル内座標に紐付けできる（リサーチ・法務用途で有用）。

## エラーコード

| コード | type | 運用対応 |
|---|---|---|
| 400 | `invalid_request_error` | ペイロード修正（リトライ不可） |
| 401 | `authentication_error` | API キー確認 |
| 402 | `billing_error` | Console の課金タブで支払い確認 |
| 403 | `permission_error` | API キーに対象リソースの権限がない |
| 404 | `not_found_error` | リソースが存在しない |
| 413 | `request_too_large` | リクエストサイズ上限超過（Messages 32MB / Batch 256MB / Files 500MB） |
| 429 | `rate_limit_error` | `retry-after` + バックオフ。持続するならティア昇格 |
| 500 | `api_error` | 一時障害。指数バックオフでリトライ |
| 504 | `timeout_error` | 10 分超過。ストリーミングまたは Batch API に切り替え |
| 529 | `overloaded_error` | 一時的な過負荷。バックオフ（稀） |

すべて JSON で `error.type` / `error.message` / `request_id` を返す。`request_id` はサポート問い合わせに必須。

## コスト最適化チェックリスト

1. **プロンプトキャッシング** — システムプロンプト・固定ドキュメント・ツール定義を必ずキャッシュ（90% 削減）
2. **Message Batches API** — 非リアルタイム用途は batch へ（50% 割引）
3. **モデル選定** — Haiku でよいタスクに Opus を使わない。Sonnet をデフォルトにして必要時のみ Opus
4. **Thinking バジェット** — 必要なときだけ有効。1K〜5K を起点に調整
5. **システムプロンプト短縮** — 毎リクエスト反復される。静的部分は cache に逃がしてインライン system から除去

補助: Usage ページでキャッシュヒット率を監視。プロダクションでは 60%+ を目標に。
