---
reviewed: 2026-05-04
tags: [package, release, npm]
---

# npm publish

npm レジストリにパッケージを公開するコマンドと運用上の要点。tarball の中身（`files` / `.npmignore`）、dist-tag、ライフサイクルスクリプト、provenance、unpublish ポリシーが落とし穴の中心。`tools/pnpm.md` のパッケージマネージャ運用、`standards/npm-trusted-publishers.md` の OIDC、`standards/semver.md` のバージョン決定とセットで使う。

公式: [docs.npmjs.com — npm-publish](https://docs.npmjs.com/cli/v11/commands/npm-publish)

## publish の流れ

1. `prepublishOnly` → `prepare` → `prepack` → tarball 作成（`npm pack` 相当） → `postpack` → 認証付き PUT で registry へアップロード → `publish` → `postpublish`
2. registry 側で `name@version` の不変記録が作られる（同じバージョンは二度上げられない）
3. dist-tag（既定 `latest`）が更新される

`name` と `version` の組は **永久にユニーク**。一度公開したバージョン番号は再利用不可（unpublish 後も）。

## 主要コマンドとフラグ

| フラグ | 用途 |
|---|---|
| `--dry-run` | アップロードせず、何が含まれるか確認 |
| `--tag <name>` | dist-tag を指定（既定 `latest`） |
| `--access public` / `--access restricted` | scoped package の公開範囲 |
| `--otp <code>` | 2FA のワンタイムコード |
| `--provenance` | OIDC + Sigstore で attestation を発行 |
| `--provenance-file <path>` | 既存の provenance bundle ファイルから attestation を提出（`--provenance` と相互排他） |
| `--workspace <name>` / `--workspaces` | monorepo の対象指定 |
| `--include-workspace-root` | `--workspaces` 使用時にルートも対象 |

```bash
# まず中身を確認
npm publish --dry-run

# 公開（scoped, public）
npm publish --access public

# プレリリース
npm publish --tag next
```

## `package.json` の publish 関連フィールド

| フィールド | 役割 |
|---|---|
| `name` | パッケージ名。214 文字以下、小文字、URL セーフ。`@scope/name` で scoped |
| `version` | SemVer。詳細は `standards/semver.md` |
| `main` | CommonJS のエントリ（既定 `index.js`） |
| `module` | ESM 用エントリ（バンドラ向け、Node.js は読まない） |
| `exports` | **モダンなエントリ定義**。`import` / `require` / `types` / `default` 等の条件付き解決をサポート |
| `types` | TypeScript 型定義のエントリ |
| `bin` | CLI バイナリのパス。インストール時に `node_modules/.bin` に配置（`chmod` 不要） |
| `files` | tarball に含めるファイルのホワイトリスト |
| `publishConfig` | publish 時のみ適用される設定（`registry` / `access` / `tag` を上書き可） |
| `private: true` | 誤公開を防ぐ。`true` だと `npm publish` がエラー終了 |
| `license` | SPDX 識別子（`MIT`、`Apache-2.0`、`(MIT OR Apache-2.0)` 等） |
| `repository` | ソースコードの場所。`github:owner/repo` で短縮可 |
| `sideEffects` | ツリーシェイク可能性のヒント。`false` または対象ファイル配列 |

### `exports` の最小例

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

`exports` を定義すると **そこに書かれていないパスは外部から `import` できない**（カプセル化が効く）。`./package.json` を露出させておかないとツールが読めずエラーになることがある。

### `publishConfig` の使いどころ

```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public",
    "tag": "next"
  }
}
```

CLI フラグや `.npmrc` を毎回書かずに済む。GitHub Packages や private registry に固定したいときに便利。

## tarball に何が入るか

優先順位（上から強い）:

1. `package.json` の `files` 配列があれば **そこにあるものだけ**
2. `files` がなければ `.npmignore`
3. `.npmignore` もなければ `.gitignore`
4. 常に**含まれる**: `package.json`, `README*`, `LICENSE*` / `LICENCE*`
5. 常に**除外**: `.git`, `node_modules`, `.DS_Store`, `npm-debug.log`, `.npmrc`, シンボリックリンク等

確認の鉄則:

```bash
npm publish --dry-run     # 含まれるファイル一覧を表示
npm pack                  # 実 tarball を生成（手元に .tgz ができる）
tar -tzf <pkg>-<ver>.tgz  # 中身を確認
```

`files` を書く方が事故が少ない（`.gitignore` に依存していると、CI でビルド成果物 `dist/` が `.gitignore` 入りのまま漏れる事故が起きる）。

## dist-tag（リリースチャネル）

```bash
npm publish --tag next       # next タグで公開（latest は更新されない）
npm dist-tag ls <pkg>        # タグ一覧
npm dist-tag add <pkg>@1.2.0 latest    # 後から latest を移動
npm dist-tag rm <pkg> next   # タグ削除
```

| dist-tag | 慣例 |
|---|---|
| `latest` | `npm install <pkg>` で取得される既定 |
| `next` / `beta` / `alpha` / `rc` | プレリリース。`npm install <pkg>@next` で取得 |
| `canary` | コミット単位の不安定版 |

GA リリース時に `latest` を更新しないと、SemVer プレリリース表記（`2.0.0-rc.1`）でも `latest` 取得者には届かない。

## ライフサイクルスクリプト

`package.json` の `scripts` に書くと自動実行される:

| スクリプト | `npm publish` | `npm pack` | `npm install`（ローカル） |
|---|---|---|---|
| `prepublishOnly` | 実行 | スキップ | スキップ |
| `prepare` | 実行（`prepack` の前） | 実行 | 実行（git 依存時） |
| `prepack` | 実行 | 実行 | スキップ |
| `postpack` | 実行 | 実行 | スキップ |
| `publish` | 実行 | スキップ | スキップ |
| `postpublish` | 実行 | スキップ | スキップ |

実務での定番:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "prepack": "pnpm run build",
    "prepublishOnly": "pnpm run test && pnpm run lint"
  }
}
```

- **ビルドは `prepack`** に置く（`npm pack` でも走るため、`--dry-run` で出力を検証できる）
- **テスト/lint は `prepublishOnly`** に置く（公開時のみのゲート）
- `prepublish`（`Only` なし）は **deprecated**。使わない

## scoped package と `--access`

| パッケージ名 | `--access` の既定 | `--access restricted` 可否 |
|---|---|---|
| 非 scoped（`my-pkg`） | `public` 固定 | 不可（必ず public） |
| scoped（`@scope/my-pkg`） | `public`（npm CLI v9+） | **可**（プライベートにできる、有料プラン or org が必要） |

scoped でプライベート化したい場合:

```bash
npm publish --access restricted
```

または `package.json` で固定:

```json
{ "publishConfig": { "access": "restricted" } }
```

## provenance（attestation）

```bash
npm publish --provenance --access public
```

build 元の commit / workflow run / runner 環境を Sigstore に記録し、改ざん検知の基盤になる。

- npm CLI **v9.5+** で対応
- pnpm は **v9+** で `pnpm publish --provenance`
- yarn berry は `yarn npm publish --provenance`

CI から `--provenance` を使うには OIDC token が必要。長寿命トークンを廃する **Trusted Publishers** と組み合わせるのが現代的（→ `standards/npm-trusted-publishers.md`）。

## 2FA / OTP

アカウントで 2FA を有効にしている場合、`--otp` でワンタイムコードを渡す:

```bash
npm publish --otp 123456
```

`auth-and-writes` レベルの 2FA を有効にすると publish/dist-tag 変更時に毎回 OTP を要求する。CI は OIDC（Trusted Publishers）または **granular access token**（2FA bypass を有効化した write 権限トークン）を使う。

> **legacy access token の段階的廃止**: 2025-11-05 に新規作成を停止、**2025-12-09 で既存トークンも revoke**。現在は granular access token のみが利用可能。granular token は package / scope / organization 単位の権限、有効期限（最短 1 日）、IP CIDR 制限、read-only / read-write、2FA bypass を細かく設定できる。長寿命トークンを残すなら granular に移行する。

## pnpm / yarn での publish

| ランナー | コマンド | メモ |
|---|---|---|
| npm | `npm publish` | 標準 |
| pnpm | `pnpm publish` / `pnpm -r publish` | `--no-git-checks` でクリーンツリー検証をスキップ可。CI で常用 |
| yarn (v1) | `yarn publish` | バージョン入力プロンプトが入る。v1 は保守モードのため新規採用は非推奨 |
| yarn berry | `yarn npm publish` | コマンド名が変わっている |

monorepo（pnpm workspaces）の例:

```bash
# 全 workspace を一括 publish（変更検出は別途必要）
pnpm -r publish --access public --no-git-checks --provenance
```

`--no-git-checks` を付けないと「コミットされていない変更がある」「リモートと同期していない」等で止まる。CI では通常付ける。

## unpublish と deprecate

`unpublish` は **公開後 72 時間以内**かつ依存パッケージなしの場合のみ広く許可される。それ以降は npm レジストリのポリシーで以下を**全て**満たす必要がある:

- 他の公開パッケージから依存されていない
- 過去 1 週間のダウンロードが 300 未満
- メンテナーが 1 人だけ

加えて:

- 削除した version 番号は **二度と再利用不可**
- 全 version を削除した場合、同名で再公開できるまで **24 時間** 待機

実務的には `deprecate` を使う:

```bash
npm deprecate <pkg>@"<range>" "Use @scope/new-pkg instead. Will be unsupported after 2027-01."
```

deprecate はパッケージを残したまま `npm install` 時に警告を出す。consumer の依存を壊さずに移行を促せる。

## AI エージェントがよくやるミス

1. **`prepublishOnly` でビルドしようとする** — `npm pack` で内容確認したい時にビルドが走らない。ビルドは `prepack`、テスト/lint は `prepublishOnly` に分ける
2. **`files` を書かずに `dist/` の漏れに気づかない** — `.gitignore` に `dist/` が入っていると `.npmignore` 不在時にビルド成果物が tarball に入らない。`files` の明示が安全
3. **scoped package で `--access public` 忘れ** — npm CLI v9 から既定が `public` になったが、CI ログで明示しない設定や古い CLI で 402/403 になることがある。`publishConfig.access` で固定が確実
4. **`exports` の `./package.json` 露出忘れ** — `exports` を書いた瞬間にカプセル化が効き、ツール（postcss, vite, vitest 等）が `package.json` を読めなくなる。明示的にエクスポートする
5. **同じ `version` を `--force` で上書きしようとする** — 上書きはできない。`patch` を 1 つ上げて再 publish する
6. **`unpublish` を気軽に使う** — 公開直後でも依存があれば不可。版を上げて `deprecate` するのが原則
7. **`prepare` で外部 fetch する** — git 依存（`"foo": "git+..."`）の install 時にも走る。consumer 側で重い処理が走って驚かれる
8. **`.npmrc` を tarball に含めてしまう** — シークレット（`_authToken`）が漏れる。`.npmrc` は常に除外されるが、別名（`registry.npmrc` 等）にしていると含まれる

## 関連

- [`standards/npm-trusted-publishers.md`](../standards/npm-trusted-publishers.md) — `NPM_TOKEN` を持たずに OIDC で publish する
- [`standards/semver.md`](../standards/semver.md) — `version` 決定ルールと dist-tag 戦略
- [`tools/pnpm.md`](pnpm.md) — `pnpm publish` の差分とフラグ
- [`tools/release-please.md`](release-please.md) — Release PR の自動化（publish 自体はしない）

## 参考

- [npm-publish (CLI v11)](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- [package.json リファレンス](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- [Unpublish ポリシー](https://docs.npmjs.com/policies/unpublish)
- [About scopes / access](https://docs.npmjs.com/cli/v11/using-npm/scope)
