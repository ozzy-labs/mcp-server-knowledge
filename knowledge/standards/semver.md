# Semantic Versioning (SemVer)

`MAJOR.MINOR.PATCH` の 3 要素でバージョンを表す公開 API 契約。Conventional Commits とセットで、リリース自動化の基盤になる。

公式: [semver.org](https://semver.org/lang/ja/)

## 基本フォーマット

```text
1.4.2
│ │ └─ PATCH: 後方互換のバグ修正
│ └─── MINOR: 後方互換の機能追加
└───── MAJOR: 後方互換を破る変更
```

### 追加要素

```text
1.4.2-beta.3+20260418.abcdef
          │         │
          │         └─ ビルドメタデータ（順序比較に使わない）
          └─── プレリリース識別子（beta, rc 等）
```

| 範囲 | 順序 |
|---|---|
| プレリリース付き | `1.4.2-alpha` < `1.4.2-alpha.1` < `1.4.2-beta` < `1.4.2` |
| ビルドメタ | 順序比較に影響しない（`1.4.2+build.1` = `1.4.2+build.2`） |

## いつ何を上げるか

| 変更内容 | 上げる要素 |
|---|---|
| 既存 API の削除・シグネチャ変更・挙動変更（破壊的） | MAJOR |
| 非推奨化（`@deprecated`） | MINOR（まだ動くため） |
| 新 API 追加（既存に影響なし） | MINOR |
| バグ修正（挙動を意図した形に戻す） | PATCH |
| 依存バージョン範囲の更新 | 影響に応じて PATCH / MINOR |
| README・コメント・ドキュメント | 変更不要 or PATCH |

**0.x 系**は「まだ stable でない」扱い。多くのエコシステムで `0.x.y` → `0.x.(y+1)` が実質的に MINOR 相当の破壊を許容する。1.0.0 リリースで API が安定すると宣言する。

## npm の range 記法

```text
^1.4.2   # >=1.4.2 <2.0.0    （推奨デフォルト）
~1.4.2   # >=1.4.2 <1.5.0    （MINOR を固定）
1.4.2    # 完全一致
>=1.4.2  # 以上
1.x      # 1.x.x
*        # 任意
```

### 0.x の例外

`^0.4.2` は **`>=0.4.2 <0.5.0`**（MAJOR は 0 で固定、MINOR を固定）。0.x では破壊的変更を許容するための扱い。

## プレリリース

```text
1.0.0-alpha          # 初期テスト
1.0.0-alpha.1
1.0.0-beta
1.0.0-beta.1
1.0.0-rc.1           # リリース候補
1.0.0                # GA
```

タグ付き公開: `npm publish --tag beta` / `--tag alpha`。consumer は `npm install pkg@beta` で取れる。

## Conventional Commits との連動

`feat:` / `fix:` / `!` を検出して次バージョンを決定:

| コミット | バンプ |
|---|---|
| `fix:` | PATCH |
| `feat:` | MINOR |
| `feat!:` / `BREAKING CHANGE:` フッター | MAJOR |
| `docs:` / `chore:` / `test:` 等 | なし（reset-on-release 時スキップ） |

詳細は `standards/conventional-commits.md` を参照。

## 自動化ツール

| ツール | 特徴 |
|---|---|
| `semantic-release` | Git ログから次バージョン決定 → CHANGELOG 生成 → npm publish → GitHub Release まで自動 |
| `changesets` | monorepo 向け。変更を `.changeset/*.md` に明示記録、集約してリリース |
| `release-please` | Google 製。PR を自動生成 |
| `standard-version` | changelog + tag（非推奨、semantic-release か changesets へ） |

### semantic-release 最小構成

```json
{
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    "@semantic-release/git"
  ]
}
```

`main` への push で自動リリースが走る。

### changesets

monorepo で各パッケージに独立してバージョンを付ける:

```bash
pnpm changeset              # 変更種別（major/minor/patch）を対話で記録
pnpm changeset version      # 集約して各 package.json を更新
pnpm changeset publish      # npm publish + tag
```

CI で PR を自動生成（`changesets/action`）するのが一般的。

## 破壊的変更の扱い方

### 1. 非推奨化の段階

```ts
/** @deprecated use `newFoo()` instead. Will be removed in 2.0.0 */
export function oldFoo() { /* ... */ }
```

少なくとも 1 MINOR バージョン挟んでからの削除が礼儀。

### 2. Migration guide

MAJOR リリース時に `MIGRATION.md` または CHANGELOG にアップグレード手順を明記:

```markdown
## Migration to 2.0.0

### Removed `oldFoo()`
- Before: `oldFoo(x)`
- After:  `newFoo(x, { legacy: true })`
```

### 3. Codemod

大きな破壊には自動変換スクリプト（`jscodeshift` 等）を用意すると採用が進む。

## ライブラリと内部アプリでの違い

| 観点 | ライブラリ（公開 API あり） | 内部アプリ |
|---|---|---|
| SemVer 遵守 | 必須 | 推奨だが厳密でなくてよい |
| バージョン上げ方 | semantic-release 等で自動 | commit / tag 単位で可 |
| プレリリース | 公開前テスト必要 | デプロイ環境で代替 |
| changelog | 必須 | 任意 |

内部デプロイは**日付ベース**（`2026.04.18`）や**ビルド番号**でも実務上問題ない。

## よくある誤り

1. **破壊的変更を PATCH で出す** — ユーザーが `^` で追従していると一斉に壊れる。MAJOR を上げる
2. **0.x で MAJOR を上げるつもりで MINOR を上げる** — 0.4.x → 0.5.0 で破壊的変更は許されるが、明示することが重要
3. **プレリリース同士の順序** — `1.0.0-beta` < `1.0.0-beta.1`。`.1` は通常アップ扱い
4. **ビルドメタで順序比較** — しない。`+metadata` は識別用途のみ
5. **タグと package.json の不一致** — `v1.2.3` タグと `"version": "1.2.3"` は必ず同期

## AI エージェント運用への含意

- 依存更新 PR（Renovate 等）では `^` レンジが MAJOR を跨がないことを確認
- 自動リリースは Conventional Commits の品質で決まる → lint を徹底
- monorepo のバージョン整合性は changesets のようなツールで担保
- 「内部スナップショット配布」と「公開 stable リリース」はプロセスを分ける

## 参考

- [Semantic Versioning 2.0.0 日本語訳](https://semver.org/lang/ja/)
- [npm semver calculator](https://semver.npmjs.com/)
- `standards/conventional-commits.md` — コミットメッセージ規約
- `tools/renovate.md` — レンジ戦略の詳細
