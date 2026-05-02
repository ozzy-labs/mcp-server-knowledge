---
reviewed: 2026-05-03
---

# 複数リポジトリ間の設定同期

`.editorconfig` / `lefthook` / `biome.json` / `.github/workflows/` / エージェント設定 / Dev Container 等を**複数リポジトリで揃えたい**ときの設計指針。1 リポジトリ内のマルチエージェント対応は `standards/multi-agent-repo.md` を参照。

## 解きたい問題

- 各 repo に同じ設定をコピペする → 改善が伝播しない
- 中央 repo を `git submodule` する → ローカルカスタマイズが難しい・採用障壁が高い
- monorepo にまとめる → 巨大化して所有権・公開範囲・CI 時間が破綻する

「**各 repo は独立を保ちつつ、共通設定だけ同期する**」モデルが必要。

## 設計の選択肢

| アプローチ | 同期方法 | カスタマイズ | 反映タイミング |
|---|---|---|---|
| 手動コピペ | 人間が周期的にコピー | 自由 | 不定（劣化する） |
| `git submodule` | サブツリーとして埋め込み | 制限あり | `submodule update` 都度 |
| `git subtree` | スカッシュマージで取り込み | 自由 | 手動 pull |
| **中央 repo + sync スクリプト + pin リスト** | 中央 → 受信側を一方向同期、`pinned` で意図的乖離 | ファイル単位で自由 | scheduled workflow + Renovate |
| Cookiecutter / Yeoman | 初期生成のみ | 自由 | 同期できない |
| Renovate config preset | preset 拡張だけ | preset の範囲 | Renovate スケジュールに追従 |

中央 repo + sync スクリプトのアプローチが、**継続的な反映**と**ローカル裁量**の両立で最もバランスが良い。本記事ではこれを「**commons パターン**」と呼んで詳述する。

## commons パターンの構成要素

```text
[ commons リポジトリ ]
├── dist/                  ← 配布対象（同期される）
│   ├── .editorconfig
│   ├── biome.json
│   ├── lefthook-base.yaml
│   ├── .github/workflows/
│   ├── .claude/
│   ├── .gemini/
│   └── .devcontainer/
├── templates/             ← 初期化時に一度だけコピー（同期対象外）
│   ├── AGENTS.md
│   └── CLAUDE.md
├── sync.sh                ← 受信側にコピーして使うスクリプト
└── commons-sync.json      ← Renovate preset

[ 受信リポジトリ ]
├── .commons/
│   └── sync.yaml          ← 同期メタデータ
├── sync.sh                ← commons から取得済み
└── ...                    ← 同期されたファイル群
```

### `.commons/sync.yaml`（同期メタデータ）

```yaml
commit: a32c498f106b8684e2419ab7861e95e1bbef5445
synced_at: 2026-05-02T14:00:00Z
pinned:
  - CLAUDE.md
  - lefthook.yaml
  - .gitignore
```

| キー | 意味 |
|---|---|
| `commit` | 最後に同期した commons の HEAD SHA |
| `synced_at` | 同期実施時刻（ISO 8601） |
| `pinned` | **意図的に commons と乖離させているファイル**のリスト。同期時にスキップされる |

`pinned` の存在が肝。「全部上書き」ではなく「**ローカル都合で外したいものは明示的に宣言**」という運用にすると、受信側が躊躇なく同期を回せる。

### `sync.sh` のモード

| モード | 用途 |
|---|---|
| 対話モード（既定） | 差分表示 → 各ファイルで `[y/N/pin/all]` を選ぶ |
| `--yes` / `-y` | 非対話。`pinned` 以外を全て上書き |
| `--dry-run` | 適用せず差分のみ表示 |
| `--check` | 差分があれば exit 1（CI でドリフト検知） |

`pin` を選ぶと `.commons/sync.yaml` の `pinned` にファイル名が追記される。手書きで管理するより事故が少ない。

## 反映の自動化

2 経路を併用すると劣化が止まる:

### 1. 受信リポの scheduled workflow

```yaml
# .github/workflows/sync-commons.yaml
on:
  schedule: [{ cron: '0 0 * * 1' }]    # 毎週月曜
  workflow_dispatch: {}

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v6
      - run: ./sync.sh --check
        continue-on-error: true
        id: check
      - if: steps.check.outcome == 'failure'
        run: ./sync.sh --yes
      - if: steps.check.outcome == 'failure'
        uses: peter-evans/create-pull-request@v6
        with:
          branch: chore/commons-sync
          title: 'chore(commons): sync to latest'
          commit-message: 'chore(commons): sync to latest'
```

PR を作るだけで auto-merge はしない。レビュー機会を残す。

### 2. Renovate preset

```json
// commons-sync.json（commons リポジトリ側）
{
  "customManagers": [
    {
      "customType": "regex",
      "fileMatch": ["^\\.commons/sync\\.yaml$"],
      "matchStrings": ["commit:\\s+(?<currentDigest>[a-f0-9]+)"],
      "depNameTemplate": "ozzy-labs/commons",
      "datasourceTemplate": "git-refs",
      "currentValueTemplate": "main"
    }
  ]
}
```

