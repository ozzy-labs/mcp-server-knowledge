---
reviewed: 2026-04-18
tags: [methodology, git-hook]
---

# Conventional Commits

コミットメッセージの形式を規約化した仕様。履歴から自動生成（CHANGELOG、セマンティックバージョン）を可能にし、変更の意図を機械可読にする。

公式仕様: [conventionalcommits.org](https://www.conventionalcommits.org/)

## 基本フォーマット

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

- **type**: 変更の種別（必須、後述）
- **scope**: 影響範囲（任意）。例: `api`, `ui`, `deps`
- **description**: 50 字以内目安、現在形・命令形（`add`, `fix`, not `added`, `fixes`）
- **body**: 変更の背景・動機。72 字で折り返す
- **footer**: `BREAKING CHANGE:` や `Refs: #123` など

## Type 一覧

| type | 用途 | 典型例 |
|---|---|---|
| `feat` | 機能追加 | 新 API、新画面、新 CLI オプション |
| `fix` | バグ修正 | クラッシュ修正、不正な出力の修正 |
| `docs` | ドキュメントのみ | README、コメント、knowledge 更新 |
| `style` | 書式のみ（動作変更なし） | フォーマッタ、セミコロン調整 |
| `refactor` | リファクタリング | 挙動を変えない整理・抽象化 |
| `perf` | パフォーマンス改善 | アルゴリズム最適化、キャッシュ追加 |
| `test` | テストのみ | テスト追加・修正 |
| `build` | ビルドシステム | tsconfig、package.json の依存追加 |
| `ci` | CI 設定 | GitHub Actions、lefthook |
| `chore` | 雑務 | gitignore、ツール設定（他のどれでもない） |
| `revert` | 差し戻し | `git revert` のコミット |

## Breaking change

`type` の直後に `!` を付けるか、フッターに `BREAKING CHANGE:` を書く。

```text
feat!: redesign authentication flow

BREAKING CHANGE: `/auth/login` endpoint no longer accepts email+password.
Migrate to `/auth/oauth` instead.
```

semantic-release などは `!` / `BREAKING CHANGE` を検出して MAJOR bump を行う。

## Scope

変更領域を短く括弧で示す。任意だが、monorepo や大規模リポジトリでは強く推奨。

```text
feat(api): add pagination to /users
fix(ui): correct button alignment on mobile
build(deps): bump zod to 3.25.23
```

## Description の書き方

- **英語で書く**（エージェント・CI ツールとの互換性、grep しやすさ）
- **現在形の命令形** (`add`, `fix`, `update`)。`added`, `fixing` は使わない
- **先頭小文字** (`fix` プレフィックスの大文字化は統一のため避ける)
- **末尾ピリオドなし**
- **主語なし** (`I added` ではなく `add`)

### OK / NG 例

```text
# OK
feat: add rate limit to search endpoint
fix(auth): handle expired JWT with 401 response
docs: update MCP registration instructions

# NG
feat: Added rate limit.              # 過去形、大文字、句点
Fix: searching is broken             # type 後コロンなし風、description が曖昧
update stuff                          # type なし、vague
```

## 強制ツール

コミット時の検証を自動化する:

- **commitlint** (`@commitlint/cli` + `@commitlint/config-conventional`): メッセージ検証
- **lefthook** / **husky**: `commit-msg` フックで commitlint を実行
- **semantic-release**: type から次バージョンを決定し自動リリース
- **changesets**: monorepo 向けバージョン管理

`.commitlintrc.json` 最小構成:

```json
{ "extends": ["@commitlint/config-conventional"] }
```

lefthook で呼び出す:

```yaml
commit-msg:
  commands:
    commitlint:
      run: pnpm commitlint --edit {1}
```

## ブランチ命名との揃え

`<type>/<short-description>` の規約と組み合わせると、ブランチとコミットで type が一致し、PR タイトルもそのまま使える。

```text
ブランチ:       feat/add-rate-limit
コミット:       feat(api): add rate limit to search endpoint
PR タイトル:    feat(api): add rate limit to search endpoint
```

## 複数行メッセージ

body / footer を含む場合は、HEREDOC で渡すのが安全（エスケープ事故を防げる）:

```bash
git commit -m "$(cat <<'EOF'
feat(api): add rate limit to search endpoint

Limit: 60 req/min per API key. Returns 429 with Retry-After header.

Refs: #234
EOF
)"
```
