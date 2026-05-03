---
reviewed: 2026-05-04
tags: [lint, git-hook, javascript]
---

# commitlint

コミットメッセージが Conventional Commits など規約に従っているか検証する Node.js 製の Linter。`commit-msg` Git フックで実行し、規約違反のコミットをローカルで止める。`standards/conventional-commits.md` と対になるツール。

公式: [commitlint.js.org](https://commitlint.js.org/)

## インストール

```bash
pnpm add -D @commitlint/cli @commitlint/config-conventional
```

2026-05 時点の現行は v20.5 系（最新 v20.5.3 / 2026-04-30 リリース、Node 20 以上が必要）。

## 最小設定

ESM プロジェクトでは `.mjs` を推奨（後述の落とし穴参照）:

```js
// commitlint.config.mjs
export default { extends: ['@commitlint/config-conventional'] };
```

YAML 形式 `.commitlintrc.yaml`:

```yaml
extends:
  - "@commitlint/config-conventional"
```

## lefthook から呼び出す

`commit-msg` ステージで実行する:

```yaml
# lefthook.yaml
commit-msg:
  commands:
    commitlint:
      run: pnpm exec commitlint --edit {1}
```

`{1}` は `.git/COMMIT_EDITMSG` のパス。`--edit` がないとコミットメッセージを stdin から読もうとしてハングする。

husky v9 の場合:

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

## ルールの書式

```js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'subject-case': [0],
    'scope-enum': [2, 'always', ['api', 'web', 'infra']],
  },
};
```

`[level, applicable, value]`:

| 要素 | 値 | 意味 |
|---|---|---|
| level | `0` / `1` / `2` | 無効 / warning / error |
| applicable | `always` / `never` | ルールを適用する / 反転する |
| value | 任意 | ルール固有の値（長さ、許可リスト等） |

## よく使うルール

| ルール | 既定値 | 用途 |
|---|---|---|
| `type-enum` | Conventional Commits の標準 11 種 | 許可する type を制限 |
| `type-empty` | `[2, 'never']` | type 省略禁止 |
| `scope-enum` | （未設定） | scope を特定の値に限定 |
| `subject-case` | `[2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']]` | 件名の大文字使用を制限 |
| `subject-empty` | `[2, 'never']` | 件名必須 |
| `subject-full-stop` | `[2, 'never', '.']` | 件名末尾のピリオド禁止 |
| `header-max-length` | `[2, 'always', 100]` | ヘッダ行の最大長 |
| `body-max-line-length` | `[2, 'always', 100]` | body 各行の最大長 |
| `body-leading-blank` | `[1, 'always']` | body 前に空行 |
| `footer-leading-blank` | `[1, 'always']` | footer 前に空行 |

全ルール一覧は [reference/rules](https://commitlint.js.org/reference/rules.html)。

## CLI

```bash
# 単発検証（引数なしは stdin 読み取り）
echo "feat: add login" | pnpm exec commitlint

# .git/COMMIT_EDITMSG を検証（hook からの呼び出し）
pnpm exec commitlint --edit .git/COMMIT_EDITMSG

# 過去コミット範囲を検証
pnpm exec commitlint --from=origin/main --to=HEAD
```

## CI での検証

PR の全コミットを検証する例:

```yaml
# .github/workflows/commitlint.yaml
on: [pull_request]
jobs:
  commitlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v5
      - uses: actions/setup-node@v6
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec commitlint --from=${{ github.event.pull_request.base.sha }} --to=${{ github.event.pull_request.head.sha }}
```

squash merge 運用なら PR タイトル検証の方が軽い（GitHub Actions 側で実装）。

## Conventional Commits との関係

- `@commitlint/config-conventional` は [conventional-changelog](https://github.com/conventional-changelog/conventional-changelog) のルールを読み込む
- 実装上の規約詳細は `standards/conventional-commits.md` を参照
- 運用で合わせる相手: `standards/semver.md`、`tools/release-please.md`

## AI エージェントがよくやるミス

1. **`--edit` 引数を忘れる** — `lefthook` / `husky` hook で `{1}` や `$1` を渡し忘れると stdin 待ちで止まる。
2. **`.js` 設定を ESM プロジェクトに置く** — Node 24 以降、`package.json` なしの `.js` 単独設定は `Cannot use import statement` で失敗する。`.mjs` にするか `type: "module"` を明示する。
3. **`scope-enum` を厳格化しすぎて運用で解除される** — 最初は warning (`level: 1`) で導入し、定着してから error に上げる。
4. **PR タイトル側の lint と二重化** — squash merge 運用で PR タイトルを commitlint にかけるなら、個別コミットへの `commit-msg` フックは無効化してもよい（好みの範囲）。

## 参考

- [commitlint 公式ドキュメント](https://commitlint.js.org/)
- [ルール一覧](https://commitlint.js.org/reference/rules.html)
- [lefthook examples: commitlint](https://lefthook.dev/examples/commitlint/)
- [conventional-changelog リポジトリ](https://github.com/conventional-changelog/commitlint)
