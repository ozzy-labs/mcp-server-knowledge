---
reviewed: 2026-05-03
tags: [data-cli, cloud-hosted, aws, python]
---

# AWS CLI

AWS の公式コマンドラインツール。`aws-cli/2.x`（v2）が現行で、v1 は新機能の backport がない（IAM Identity Center、auto-prompt 等は v2 のみ）。すべての AWS API を CLI から叩ける一方、profile / リージョン / 認証チェーン / output 形式の組み合わせで意図しない挙動を起こしやすい。AI エージェントが S3 / IAM / ECR / Logs / SSM 等を操作する基盤ツールとして頻出する。

公式: [docs.aws.amazon.com/cli/latest/userguide](https://docs.aws.amazon.com/cli/latest/userguide/) / [API Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html)

## v1 と v2 の違い

| 観点 | v1 | v2 |
|---|---|---|
| 配布 | pip / pipx / 各種パッケージマネージャ | **公式 bundled installer のみサポート** |
| IAM Identity Center (旧 SSO) | 限定的 | フル対応（`aws configure sso`） |
| auto-prompt | なし | あり（`--cli-auto-prompt`） |
| YAML 出力 | なし | `--output yaml` / `yaml-stream` |
| `aws ddb` / 他高レベルコマンド | なし | あり |
| Python 依存 | システムの Python が必要 | バイナリに同梱 |

新規プロジェクトは必ず v2。v1 は段階的に EOL。

## インストール

```bash
# 公式 bundled installer（推奨）
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# macOS
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o AWSCLIV2.pkg
sudo installer -pkg AWSCLIV2.pkg -target /

# mise（非公式パッケージだが実用上の取り回しが良い）
mise use awscli

# Homebrew（同上）
brew install awscli
```

> **注意**: 公式は brew / apt / yum のような OS パッケージマネージャを「unsupported」と明記している。安定性が必要な CI では bundled installer を使う。

`aws --version` で `aws-cli/2.x.y` を確認。

## 認証

複数の認証ソースを **明確な順位**でチェーンする:

1. CLI フラグ（`--profile` / `--region`）
2. 環境変数（`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_PROFILE` / `AWS_REGION`）
3. `~/.aws/credentials` の `[<profile>]`
4. `~/.aws/config` の `[profile <profile>]` の `credential_process` / SSO 設定
5. EC2 インスタンスメタデータ (IMDSv2) / ECS タスクロール / EKS pod identity

### `aws configure`（長期キーの設定）

```bash
aws configure --profile dev
# AWS Access Key ID:
# AWS Secret Access Key:
# Default region name [us-east-1]:
# Default output format [json]:
```

長期キーはローカル開発以外では避ける。

### IAM Identity Center（SSO）

```bash
aws configure sso
# SSO start URL: https://my-org.awsapps.com/start
# SSO Region: us-east-1
# Account: 123456789012
# Role: PowerUserAccess

aws sso login --profile sso-dev
aws sts get-caller-identity --profile sso-dev
```

`~/.aws/config`:

```ini
[profile sso-dev]
sso_session = my-org
region = us-east-1

[sso-session my-org]
sso_start_url = https://my-org.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access
```

セッションは数時間〜十数時間で切れる。`aws sso login` で再取得。

### `assume-role`

```ini
[profile prod]
role_arn = arn:aws:iam::987654321098:role/Admin
source_profile = sso-dev
mfa_serial = arn:aws:iam::123456789012:mfa/alice
```

`source_profile` の credentials を使って `prod` の role を assume する。`mfa_serial` があれば実行時に MFA コードを聞かれる。

### `credential_process`

外部コマンドが credentials JSON を返す方式。aws-vault や 1Password CLI と組み合わせる:

```ini
[profile vault-dev]
credential_process = aws-vault exec dev --json
```

長期キーをディスクに置かずに済むので推奨。

### EC2 / ECS / EKS の自動認証

| 環境 | 取得元 |
|---|---|
| EC2 | IMDSv2（`http://169.254.169.254/latest/api/token`） |
| ECS task | `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` |
| EKS pod | `AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN` |
| Lambda | 自動（環境変数として注入） |

`aws sts get-caller-identity` で「いま誰として動いているか」を確認するのが最初の動作確認。

## Profile / Region の優先順位

```text
--profile / --region フラグ        ← 最優先
↓
AWS_PROFILE / AWS_REGION           ← 環境変数
↓
AWS_DEFAULT_PROFILE / AWS_DEFAULT_REGION   ← 旧名（互換）
↓
~/.aws/config の [default]
```

CI で `AWS_PROFILE` を設定しているのに `--profile prod` で上書きされる、といった事故は優先順位の理解で防げる。

## 出力フォーマットと `--query`

```bash
aws ec2 describe-instances --output json     # 既定
aws ec2 describe-instances --output yaml
aws ec2 describe-instances --output text     # tab 区切り
aws ec2 describe-instances --output table    # 人間可読
aws s3api head-bucket --bucket b --output off    # stdout 抑制（exit code のみ）
```

`AWS_DEFAULT_OUTPUT=json` で固定可能。

`--query` は JMESPath:

```bash
# instance ID の配列だけ取得
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].InstanceId' \
  --output text

# 名前と AZ で表
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].{Name:Tags[?Key==`Name`]|[0].Value, AZ:Placement.AvailabilityZone, Id:InstanceId}' \
  --output table
```

`--output text` 時は **paginate ごとに `--query` が走る**ため、結果がページ境界で乱れる。安全のため `text` には `--no-paginate` か JMESPath 側で `[0]` のような絞り込みを併用する。

## ページネーション

| フラグ | 用途 |
|---|---|
| `--no-paginate` | 単一レスポンスで終了（最大件数まで） |
| `--max-items N` | 取得上限 |
| `--page-size N` | 1 ページのサイズ |
| `--starting-token TOK` | 再開トークン |
| `--no-cli-pager` | less 等の pager を起動しない |

CI / スクリプトでは **`--no-cli-pager`** をデフォルト化（`AWS_PAGER=""` でも可）。pager が起動して固まる事故が頻発する。

## よく使うサービスコマンド

### S3

```bash
aws s3 ls s3://my-bucket/
aws s3 cp file.tar.gz s3://my-bucket/
aws s3 sync ./dist s3://my-bucket/dist/ --delete
aws s3 rm s3://my-bucket/file.tar.gz

# 低レベル API（細かい制御）
aws s3api put-object --bucket my-bucket --key file --body file
aws s3api list-objects-v2 --bucket my-bucket --prefix logs/
```

`aws s3` は高レベル（並列・進捗表示・差分転送）、`aws s3api` は API 1:1。**用途で使い分ける**。

### IAM / STS

```bash
aws sts get-caller-identity
aws iam list-users
aws iam create-role --role-name R --assume-role-policy-document file://trust.json
aws iam simulate-principal-policy --policy-source-arn <arn> --action-names s3:PutObject --resource-arns <bucket-arn>
```

### Secrets Manager / SSM Parameter Store

```bash
# 秘密値の取得
aws secretsmanager get-secret-value --secret-id prod/db --query SecretString --output text

# Parameter Store
aws ssm get-parameter --name /app/api-key --with-decryption --query Parameter.Value --output text
aws ssm put-parameter --name /app/version --value "1.2.3" --type String --overwrite
```

### CloudWatch Logs

```bash
# tail（v2 のみ）
aws logs tail /aws/lambda/my-fn --follow --since 10m --format short

# フィルタ
aws logs filter-log-events --log-group-name /aws/lambda/my-fn --filter-pattern '?ERROR ?WARN'
```

### ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
aws ecr describe-repositories
aws ecr list-images --repository-name my-app
```

### EC2 / ECS

```bash
aws ec2 describe-instances --filters "Name=tag:Env,Values=prod"
aws ec2 start-instances --instance-ids i-0123456789abcdef0
aws ecs update-service --cluster c --service s --force-new-deployment
aws ecs execute-command --cluster c --task <task-id> --container app --interactive --command bash
```

## CI でのパターン

```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789012:role/CIDeploy
    aws-region: us-east-1
- env:
    AWS_PAGER: ""
  run: |
    aws sts get-caller-identity
    aws s3 sync ./dist s3://my-bucket/
```

`aws-actions/configure-aws-credentials` は **OIDC** で短命 credentials を取得（`role-to-assume` + `permissions: id-token: write`）。`NPM_TOKEN` 並みに「**長期キーを CI に置かない**」が現代の作法（`standards/npm-trusted-publishers.md` と同思想）。

## AI エージェントがよくやるミス

1. **`AWS_DEFAULT_REGION` 未設定で意図しないリージョン** — `~/.aws/config` の default を信頼すると環境差が出る。CI では明示
2. **`--profile` と `AWS_PROFILE` の優先順位を忘れる** — フラグが勝つ。逆に環境変数で固定したい時は `unset AWS_PROFILE` 等で整理
3. **`aws sso login` 切れに気づかず操作続行** — 401 / `ExpiredToken` エラーで頻発。CI なら `aws sts get-caller-identity` を最初のステップで呼ぶ
4. **`aws s3 cp` と `aws s3api` の使い分けミス** — ディレクトリ同期は `aws s3 sync`、メタデータ細かく触るなら `s3api put-object` 系
5. **`--query` の JMESPath 配列インデックス** — `[0]` の位置で結果が変わる。`Reservations[*].Instances[*]` と `Reservations[].Instances[]` の挙動差を試す
6. **`--output text` で `--query` がページ境界で壊れる** — `--no-paginate` または JSON で受けて `jq` で処理
7. **CI で `aws s3 ls` が pager で詰まる** — `AWS_PAGER=""` か `--no-cli-pager`
8. **長期キーをコミット** — `git secrets` / `gitleaks` で防御。Trusted Publishers / OIDC / aws-vault に移行
9. **`assume-role` のチェーンが長すぎてセッション切れ** — `duration_seconds` を明示、または source profile を中間に置かない設計に
10. **`--no-verify-ssl` を本番で常用** — プロキシ用の一時回避は許容、本番では証明書バンドル設定 (`AWS_CA_BUNDLE`)

## 関連

- [`tools/jq.md`](jq.md) — `--output json` の後処理
- [`tools/yq.md`](yq.md) — `--output yaml` の後処理
- [`standards/npm-trusted-publishers.md`](../standards/npm-trusted-publishers.md) — OIDC 短命 credentials の同思想
- [`platforms/github-actions.md`](../platforms/github-actions.md) — `configure-aws-credentials` の使い方

## 参考

- [AWS CLI v2 User Guide](https://docs.aws.amazon.com/cli/latest/userguide/)
- [AWS CLI Command Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html)
- [aws/aws-cli (GitHub)](https://github.com/aws/aws-cli)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
- [aws-vault](https://github.com/99designs/aws-vault)