```json
// 受信リポの renovate.json
{
  "extends": ["github>ozzy-labs/commons:commons-sync"]
}
```

Renovate が `.commons/sync.yaml` の `commit:` 行を新しい SHA に書き換える PR を作る。マージすると次回の scheduled workflow（または `workflow_dispatch`）が同期を実行する。**Renovate と workflow の責任分離**:

- Renovate: SHA 更新の意思決定（依存更新の文脈に乗る）
- workflow: 実際のファイル同期（差分が大きい場合の検証付き）

これで「週次待ち」が「数時間以内」に短縮される。

## 配布物と初期化物の分離

| 種別 | 場所 | 初回 | 継続同期 |
|---|---|---|---|
| 配布物 | `commons/dist/` | sync で取得 | sync で更新 |
| 初期化物 | `commons/templates/` | 手動コピー | **同期しない** |

`templates/` は「最初の 1 回だけ参考にしてプロジェクト固有にカスタマイズする」もの。`AGENTS.md` / `CLAUDE.md` のような**指示ファイル**が代表。これを `dist/` に入れると、せっかくのカスタマイズが上書きされる。

## 受信リポの初期化フロー

```bash
# setup-repo.sh が GitHub リポ作成 + Branch Protection 等を自動設定
gh repo create my-org/my-app --private
./setup-repo.sh my-org/my-app

# commons の初期化
mkdir .commons
echo 'commit: <main SHA>' > .commons/sync.yaml
curl -fsSL https://raw.githubusercontent.com/<org>/commons/main/sync.sh > sync.sh
chmod +x sync.sh
./sync.sh --yes

# 初期ファイルをコピー
curl -fsSL .../templates/AGENTS.md > AGENTS.md
curl -fsSL .../templates/CLAUDE.md > CLAUDE.md

git add . && git commit -m "chore: initialize from commons"
```

これを `setup-repo.sh` の中で完結させると、新規 repo を 1 コマンドで「commons 同期済み・Branch Protection 済み」にできる。

## どこで使い分けるか

| ファイル | dist にすべきか |
|---|---|
| `.editorconfig` / `biome.json` / `lefthook-base.yaml` | **dist**（全 repo で同じが望ましい） |
| `.github/workflows/` の汎用 workflow | dist |
| `lefthook.yaml`（プロジェクト固有 hook 追加） | **pin 候補**（dist の `lefthook-base.yaml` を継承する形） |
| `.gitignore` | プロジェクト固有 → pin |
| `AGENTS.md` / `CLAUDE.md` | **templates**（初期コピーのみ） |
| `package.json` / `pyproject.toml` | dist にしない（プロジェクト固有） |

迷ったら **dist に入れる + pin で逃げ道を作る**。pin が増えすぎたらその dist ファイルを廃止する材料になる。

## アンチパターン

1. **commons を submodule にする** — 受信側が `git pull` で更新を意識する必要があり、CI も submodule 対応が必要。リジェクトされる
2. **同期を auto-merge する** — レビューの機会が消える。設定ミスが全 repo に波及するリスクが大きい
3. **`pinned` を `.gitignore` のように長く持つ** — pin が増える → 同期の意義が薄れる → 廃止判断のシグナル
4. **commons に「全社の慣習」を詰め込む** — `dist/` は最小公倍数。チーム / 言語 / プロジェクト分類で必要なら sub-repo に分割する
5. **`templates/` を `dist/` に混ぜる** — 上書きされる。明確に分ける
6. **commons を public、受信側を private にして workflow がトークン不足** — fine-grained PAT または GitHub App でアクセスを設計する

## AI エージェントへの含意

- 受信リポで `.commons/sync.yaml` を見ると「どの中央 repo に追従しているか」が分かる。設定ファイルを変更するなら、まずそれが pinned に入っているか確認する
- pinned に入っていない設定ファイルを変更すると、次の同期で**上書き**される。設定変更は commons に PR を出すか、受信側で pin する
- `lefthook-base.yaml` のような **base** ファイルは継承対象。`lefthook.yaml` の `extends:` で取り込まれている前提で読む

## 関連

- [`standards/multi-agent-repo.md`](multi-agent-repo.md) — 1 リポジトリ内で複数 AI エージェントを共存させる設計（commons パターンと組み合わせて使う）
- [`tools/renovate.md`](../tools/renovate.md) — preset / customManager の詳細
- [`tools/lefthook.md`](../tools/lefthook.md) — `extends` で base 設定を継承するモデル
- [`platforms/github-actions.md`](../platforms/github-actions.md) — scheduled workflow / `peter-evans/create-pull-request`

## 参考

- [Renovate custom managers](https://docs.renovatebot.com/modules/manager/regex/)
- [peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)
- [GitHub Branch Protection / Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets)
