---
reviewed: 2026-05-04
tags: [format, javascript, typescript, markdown, yaml]
---

# Prettier

主観的なコードフォーマッタ。元のスタイルを破棄して一貫した形に再出力する。2026-04 時点では **Biome がまだ整形に対応していない Markdown / YAML / HTML / Vue / Svelte** などを補完する役割で残り続けている。Biome を採用したプロジェクトでも、非 JS 資産に Prettier を併用するハイブリッド構成が一般的。

公式: [prettier.io](https://prettier.io/)

## バージョン

2026-04 時点の現行は **3.8 系**（3.8.3, 2026-04-15）。4.0 は CLI 高速化を中心に計画中。

## インストール

```bash
pnpm add -D -E prettier
```

マイナー更新でフォーマット差分が出ることがあるため exact 固定（`-E`）が公式推奨。

## 基本コマンド

```bash
# 差分チェック（CI 向け。違反で非 0 終了）
pnpm exec prettier --check .

# 書き込み（整形を適用）
pnpm exec prettier --write .

# 特定拡張子のみ
pnpm exec prettier --write "**/*.{md,yaml,yml}"
```

## サポート言語（組み込み）

| 言語 | 備考 |
|---|---|
| JavaScript / TypeScript / JSX | Biome と競合する領域 |
| Flow | JS 系 |
| Vue / Angular | フレームワーク固有 |
| CSS / Less / SCSS | Biome は CSS 対応済み |
| HTML / Handlebars | Biome 未対応 |
| JSON / JSON5 / JSONC | Biome と競合 |
| GraphQL | — |
| **Markdown（GFM / MDX v1）** | **Biome 未対応** |
| **YAML** | **Biome 未対応** |

プラグイン（`prettier-plugin-*`）で TOML / XML / PHP / Astro / Svelte / Tailwind クラスソートなどを拡張できる。

## 設定ファイル

`.prettierrc` / `.prettierrc.json` / `.prettierrc.yaml` / `prettier.config.mjs` / `package.json` の `"prettier"` キーなど複数の形式をサポート:

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "semi": true,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

| オプション | 典型値 | 説明 |
|---|---|---|
| `printWidth` | 80 / 100 | 折り返し目安（強制ではない） |
| `tabWidth` | 2 | インデント幅 |
| `useTabs` | false | タブ vs スペース |
| `semi` | true | セミコロン |
| `singleQuote` | false | シングルクォート |
| `trailingComma` | `"all"` | 末尾カンマ（3.0 から既定 `all`） |
| `endOfLine` | `"lf"` | 改行コード |

### `overrides` で拡張子別の上書き

```json
{
  "printWidth": 100,
  "overrides": [
    { "files": "*.md", "options": { "proseWrap": "preserve" } },
    { "files": "*.{yaml,yml}", "options": { "singleQuote": false } }
  ]
}
```

## `.prettierignore`

```text
node_modules
dist
pnpm-lock.yaml
CHANGELOG.md
```

Prettier 3.0 から **`.gitignore` も自動で尊重**される。

## Biome との使い分け（2026-04 時点）

現実解は **Biome を中心にしつつ、Biome が扱えないものに Prettier を当てる**:

| 対象 | Biome | Prettier |
|---|---|---|
| JS / TS / JSX / JSON | ✓（推奨） | 可 |
| CSS | ✓ | 可 |
| Markdown / YAML | ✗ | ✓（**これが主目的**） |
| HTML / Vue / Svelte / Astro | 限定的 | プラグイン経由で ✓ |

**二重フォーマットを避ける**ため、以下のいずれかで担当を分ける:

- `biome.json` の `files.includes` で JS/TS/JSON のみに絞る
- `.prettierignore` で Biome が扱う拡張子を除外する
- `pnpm run lint:md` / `lint:yaml` のように Prettier 呼び出しをコマンド分離する

## CI と pre-commit

```yaml
# lefthook.yaml
pre-commit:
  commands:
    prettier:
      glob: "*.{md,yaml,yml}"
      run: prettier --write {staged_files}
      stage_fixed: true
```

CI 側:

```bash
pnpm exec prettier --check "**/*.{md,yaml,yml}"
```

## プラグイン

| プラグイン | 用途 |
|---|---|
| `prettier-plugin-astro` | `.astro` ファイル |
| `prettier-plugin-svelte` | `.svelte` ファイル |
| `prettier-plugin-tailwindcss` | Tailwind CSS クラスの自動ソート |
| `prettier-plugin-toml` | TOML（`tools/taplo.md` も参照） |
| `prettier-plugin-sh` | シェルスクリプト（`tools/shfmt.md` と競合するため通常不要） |
| `@prettier/plugin-xml` | XML |

設定ファイルの `plugins` 配列に追記するか、CLI `--plugin <pkg>` で指定。

## AI エージェントがよくやるミス

1. **Biome と Prettier を同じファイルに両方かけて無限整形差分** — 担当拡張子を必ず分離する。
2. **`printWidth` を物理的な厳格ルールと勘違い** — Prettier は「折り返しの目安」であって厳密上限ではない（特に長い URL / 識別子は超過する）。
3. **Markdown の `proseWrap: "always"` を入れて差分が膨大になる** — 日本語混じりは `"preserve"` が安全。既存ドキュメントなら既定の `"preserve"` を変えない。
4. **`pnpm-lock.yaml` や自動生成ファイルを整形して差分ノイズ** — `.prettierignore` に追加する（`.gitignore` 経由でも除外される）。
5. **v2 の設定（`trailingComma: "es5"` など）をコピペ** — 3.x の既定 `"all"` に合わせる方がノイズが少ない。

## 参考

- [Prettier 公式ドキュメント](https://prettier.io/docs/en/)
- [Options](https://prettier.io/docs/en/options)
- [Plugins](https://prettier.io/docs/en/plugins)
- [Biome: Prettier との差異](https://biomejs.dev/formatter/differences-with-prettier/)
