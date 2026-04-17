# Docker

アプリケーションをコンテナ（軽量な隔離環境）として配布・実行するプラットフォーム。OCI (Open Container Initiative) 仕様準拠の runtime + CLI + イメージレジストリ + Compose のエコシステム。

公式: [docs.docker.com](https://docs.docker.com/)

## インストール

```bash
# Docker Desktop (macOS / Windows / Linux)
# → https://www.docker.com/products/docker-desktop/ からダウンロード

# Linux（Docker Engine のみ、Desktop なし）
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER           # sudo なしで docker 実行
newgrp docker

# Homebrew（Docker Desktop）
brew install --cask docker

# 代替: Podman / Colima / OrbStack
brew install colima docker              # Colima + CLI のみ
colima start
```

## 基本的な概念

| 用語 | 意味 |
|---|---|
| **Image** | 読み取り専用のアプリケーションテンプレート（layer スタック） |
| **Container** | Image を起動した動的インスタンス |
| **Dockerfile** | Image のビルド手順スクリプト |
| **Registry** | Image の配布先（Docker Hub / GHCR / ECR / GCR 等） |
| **Volume** | 永続化ストレージ（コンテナ外に保存） |
| **Network** | コンテナ間通信の論理ネットワーク |
| **Compose** | 複数コンテナの宣言的管理 |

## Dockerfile 最小例

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 主要命令

| 命令 | 用途 |
|---|---|
| `FROM` | ベースイメージ（必須） |
| `WORKDIR` | 作業ディレクトリ |
| `COPY` / `ADD` | ファイル追加（`ADD` は URL + 展開も可、`COPY` 推奨） |
| `RUN` | ビルド時のコマンド実行 |
| `CMD` | コンテナ起動時のデフォルトコマンド |
| `ENTRYPOINT` | 必ず実行されるコマンド（CMD は引数扱い） |
| `EXPOSE` | ドキュメンテーション用のポート宣言（実際の公開は `-p`） |
| `ENV` | 環境変数 |
| `ARG` | ビルド時の引数（`docker build --build-arg`） |
| `USER` | 実行ユーザー（root 以外推奨） |
| `HEALTHCHECK` | ヘルスチェックコマンド |
| `VOLUME` | マウントポイント |

## build の基本

```bash
# ビルド
docker build -t myapp:latest .

# タグ付け
docker tag myapp:latest ghcr.io/org/myapp:1.0.0

# ビルド引数
docker build --build-arg NODE_ENV=production -t myapp .

# キャッシュ無効化
docker build --no-cache -t myapp .

# プラットフォーム指定（クロスビルド）
docker build --platform linux/amd64,linux/arm64 -t myapp .
```

### BuildKit + buildx

Docker 23+ ではデフォルトで BuildKit 使用。マルチプラットフォームビルドは `docker buildx`:

```bash
docker buildx create --use --name mybuilder
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/org/myapp:latest --push .
```

## run の基本

```bash
# 最小
docker run --rm -it ubuntu:24.04 bash

# デーモン起動 + ポート公開
docker run -d -p 3000:3000 --name myapp myapp:latest

# 環境変数
docker run -e DATABASE_URL="postgres://..." myapp

# Volume マウント
docker run -v $(pwd)/data:/app/data myapp               # bind mount
docker run -v mydata:/app/data myapp                     # named volume

# ネットワーク指定
docker run --network mynet myapp

# リソース制限
docker run --cpus 2 --memory 512m myapp
```

### よく使うフラグ

| フラグ | 意味 |
|---|---|
| `-d` | デタッチ（バックグラウンド） |
| `-it` | インタラクティブ + TTY |
| `--rm` | 停止後に自動削除 |
| `--name <n>` | コンテナ名 |
| `-p host:ctr` | ポートマッピング |
| `-v src:dst` | ボリュームマウント |
| `-e KEY=VAL` | 環境変数 |
| `--env-file <f>` | 環境変数ファイル |
| `--network <n>` | ネットワーク |
| `--restart <policy>` | 再起動ポリシー（`no` / `on-failure` / `always` / `unless-stopped`） |

## 状態管理

```bash
docker ps                       # 実行中コンテナ
docker ps -a                    # 全コンテナ
docker images                   # イメージ一覧
docker logs <container>         # ログ
docker logs -f <container>      # 追従
docker exec -it <container> sh  # シェル接続
docker stop <container>
docker rm <container>
docker rmi <image>
docker system prune -a          # 未使用リソース一括削除
```

## Docker Compose

複数コンテナをまとめて定義。`docker-compose.yaml`（または `compose.yaml`）:

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://db:5432/app
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - path: ./src
          action: sync
          target: /app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: dev
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

```bash
docker compose up              # 起動（フォアグラウンド）
docker compose up -d           # バックグラウンド
docker compose up --build      # 再ビルド
docker compose logs -f app     # ログ追従
docker compose exec app sh     # コンテナに入る
docker compose down            # 停止・削除
docker compose down -v         # volume も削除
docker compose watch           # 変更検知 + 同期（開発用）
```

## マルチステージビルド

ビルド専用ステージと実行ステージを分けて最終イメージを小さくする。上の Dockerfile 例がまさにそれ。効果:

- ビルドツール（TypeScript コンパイラ等）を本番イメージから除外
- イメージサイズが 1/5〜1/10 になることも
- 攻撃面が減る

## イメージサイズ最適化

| 手法 | 効果 |
|---|---|
| Alpine / distroless ベース | 数 MB〜十数 MB |
| マルチステージ | ビルド成果物だけ残す |
| `.dockerignore` | 不要ファイル除外（`node_modules`, `.git`, `dist`） |
| 依存インストール順序 | 変更頻度の低い `package.json` を先に COPY |
| `--frozen-lockfile` | 再現性 + キャッシュヒット向上 |
| `docker buildx build --cache-from` | CI キャッシュ |

### `.dockerignore`

```text
node_modules
dist
.git
.github
.env
.env.*
*.log
.DS_Store
.claude
```

## セキュリティベストプラクティス

1. **non-root で実行**: `USER node` など
2. **最新のベースイメージ**: `node:24-alpine` のように固定し Renovate で追随
3. **SHA ピン留め**: `FROM node:24-alpine@sha256:...` で改ざん防止
4. **Trivy スキャン**: `trivy image myapp:latest` を CI に組み込む
5. **secrets はビルド時に焼き込まない**: 環境変数 or volume で runtime 注入
6. **HEALTHCHECK 設定**: オーケストレータがコンテナの異常を検知できる
7. **最小権限**: read-only filesystem (`--read-only`)、capability drop (`--cap-drop=ALL`)

## CI での使い方（GitHub Actions）

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Claude Code / MCP との関連

- MCP サーバーを Docker イメージとして配布する場合、stdio トランスポートはコンテナに閉じるため通常は向かない（子プロセスとして起動される前提）
- Streamable HTTP トランスポートの MCP サーバーなら Docker 配布が自然
- 開発サンドボックス（エージェントにシェル実行させる）として Docker を使うパターンも一般的（Codex CLI の `sandbox = "docker"` 等）

## トラブルシュート

### `Cannot connect to the Docker daemon`

- Docker Desktop が起動していない → 起動
- Linux でユーザーが `docker` グループに未参加 → `sudo usermod -aG docker $USER`、再ログイン
- `DOCKER_HOST` の設定ミス

### `no space left on device`

```bash
docker system df                # 使用量確認
docker system prune -a --volumes # 全削除（注意）
```

Docker Desktop は仮想ディスク容量を別途設定（GUI の「Resources」）。

### Apple Silicon で `exec format error`

イメージが `linux/amd64` のみ。`--platform linux/amd64` で明示（Rosetta 経由で遅いが動く）、または multi-arch イメージを使う。

### ビルドキャッシュが効かない

- COPY 順序が悪い（`package.json` を先に COPY していない）
- BuildKit が無効 → `DOCKER_BUILDKIT=1` を設定
- CI でキャッシュ保存先未指定 → GitHub Actions なら `cache-from/to: type=gha`

### ファイル権限問題（Linux）

`USER node` で起動したコンテナが bind mount したディレクトリに書き込めない。UID を合わせる（`--user $(id -u):$(id -g)`）か、`chown` を事前に。

## 他ツールとの比較

| 観点 | Docker Desktop | Colima | OrbStack | Podman |
|---|---|---|---|---|
| ライセンス | 大企業は有償 | OSS | 個人 free / 商用有償 | OSS |
| OS | mac/Win/Linux | mac/Linux | mac のみ | Linux（mac/Win は実験的） |
| 速度 | 普通 | 速い | 最速 | 速い |
| Kubernetes | 内蔵 | k3s option | 内蔵 | minikube など |
| daemonless | いいえ | いいえ | いいえ | はい |

個人利用や OSS なら Docker Desktop / Colima / OrbStack。ライセンス制約を避けたいなら Colima / Podman。

## 参考

- [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/)
- [Compose specification](https://compose-spec.io/)
- [Trivy による脆弱性スキャン](../tools/trivy.md)
- [GitHub Actions での build-push-action](../platforms/github-actions.md)
