---
reviewed: 2026-05-05
tags: [cli]
---

# git submodule

`git submodule` は別の Git リポジトリを特定コミットに固定して取り込むサブコマンド。スーパープロジェクトには「サブモジュールがどのコミットを指すか」だけが記録され、依存リポジトリの実体は別管理になる。

公式: [git-scm.com/docs/git-submodule](https://git-scm.com/docs/git-submodule)

## いつ使うか・使わないか

向く:

- ベンダーした C/C++ ライブラリのソース取り込み
- monorepo 化したくない複数チームが触る共通コード
- 特定コミットにピン留めして再現性を担保したい依存

向かない（代替を検討）:

- パッケージマネージャ（npm, pnpm, pip, go modules, cargo 等）が使える依存 → 普通にパッケージ管理する
- 「常に最新を取り込みたい」だけのケース → subtree merge やパッケージで代替
- バイナリやドキュメント素材 → Git LFS や別配信

## 仕組み

- スーパープロジェクトの `.gitmodules`（追跡対象）に `path` と `url` を記録
- `.git/config` の `submodule.<name>.url` に実際の clone 元 URL を保持
- サブモジュール側の `.git` は `.git/modules/<name>/` に集約され、サブモジュールディレクトリ内の `.git` は gitfile（テキスト）でそこを指す
- スーパープロジェクトのコミットには「どのサブモジュールがどの SHA を指すか」が gitlink として記録される

```text
super/
├── .gitmodules                   追跡される
├── .git/
│   ├── config                    submodule.<name>.url
│   └── modules/
│       └── lib-foo/              実体の .git 配下
└── lib-foo/
    └── .git                      gitfile → super/.git/modules/lib-foo
```

## 主要コマンド

```bash
# clone 時にサブモジュールも取得
git clone --recurse-submodules <url>

# 既存 clone でサブモジュールを後追い取得
git submodule update --init --recursive

# サブモジュール追加
git submodule add <repo-url> <path>
git submodule add -b main <repo-url> libs/foo

# 各サブモジュールを記録された SHA に同期
git submodule update --recursive

# 追跡ブランチの最新を取り込む
git submodule update --remote --recursive

# サブモジュールごとにコマンド実行
git submodule foreach 'git fetch --tags'

# 状態確認
git submodule status --recursive

# URL の変更（.gitmodules 編集後）
git submodule sync --recursive

# 1 つだけ無効化（作業ツリーから外す）
git submodule deinit -f libs/foo

# 完全削除（後述）
```

## サブコマンド一覧

| サブコマンド | 用途 | 主なオプション |
|---|---|---|
| `add` | サブモジュール追加 | `-b <branch>` / `--name <name>` / `--depth <n>` / `--force` |
| `init` | `.gitmodules` から `.git/config` に登録 | （主要オプションなし） |
| `deinit` | サブモジュールを未登録に戻す（作業ツリー削除） | `-f` / `--all` |
| `update` | 記録 SHA または追跡ブランチに同期 | `--init` / `--remote` / `--recursive` / `--checkout`/`--rebase`/`--merge` / `--depth` / `-j <n>` |
| `status` | 状態表示 | `--cached`（記録 SHA） / `--recursive` |
| `sync` | URL を `.gitmodules` から `.git/config` に反映 | `--recursive` |
| `foreach` | 各サブモジュールでコマンド実行 | `--recursive` |
| `set-branch` | 追跡ブランチを設定 | `-b <branch>` / `-d`（デフォルトに戻す） |
| `set-url` | URL を変更 | `<path> <newurl>` |
| `summary` | スーパープロジェクトと比較した変更要約 | `--cached` / `--files` |
| `absorbgitdirs` | サブモジュール内の `.git` を `.git/modules/` に移動 | （主要オプションなし） |

## 設定

### `.gitmodules`（コミットされる）

```ini
[submodule "libs/foo"]
    path = libs/foo
    url = https://github.com/example/foo.git
    branch = main
    shallow = true
    fetchRecurseSubmodules = on-demand
    ignore = dirty
```

### `.git/config`（ローカルのみ）

| key | 効果 |
|---|---|
| `submodule.<name>.url` | 実 URL（HTTPS/SSH 切り替えに使う） |
| `submodule.<name>.branch` | `update --remote` で追従するブランチ |
| `submodule.<name>.update` | `checkout`（既定） / `rebase` / `merge` / `!cmd` |
| `submodule.<name>.shallow` | 浅い clone を使う |
| `submodule.<name>.ignore` | `none` / `untracked` / `dirty` / `all`。`status` / `diff` での扱い |
| `submodule.recurse` | `true` で `pull` / `checkout` / `push` 等が自動再帰 |
| `submodule.fetchJobs` | `update` の並列数（既定 1） |
| `submodule.active` | アクティブ判定の glob（`pathspec` 形式） |

```bash
# pull / checkout が自動でサブモジュールも追従するように
git config --global submodule.recurse true

# 並列 clone を高速化
git config --global submodule.fetchJobs 8
```

## 典型ワークフロー

### 追加してコミット

```bash
git submodule add https://github.com/example/foo.git libs/foo
git commit -m "Add foo submodule"
# .gitmodules と libs/foo の gitlink がコミットされる
```

### 既存 clone をサブモジュール込みでセットアップ

```bash
git clone <super-url>
cd <super>
git submodule update --init --recursive --jobs 8
```

### サブモジュールを最新ブランチに更新してスーパー側に反映

```bash
git submodule update --remote --recursive
git add libs/foo
git commit -m "Bump foo to latest main"
```

### サブモジュール内で開発する

```bash
cd libs/foo
git checkout main          # detached HEAD から脱出
# 編集・コミット・push
cd -
git add libs/foo
git commit -m "Update foo pointer"
```

### URL を SSH に切り替え

```bash
# .gitmodules を編集した後
git submodule sync --recursive
```

### 完全削除

```bash
git submodule deinit -f libs/foo
git rm libs/foo                       # .gitmodules も自動更新
rm -rf .git/modules/libs/foo
git commit -m "Remove foo submodule"
```

## AI エージェントがよくやるミス

1. **`git clone` だけで済ませる** — サブモジュールは空のまま。`--recurse-submodules` を付けるか、後で `git submodule update --init --recursive` を実行する
2. **サブモジュール内で commit したのにスーパー側で commit しない** — gitlink が更新されないので他人の clone で旧 SHA に戻る。サブモジュール push 後に `git add <path> && git commit` を忘れない
3. **detached HEAD のまま編集してコミットを失う** — `update` 後はデフォルトで detached HEAD。ブランチに `checkout` してから編集する
4. **`git pull` で勝手にサブモジュールが進むと思っている** — 既定では進まない。`submodule.recurse=true` を設定するか `git submodule update --recursive` を明示的に呼ぶ
5. **`rm -rf libs/foo` で削除する** — `.gitmodules` / `.git/config` / `.git/modules/` に残骸が残る。`deinit` → `git rm` → `.git/modules/<path>` の削除が正しい順序
6. **CI で `--recursive` を忘れる** — ネストしたサブモジュールが取得されずビルド失敗。GitHub Actions なら `actions/checkout@v5` の `submodules: recursive` を指定する
7. **URL 変更を `.gitmodules` だけで済ませる** — clone 済み環境では `.git/config` の URL は変わらない。`git submodule sync` を実行する

## トラブルシュート

### `fatal: No url found for submodule path '<path>' in .gitmodules`

`.gitmodules` がコミットされていない、または当該エントリがない。スーパー側で `git submodule add` をやり直すか、`.gitmodules` を整備して `git submodule sync && git submodule update --init`。

### サブモジュールが detached HEAD のまま

```bash
cd libs/foo
git checkout main
```

または `submodule.<name>.update = rebase`/`merge` を設定して、`update --remote` がブランチ上で fast-forward / rebase するようにする。

### CI で「dirty submodule」エラー

`submodule.<name>.ignore = dirty`（コミットされていない変更を無視）または `untracked` を `.gitmodules` に設定する。CI 用に `git config -f .gitmodules submodule.<name>.ignore dirty`。

### サブモジュールの `.git` が肥大している / 移植したい

```bash
git submodule absorbgitdirs
```

サブモジュール側の `.git` ディレクトリをスーパーの `.git/modules/` に集約する。

## サブモジュールの代替

| シナリオ | 代替 |
|---|---|
| 言語標準のパッケージ管理が使える | npm / pnpm / pip / go mod / cargo |
| 「最新を常に取り込む」 | git subtree（履歴も統合） |
| バイナリ・大容量ファイル | Git LFS |
| 同一組織のコード共有 | monorepo（pnpm workspace, turborepo, nx 等） |

## 参考

- [git-submodule - Git Documentation](https://git-scm.com/docs/git-submodule)
- [gitsubmodules - Git Documentation](https://git-scm.com/docs/gitsubmodules)
