---
reviewed: 2026-05-05
tags: [cli]
---

# git worktree

`git worktree` は単一のリポジトリに対して複数の作業ディレクトリを同時にチェックアウトできる Git サブコマンド。Git 2.5 で導入。ブランチを切り替えずに並行作業ができ、`stash` や clone を増やさずに済む。

公式: [git-scm.com/docs/git-worktree](https://git-scm.com/docs/git-worktree)

## いつ使うか

- レビュー対象の PR ブランチを別ディレクトリで開き、メイン作業を中断しない
- feature 開発中に release ブランチで hotfix を当てる
- AI エージェント（Claude Code, Codex CLI 等）の並列実行で各セッションに独立した作業ツリーを与える
- ビルド成果物が大きく、ブランチ切り替えで再ビルドが必要なプロジェクトでの切替コスト削減

## 仕組み

- メインの作業ツリーは通常通り `.git/` ディレクトリを持つ
- `git worktree add` で作った *linked worktree* は `.git` という**ファイル**（gitfile）を持ち、本体の `.git/worktrees/<name>/` を指す
- HEAD・index・`HEAD` 由来のブランチは worktree ごとに独立
- オブジェクトデータベース（`.git/objects/`）・refs・hooks・config はメインリポジトリと共有

```text
repo/                main worktree
├── .git/            実体
│   └── worktrees/
│       ├── feat-x/
│       └── review/
└── src/

../feat-x/           linked worktree
├── .git             gitfile → repo/.git/worktrees/feat-x
└── src/
```

## 主要コマンド

```bash
# 既存ブランチを別ディレクトリでチェックアウト
git worktree add ../review feat/login

# 新ブランチを切って worktree を作成
git worktree add -b feat/parser ../parser main

# detached HEAD で（同じブランチを別場所で見たいとき）
git worktree add --detach ../inspect HEAD

# 一覧
git worktree list                # 人間向け
git worktree list --porcelain    # スクリプト向け

# 削除（作業ツリーと .git/worktrees/<name>/ の両方を消す）
git worktree remove ../review

# クリーンでない worktree も強制削除
git worktree remove --force ../review

# ディレクトリだけ手動削除した後の掃除
git worktree prune

# 移動・ロック・修復
git worktree move ../old ../new
git worktree lock --reason "WIP rebase" ../feat-x
git worktree unlock ../feat-x
git worktree repair                  # gitfile と admin entry の整合を回復
```

## サブコマンドのオプション

| サブコマンド | 主なオプション |
|---|---|
| `add` | `-b <new-branch>` / `-B <new-branch>`（強制再作成） / `--detach` / `--orphan` / `--checkout` / `--no-checkout` / `--lock` / `--guess-remote` / `-f` |
| `list` | `--porcelain` / `-z` / `-v` |
| `remove` | `-f`（dirty な worktree を消す） |
| `lock` | `--reason <text>` |
| `move` | `-f`（locked を移動するときは `-f -f`） |
| `prune` | `--dry-run` / `--expire <time>` / `-v` |
| `repair` | `<path>...`（移動・コピー後の整合回復） |

## 設定

| key | 効果 |
|---|---|
| `worktree.guessRemote` | `add <path> <name>` で `<name>` 同名のリモート追跡ブランチがあれば自動でそこから分岐 |
| `worktree.useRelativePaths` | gitfile と admin entry を相対パスで保存。リポ全体を移動・コピーしても壊れにくい（新しめの Git が必要） |

```bash
git config --global worktree.guessRemote true
```

## 制約

- **同じブランチを複数の worktree で同時にチェックアウトできない**。`-f` で突破できるが、両側のコミットが衝突するので推奨しない。代わりに片方を `--detach` で開く
- submodule は worktree ごとに独立して clone されない（共有される）
- `.git/hooks/` は全 worktree で共有
- bare リポジトリ上では worktree が「メインの作業ツリー」相当として振る舞う

## 典型ワークフロー

### PR レビュー

```bash
git worktree add ../review-pr-123 origin/feat/login
cd ../review-pr-123
pnpm install && pnpm run dev
# 確認後
cd -
git worktree remove ../review-pr-123
```

### Hotfix を別 worktree で

```bash
git worktree add -b hotfix/crash ../hotfix origin/release/2.5
cd ../hotfix
# 修正・push・PR
```

### AI エージェントの並列実行

複数のエージェント（Claude Code Routines, GitHub Spec Kit ワーカー等）を別ブランチで同時に走らせる際、衝突しない sandbox として使う。

```bash
git worktree add ../agent-a -b agent/task-a main
git worktree add ../agent-b -b agent/task-b main
# 各 worktree に CLAUDE.md / AGENTS.md を共有しつつ、
# index と HEAD は独立しているのでコミット競合が起きない
```

## AI エージェントがよくやるミス

1. **`rm -rf` で worktree を消す** — 作業ディレクトリは消えても `.git/worktrees/<name>/` の admin entry が残る。必ず `git worktree remove`、もしくは消した後に `git worktree prune` を実行する
2. **同じブランチを 2 か所でチェックアウトしようとして失敗** — Git は禁止する。別ブランチを切るか、片方を `--detach` で開く
3. **worktree 内で `pwd` を信じて `git -C .` する** — 大半のコマンドは linked worktree でも問題なく動くが、`.git` がファイル（ディレクトリではない）であることを前提にしないスクリプトが壊れる
4. **`git worktree add` の引数順を間違える** — 形式は `add [<options>] <path> [<commit-ish>]`。ブランチ名を `<path>` の位置に渡してしまうと、その名前のディレクトリが掘られる
5. **worktree を移動した後に `repair` を忘れる** — `mv` で動かすと gitfile の絶対パスが壊れる。`git worktree move` を使うか、移動後に `git worktree repair` を実行する
6. **共有 hooks の挙動を見落とす** — pre-commit など hook が走るリポジトリで複数 worktree を並列に使う場合、`gitleaks` 等が同じ `.git/hooks/` を参照する点を意識する

## トラブルシュート

### `fatal: '<path>' already exists`

`add` の `<path>` が空でないと作れない。別パスを使うか、不要なら削除する。

### `fatal: '<branch>' is already checked out at '<path>'`

別の worktree でチェックアウト中。当該 worktree を `remove` するか、新しいブランチを切る。

### `worktree list` に幽霊エントリが残る

ディレクトリだけ消した場合に発生:

```bash
git worktree prune --dry-run     # 何が消えるか確認
git worktree prune
```

### worktree を別ホスト・別パスにコピーした後に動かない

```bash
git worktree repair
```

または最初から `git config --global worktree.useRelativePaths true` を有効にしておく。

## 参考

- [git-worktree - Git Documentation](https://git-scm.com/docs/git-worktree)
- [Git 2.5 Release Notes](https://github.com/git/git/blob/master/Documentation/RelNotes/2.5.0.txt)
