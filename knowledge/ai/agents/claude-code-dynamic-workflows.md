---
reviewed: 2026-06-07
tags: [ai-workflow, commercial, multi-agent]
stability: research-preview
aliases: [dynamic-workflows, ultracode]
---

# Claude Code Dynamic Workflows

Claude Code に組み込まれた **JavaScript オーケストレーションスクリプト実行ランタイム**。Claude がタスクごとに動的にスクリプトを書き、ランタイムが**数十〜数百の subagent を並列で起動**し、結果を相互検証してから 1 つの答えにまとめて返す。2026-05-28 に Claude Opus 4.8 のリリースと同時に research preview として公開された。

公式: [Anthropic blog](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code) / [Claude Code docs](https://code.claude.com/docs/en/workflows)

本機能は Claude Code の subagent / skill / agent team と**プランの保有者が違う**。subagent や skill は Claude がターン単位で次に何を spawn するか判断するが、workflow は**プランがコードに移される**ため、ループ・分岐・中間結果がスクリプト変数として保持され Claude の context window を消費しない。Claude Code 本体の機能・拡張機構は `ai/agents/claude-code.md` を参照。

## 利用可能性

- **Claude Code v2.1.154 以降**で利用可能（research preview）
- **全有料プラン対応**: Pro / Max / Team / Enterprise。Pro のみ `/config` の Dynamic workflows 行で明示的に有効化が必要
- **Anthropic API / Amazon Bedrock / Vertex AI / Microsoft Foundry** からも利用可能
- 提供面: Claude Code CLI / Desktop / VS Code 拡張 / `claude -p`（非対話モード）/ Agent SDK

## 起動方法

| 方法 | 用途 |
|---|---|
| `ultracode` キーワードをプロンプトに含める | この 1 ターンだけ workflow として実行（自然言語の "use a workflow" / "run a workflow" でも同じ opt-in） |
| `/effort ultracode` | セッション全体で `xhigh` 推論 + 自動 workflow オーケストレーションを有効化。Claude が「この task は workflow 向き」と判断したら自動で組む |
| `/deep-research <question>` | 同梱 workflow。複数の角度から web 検索 → cross-check → 引用付きレポート |
| `/<saved-workflow>` | `/workflows` ビューで `s` キーを押して保存した命令 |

> **メモ:** v2.1.160 より前はキーワードが `workflow` だったが、現在は `ultracode` に統一されている。自然言語で「workflow で」と書いても受理される。

## 動作モデル

1. **プラン生成**: ユーザープロンプトを受けて Claude（上位モデル）が JS スクリプトを書く
2. **承認ゲート**: 初回起動時にスクリプトと phase 一覧を表示し、`Yes` / `View raw script` / `No` を選ばせる（Auto モードは初回のみ確認）
3. **隔離環境で実行**: スクリプトは会話とは別ランタイムで走る。Claude のコンテキストには最終結果だけが返る
4. **subagent 起動**: スクリプト中の `agent()` 呼び出しが subagent を spawn。各 subagent は `acceptEdits` モード固定で、セッションの tool allowlist を継承
5. **進捗トラッキング**: ランタイムが各 agent の result を逐次保存し、中断後の再開（resume）と監視（`/workflows`）を可能にする

## スクリプト構造

スクリプトは以下のプリミティブで構成される。

```js
export const meta = {
  name: 'review-changes',
  description: 'Review the current diff and verify each finding',
  phases: [{ title: 'Review' }, { title: 'Verify' }],
}

// dimension ごとに 1 agent でレビュー → 各 finding を adversarial verify
const results = await pipeline(
  DIMENSIONS,
  d => agent(d.prompt, { phase: 'Review', schema: FINDINGS_SCHEMA }),
  review => parallel(review.findings.map(f => () =>
    agent(`Verify: ${f.title}`, { phase: 'Verify', schema: VERDICT_SCHEMA })
      .then(v => ({ ...f, verdict: v }))
  ))
)
return { confirmed: results.flat().filter(f => f.verdict?.isReal) }
```

主要プリミティブ:

| プリミティブ | 役割 |
|---|---|
| `meta` | 必須の pure literal frontmatter。`name` / `description` / `phases` を宣言 |
| `agent(prompt, opts?)` | subagent を 1 体起動。`schema` を渡すと結果を Zod-like validation した object で返す。`isolation: 'worktree'` で git worktree 隔離（並列で同じファイルを触るときだけ使う） |
| `parallel(thunks)` | 全 thunk を並列実行し**バリア**で全完了を待つ。本当に全結果が必要なときだけ |
| `pipeline(items, ...stages)` | 各 item が独立に全 stage を流れる。stage 間にバリアがない。**デフォルトはこちら** |
| `phase(title)` | 後続の `agent()` を 1 つのグループとして進捗表示にまとめる |
| `log(message)` | ユーザーに 1 行進捗を出す |
| `args` | 保存済み workflow に渡された入力（コマンドラインの `args` パラメータ） |
| `budget` | トークン目標。`budget.remaining() > 50_000` で動的にループ深度を決める |
| `workflow(name, args?)` | 別 workflow を sub-step として呼ぶ（1 段ネストまで） |

## 制約（ランタイムが強制）

| 制約 | 理由 |
|---|---|
| ミッドラン中のユーザー入力不可（agent permission prompt のみ可） | stage 間で承認が要るなら stage ごとに workflow を分ける |
| filesystem / shell に**スクリプト**からは直接触れない | I/O は agent が担当、スクリプトは orchestration のみ |
| concurrent agents は最大 16（CPU コア数が少ないマシンでは更に減る） | ローカルリソースを保護 |
| 1 run あたり**最大 1000 agent** | 暴走ループのバックストップ |

## 同梱の `/deep-research`

WebSearch ツールを使う built-in workflow。質問を複数角度に分解 → 並列に web 検索 → fetch → 主張ごとに adversarial vote → 棄却されなかった主張だけを引用付きレポートに合成する。Pro でも research preview として利用可能（要 toggle）。

## 進捗監視・運用

- `/workflows` でランニング / 完了一覧。矢印キーで選択、`Enter` で詳細
- `p` で pause / resume、`x` で stop、`r` で個別 agent restart、`s` で保存

スクリプト本体は `~/.claude/projects/<session>/` 配下のファイルに書き出され、編集して再実行すれば**変更されていない `agent()` 呼び出しはキャッシュから即座に復元**される（同一セッション内のみ）。

## 保存と再利用

`/workflows` から `s` でスクリプトを保存:

- `.claude/workflows/` — リポジトリ共有
- `~/.claude/workflows/` — 個人用、全プロジェクトから使える

保存後は `/<name>` で他のスラッシュコマンドと同列に呼べる。`args` で構造化データ（issue 番号リスト等）を渡せる。

## 無効化

| 方法 | スコープ |
|---|---|
| `/config` の Dynamic workflows トグル | このユーザー（永続） |
| `~/.claude/settings.json` に `"disableWorkflows": true` | このユーザー（永続） |
| `CLAUDE_CODE_DISABLE_WORKFLOWS=1` | 環境変数の設定先 |
| managed settings の `"disableWorkflows": true` | 組織全体 |
| [Claude Code admin settings](https://claude.ai/admin-settings/claude-code) | 組織全体 |

無効化すると `/deep-research` も `ultracode` も使えなくなり、`/effort` メニューから `ultracode` が消える。

## 他の Claude Code 拡張との比較

| | Subagent | Skill | Agent team | Dynamic Workflow |
|---|---|---|---|---|
| 何か | Claude が spawn する worker | Claude が従う instructions | リード agent が peer session を監督 | ランタイムが実行する script |
| 次に何を実行するか決める主体 | Claude（ターン単位） | Claude（プロンプト追従） | リード agent（ターン単位） | スクリプト |
| 中間結果の置き場 | Claude の context window | Claude の context window | 共有 task list | スクリプト変数 |
| 再利用単位 | worker 定義 | instructions | team 定義 | orchestration 自体 |
| スケール | 1 ターンに数体 | 同上 | 数体の長寿命 peer | 1 run に**数十〜数百**体 |
| 中断 | ターンが再開 | ターンが再開 | teammate は走り続ける | 同一セッション内で resumable |

「同じスクリプトを毎回再実行したい」「数百 agent 並列で広く調べる」「stage 間 adversarial verification を入れたい」場合は workflow。「1 ターン中に専門タスクを 1〜2 件委譲したい」なら subagent。

## 実例

Jarred Sumner 氏は dynamic workflows で **Bun（Zig 実装）を Rust に丸ごと port** した。約 **750,000 行**の Rust、**初コミットから merge まで 11 日**、既存テストの **99.8% pass**。

工程は 1 段 workflow ではなく、複数の workflow をパイプラインで連結:

1. **Lifetime mapping** — Zig の各 struct field に対し Rust lifetime を推定する workflow を 1 本
2. **Per-file behavior port** — 並列 agent が振る舞い同等の Rust を書き、ファイルごとに 2 名の reviewer が cross-check
3. **Fix loops** — ビルドが clean になるまで build error から自動で fix を生成するループ
4. **Overnight optimization** — 夜間の workflow でホットパスの最適化機会を抽出

その他に社内で実証された用途:

- コードベース全体の bug sweep（dead code 検出含む。静的解析では見つからないものが上がる）
- profiler-guided 最適化監査
- security audit（認証チェック・unsafe パターン）
- 大規模 migration（フレームワーク差し替え、API 廃止対応、数千ファイル横断の言語 port）

## コスト

1 run で**通常セッションよりはるかに多くのトークンを消費**する。プラン枠とレート制限に同じくカウントされる。

実務的な抑え方:

1. **小さなスライスで試す**: 全リポではなく 1 ディレクトリ、広い質問ではなく狭い質問から
2. **`/workflows` で agent ごとの token 消費を監視**し、許容を超えたら `x` で stop（完了済みの仕事は失われない）
3. **モデル選択**: 全 agent はセッションのモデルを継承する。`/model` を確認し、軽い stage は Haiku に振るようスクリプト中で明示
4. **agent cap**（1000 / 16 concurrent）が暴走スクリプトの上限になる

## AI エージェントがよくやるミス

1. **「workflow」キーワードでトリガーしようとする** — v2.1.160 で `ultracode` に変わった。古いブログを参考にしないこと
2. **`parallel()` でバリアを多用する** — 各 stage で全 agent を待つと「最速の agent が遊ぶ時間」が膨らむ。デフォルトは `pipeline()` で stage 間バリアなしが正解
3. **小さい task でも workflow を組む** — トークンが嵩む。「1 ターンの subagent 委譲で足りる」場合は workflow を使わない。`ultracode` を切っておく
4. **スクリプトを目視せず承認** — 初回起動時の `View raw script` で確認するべき。Claude が想定外の adversarial loop を組んでいることがある
5. **filesystem 操作をスクリプトに書こうとする** — スクリプトは orchestration 専用。`fs` モジュールは使えない。I/O は agent 経由
6. **`Math.random()` / `Date.now()` を使う** — resume 時の決定性を壊すためランタイムが throw する。乱数性は agent prompt や index で表現
7. **`ultracode` を on にしたまま日常コーディング** — 全タスクが workflow 化されてトークンを消費し続ける。ルーチンに戻ったら `/effort high` に下げる
8. **1000 agent 上限を信頼してループを無制御に書く** — cap は安全網。本来はスクリプト側で `budget.remaining()` を見て収束させる
9. **agent の tool 権限を忘れる** — workflow 内 subagent はセッションの allowlist を継承するが `acceptEdits` 固定。長時間 run で permission prompt が出ないよう必要なコマンドは事前 allowlist に入れる

## 参考

- [Introducing dynamic workflows in Claude Code（Anthropic）](https://claude.com/blog/introducing-dynamic-workflows-in-claude-code)
- [Claude Code Docs: Orchestrate subagents at scale with dynamic workflows](https://code.claude.com/docs/en/workflows)
- [Introducing Claude Opus 4.8（リリース告知）](https://www.anthropic.com/news/claude-opus-4-8)
- [InfoQ: Claude Code Adds Dynamic Workflows for Parallel Agent Coordination](https://www.infoq.com/news/2026/06/dynamic-workflows-claude-code/)
- 関連: `ai/agents/claude-code.md` / `ai/agents/claude-code-routines.md` / `ai/practice/multi-agent-coordination.md` / `ai/practice/agentic-workflow-patterns.md` / `ai/platform/agent-extensions.md`
