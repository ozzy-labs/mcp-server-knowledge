---
reviewed: 2026-05-03
---

# Dev Containers

OCI コンテナ内で開発環境を定義する仕様。`.devcontainer/devcontainer.json` をリポジトリ直下に置くと VS Code / GitHub Codespaces / JetBrains / `devcontainer` CLI 等のツールが**同一の隔離環境**を起動できる。マシン依存のセットアップを排除し、AI エージェント（Claude Code / Codex CLI / Gemini CLI / Copilot CLI）も Dev Container 内に常駐させる運用が広がっている。1 リポ内のマルチエージェント構成は `standards/multi-agent-repo.md`、複数リポへの設定配布は `standards/multi-repo-config-sync.md` を参照。

公式: [containers.dev](https://containers.dev/) / [Reference](https://containers.dev/implementors/json_reference/)

## なぜ使うか

| 課題 | Dev Container での解決 |
|---|---|
| マシンごとに toolchain が違う | コンテナイメージで統一 |
| 「動かない」issue がローカル環境差で発生 | コンテナ内で再現 |
| 新メンバの onboarding に半日 | clone → reopen in container |
| AI エージェントが CI と違う動作 | CI と同じイメージで開発 |
| 複数言語が混在 | features で組み合わせる |

## 最小例

```jsonc
// .devcontainer/devcontainer.json
{
  "name": "my-app",
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-24.04",
  "features": {
    "ghcr.io/devcontainers/features/node:2": { "version": "24" },
    "ghcr.io/devcontainers/features/github-cli:1": {}
  },
  "postCreateCommand": "pnpm install",
  "remoteUser": "vscode"
}
```

これだけで `Reopen in Container` で**Node 24 + gh CLI + 依存インストール済み**の隔離環境が立ち上がる。

## 主要フィールド

| フィールド | 用途 |
|---|---|
| `name` | 表示名 |
| `image` | ベースイメージ（registry 指定） |
| `build.dockerfile` / `build.context` / `build.args` | カスタム Dockerfile を使う場合 |
| `features` | Dev Container Feature の追加（後述） |
| `customizations.vscode.extensions` | VS Code 拡張の自動インストール |
| `customizations.vscode.settings` | エディタ設定 |
| `forwardPorts` | コンテナ → ホストへ転送する port |
| `portsAttributes` | port のラベル・protocol |
| `mounts` | bind / volume の追加 |
| `runArgs` | `docker run` への追加引数 (`--gpus=all` 等) |
| `remoteUser` | コンテナ内のユーザ（既定は `vscode` 等） |
| `workspaceFolder` | コンテナ内のワークスペースパス |
| `workspaceMount` | ホスト→コンテナの mount 仕様 |
| `containerEnv` / `remoteEnv` | コンテナ / ツールサブプロセスの環境変数 |
| `hostRequirements` | 必要 CPU / メモリ / ストレージ / GPU |
| `shutdownAction` | コンテナ停止時の挙動 (`none` / `stopContainer` / `stopCompose`) |

## ライフサイクルコマンド

実行順序は固定:

```text
initializeCommand     ← ホストで実行（Docker 起動前）
       ↓
[ コンテナビルド・起動 ]
       ↓
onCreateCommand       ← 初回コンテナ作成時 1 回
updateContentCommand  ← prebuild 時に走る（差分更新）
postCreateCommand     ← 作成最終ステップ
       ↓
[ 起動完了 ]
       ↓
postStartCommand      ← 起動のたび
postAttachCommand     ← クライアントが attach するたび
```

| コマンド | 典型用途 |
|---|---|
| `initializeCommand` | ホスト側の鍵生成、`.env` 作成 |
| `onCreateCommand` | 言語ランタイムのキャッシュ warm-up |
| `updateContentCommand` | `pnpm install` / `uv sync`（prebuild で走る） |
| `postCreateCommand` | DB の初期マイグレーション |
| `postStartCommand` | サービス起動（`docker compose up -d` 等） |
| `postAttachCommand` | プロンプト・welcome メッセージ |

`updateContentCommand` と `postCreateCommand` の使い分けが Codespaces の **prebuild** で重要（後述）。

## Features エコシステム

Features は「**追加 toolchain の宣言的インストール**」。`ghcr.io/<owner>/features/<name>:<version>` の形で参照する:

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:2": { "version": "24" },
    "ghcr.io/devcontainers/features/python:1": { "version": "3.13" },
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/common-utils:2": {
      "installZsh": true,
      "username": "vscode"
    }
  }
}
```

| カテゴリ | 例 |
|---|---|
| 言語 | `node` / `python` / `go` / `rust` / `java` / `ruby` |
| ランタイム | `docker-in-docker` / `docker-outside-of-docker` / `kubectl-helm-minikube` |
| CLI | `github-cli` / `aws-cli` / `azure-cli` / `terraform` |
| OS | `common-utils` (zsh, oh-my-zsh, sudo, locale) |

**バージョンは必ず major で pin する**（`:2` → `2.x.y` を取る）。`:latest` は再現性を破壊する。コミュニティ Features 一覧は [containers.dev/features](https://containers.dev/features) で検索できる。

## Multi-container（Compose）

```jsonc
{
  "name": "stack",
  "dockerComposeFile": "../docker-compose.yaml",
  "service": "app",
  "workspaceFolder": "/workspaces/${localWorkspaceFolderBasename}",
  "shutdownAction": "stopCompose"
}
```

`service` で attach 先を指定。DB / cache 等は別サービスとして同時起動できる。`shutdownAction: stopCompose` でクライアント終了時に全サービスを止める。

## カスタマイゼーション

VS Code 固有設定:

```jsonc
{
  "customizations": {
    "vscode": {
      "extensions": [
        "biomejs.biome",
        "ms-azuretools.vscode-docker",
        "anthropic.claude-code"
      ],
      "settings": {
        "editor.formatOnSave": true,
        "terminal.integrated.defaultProfile.linux": "zsh"
      }
    },
    "jetbrains": {
      "backend": "IntelliJ"
    }
  }
}
```

エージェント別の MCP 設定（`.claude.json` / `.codex/config.toml` / 等）は**コンテナ内のホームに撒く**形で運用する。features または `postCreateCommand` で配布する。

## Codespaces 固有: prebuild

GitHub Codespaces では「prebuild」で起動時間を 1-2 分から数秒に短縮できる:

- `updateContentCommand` までを定期 / push 時にビルドしてキャッシュ
- 利用者が Codespace を起動すると、すでに warm 状態のスナップショットから起動

`postCreateCommand` は prebuild に乗らない（インスタンス固有のセットアップを残すため）ので、依存インストール等の重い処理は `updateContentCommand` に置く。

## `devcontainer` CLI

VS Code / Codespaces を使わずに Dev Container を起動する公式 CLI:

```bash
npm install -g @devcontainers/cli

devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
devcontainer build --workspace-folder .
devcontainer run-user-commands --workspace-folder .
```

CI で「Dev Container と同じ環境でテストを回す」用途、または GitHub Actions の `devcontainers/ci` アクションで利用される。

## サポート状況

| クライアント | サポート |
|---|---|
| VS Code (Dev Containers 拡張) | フル |
| GitHub Codespaces | フル + prebuild |
| JetBrains IDEs | フル（一部 features に制約） |
| `devcontainer` CLI | フル（CI 用途中心） |
| Cursor | VS Code 互換 |
| Vim / Neovim | サードパーティプラグイン経由 |

## AI エージェントを常駐させるパターン

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/common-utils:2": {},
    "ghcr.io/anthropics/devcontainer-features/claude-code:1": {}
  },
  "postCreateCommand": "claude mcp add --scope user knowledge -- node /workspaces/knowledge-mcp-server/dist/index.js",
  "remoteEnv": {
    "ANTHROPIC_API_KEY": "${localEnv:ANTHROPIC_API_KEY}"
  }
}
```

- `remoteEnv` でホストの環境変数を中継（`localEnv:VAR` 構文）
- MCP 設定は `postCreateCommand` で再現
- 鍵類は volume mount または OS のキーストア経由（イメージに焼き付けない）

## AI エージェントがよくやるミス

1. **`postCreateCommand` と `postStartCommand` の混同** — 重い処理を `postStartCommand` に書くと毎回起動が遅い。1 回でよい依存インストールは `postCreateCommand` か `updateContentCommand`
2. **features を `:latest` で参照** — 再現性が崩れる。`:2` のように major で pin
3. **`workspaceMount` と `workspaceFolder` の不一致** — ホストパスとコンテナパスがずれてエディタが workspace を見失う
4. **prebuild なしで Codespaces を運用** — `pnpm install` / `uv sync` を毎起動 = 30 秒〜2 分のロス。`updateContentCommand` に寄せると prebuild が効く
5. **`remoteUser: root` のまま開発** — bind mount したファイルの所有者が root になり、ホスト側で編集権限が壊れる。`updateRemoteUserUID: true` を併用
6. **Dockerfile 内に直接 pip / npm install を書いて features を使わない** — 共有・更新が困難。features を優先する
7. **`forwardPorts` を使わずアプリが見えない** — 0.0.0.0 で listen しない、または port が `forwardPorts` に含まれない
8. **シークレットを `containerEnv` に直書き** — ファイルにコミットされる。`localEnv:` 経由か Codespaces secrets を使う

## 関連

- [`platforms/docker.md`](../platforms/docker.md) — 基盤コンテナ知識
- [`standards/multi-agent-repo.md`](multi-agent-repo.md) — 1 リポ内のマルチエージェント構成
- [`standards/multi-repo-config-sync.md`](multi-repo-config-sync.md) — 複数リポへの `.devcontainer/` 配布

## 参考

- [Development Containers Specification](https://containers.dev/)
- [devcontainer.json reference](https://containers.dev/implementors/json_reference/)
- [Available Features](https://containers.dev/features)
- [@devcontainers/cli](https://github.com/devcontainers/cli)
- [Codespaces prebuilds](https://docs.github.com/en/codespaces/prebuilding-your-codespaces)
