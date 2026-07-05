---
reviewed: 2026-05-04
tags: [data-cli, cloud-hosted, aws, python]
---

# AWS CLI

AWS's official command-line tool. `aws-cli/2.x` (v2) is current; v1 does not receive new-feature backports (IAM Identity Center, auto-prompt, etc. are v2-only). It can invoke every AWS API from the CLI, but the combination of profile / region / credential chain / output format makes unintended behavior easy to trigger. It's a common foundational tool for AI agents operating S3 / IAM / ECR / Logs / SSM and more.

Official: [docs.aws.amazon.com/cli/latest/userguide](https://docs.aws.amazon.com/cli/latest/userguide/) / [API Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html)

## Differences between v1 and v2

| Aspect | v1 | v2 |
|---|---|---|
| Distribution | pip / pipx / various package managers | **only the official bundled installer is supported** |
| IAM Identity Center (formerly SSO) | Limited | Full support (`aws configure sso`) |
| auto-prompt | None | Available (`--cli-auto-prompt`) |
| YAML output | None | `--output yaml` / `yaml-stream` |
| `aws ddb` / other high-level commands | None | Available |
| Python dependency | Requires system Python | Bundled into the binary |

New projects should always use v2. v1 is being phased toward EOL.

## Installation

```bash
# Official bundled installer (recommended)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install

# macOS
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o AWSCLIV2.pkg
sudo installer -pkg AWSCLIV2.pkg -target /

# mise (unofficial package, but convenient in practice)
mise use awscli

# Homebrew (same caveat)
brew install awscli
```

> **Note**: The vendor explicitly states OS package managers like brew / apt / yum are "unsupported." Use the bundled installer for CI where stability matters.

Confirm with `aws --version`, which should show `aws-cli/2.x.y`.

## Authentication

Multiple credential sources are chained with a **clear precedence order**:

1. CLI flags (`--profile` / `--region`)
2. Environment variables (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` / `AWS_PROFILE` / `AWS_REGION`)
3. `[<profile>]` in `~/.aws/credentials`
4. `credential_process` / SSO settings under `[profile <profile>]` in `~/.aws/config`
5. EC2 instance metadata (IMDSv2) / ECS task role / EKS pod identity

### `aws configure` (setting long-term keys)

```bash
aws configure --profile dev
# AWS Access Key ID:
# AWS Secret Access Key:
# Default region name [us-east-1]:
# Default output format [json]:
```

Avoid long-term keys outside local development.

### IAM Identity Center (SSO)

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

Sessions expire after a few to a dozen or so hours. Re-acquire with `aws sso login`.

### `assume-role`

```ini
[profile prod]
role_arn = arn:aws:iam::987654321098:role/Admin
source_profile = sso-dev
mfa_serial = arn:aws:iam::123456789012:mfa/alice
```

Assumes the `prod` role using credentials from `source_profile`. If `mfa_serial` is set, an MFA code is prompted for at runtime.

### `credential_process`

An approach where an external command returns credentials as JSON. Combine with aws-vault or the 1Password CLI:

```ini
[profile vault-dev]
credential_process = aws-vault exec dev --json
```

Recommended since it avoids placing long-term keys on disk.

### Automatic authentication on EC2 / ECS / EKS

| Environment | Source |
|---|---|
| EC2 | IMDSv2 (`http://169.254.169.254/latest/api/token`) |
| ECS task | `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` |
| EKS pod | `AWS_WEB_IDENTITY_TOKEN_FILE` + `AWS_ROLE_ARN` |
| Lambda | Automatic (injected as environment variables) |

`aws sts get-caller-identity` is the first sanity check to confirm "who am I currently acting as."

## Profile / region precedence

```text
--profile / --region flags        ← highest precedence
↓
AWS_PROFILE / AWS_REGION           ← environment variables
↓
AWS_DEFAULT_PROFILE / AWS_DEFAULT_REGION   ← legacy names (compat)
↓
[default] in ~/.aws/config
```

Incidents like "`AWS_PROFILE` is set in CI but gets overridden by `--profile prod`" are avoidable once you understand this precedence.

## Output formats and `--query`

```bash
aws ec2 describe-instances --output json     # default
aws ec2 describe-instances --output yaml
aws ec2 describe-instances --output text     # tab-separated
aws ec2 describe-instances --output table    # human-readable
aws s3api head-bucket --bucket b --output off    # suppress stdout (exit code only)
```

Can be fixed with `AWS_DEFAULT_OUTPUT=json`.

`--query` uses JMESPath:

```bash
# get only the array of instance IDs
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].InstanceId' \
  --output text

# a table of name and AZ
aws ec2 describe-instances \
  --query 'Reservations[*].Instances[*].{Name:Tags[?Key==`Name`]|[0].Value, AZ:Placement.AvailabilityZone, Id:InstanceId}' \
  --output table
```

With `--output text`, **`--query` runs per pagination page**, so results can be garbled across page boundaries. For safety, combine `text` with `--no-paginate`, or narrow with JMESPath (e.g. `[0]`).

## Pagination

| Flag | Purpose |
|---|---|
| `--no-paginate` | Stop after a single response (up to the max item count) |
| `--max-items N` | Cap on items fetched |
| `--page-size N` | Size of a single page |
| `--starting-token TOK` | Resume token |
| `--no-cli-pager` | Don't launch a pager like `less` |

Default to **`--no-cli-pager`** in CI / scripts (or `AWS_PAGER=""`). A launched pager hanging the process is a frequent incident.

## Commonly used service commands

### S3

```bash
aws s3 ls s3://my-bucket/
aws s3 cp file.tar.gz s3://my-bucket/
aws s3 sync ./dist s3://my-bucket/dist/ --delete
aws s3 rm s3://my-bucket/file.tar.gz

# low-level API (fine-grained control)
aws s3api put-object --bucket my-bucket --key file --body file
aws s3api list-objects-v2 --bucket my-bucket --prefix logs/
```

`aws s3` is high-level (parallelism, progress display, delta transfer), `aws s3api` maps 1:1 to the API. **Choose based on the use case**.

### IAM / STS

```bash
aws sts get-caller-identity
aws iam list-users
aws iam create-role --role-name R --assume-role-policy-document file://trust.json
aws iam simulate-principal-policy --policy-source-arn <arn> --action-names s3:PutObject --resource-arns <bucket-arn>
```

### Secrets Manager / SSM Parameter Store

```bash
# retrieve a secret value
aws secretsmanager get-secret-value --secret-id prod/db --query SecretString --output text

# Parameter Store
aws ssm get-parameter --name /app/api-key --with-decryption --query Parameter.Value --output text
aws ssm put-parameter --name /app/version --value "1.2.3" --type String --overwrite
```

### CloudWatch Logs

```bash
# tail (v2 only)
aws logs tail /aws/lambda/my-fn --follow --since 10m --format short

# filter
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

## Patterns in CI

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

`aws-actions/configure-aws-credentials` obtains short-lived credentials via **OIDC** (`role-to-assume` + `permissions: id-token: write`). "**Don't put long-term keys in CI**" is the modern practice, on par with `NPM_TOKEN` (the same philosophy as `standards/npm-trusted-publishers.md`).

## Common mistakes AI agents make

1. **Unintended region due to missing `AWS_DEFAULT_REGION`** — relying on the default in `~/.aws/config` causes environment drift. Set it explicitly in CI
2. **Forgetting the precedence between `--profile` and `AWS_PROFILE`** — the flag wins. Conversely, to pin via environment variable, clean up with `unset AWS_PROFILE` etc.
3. **Continuing operations without noticing `aws sso login` expired** — frequently manifests as 401 / `ExpiredToken` errors. In CI, call `aws sts get-caller-identity` as the first step
4. **Mixing up `aws s3 cp` and `aws s3api`** — use `aws s3 sync` for directory sync, `s3api put-object` family for fine-grained metadata control
5. **`--query` JMESPath array indexing** — results change depending on where `[0]` is placed. Test the behavioral difference between `Reservations[*].Instances[*]` and `Reservations[].Instances[]`
6. **`--output text` breaking `--query` across page boundaries** — use `--no-paginate`, or receive JSON and process with `jq`
7. **`aws s3 ls` hanging on a pager in CI** — use `AWS_PAGER=""` or `--no-cli-pager`
8. **Committing long-term keys** — guard with `git secrets` / `gitleaks`. Migrate to Trusted Publishers / OIDC / aws-vault
9. **`assume-role` chains too long, causing session expiry** — set `duration_seconds` explicitly, or avoid designs that place a source profile in the middle of a long chain
10. **Routinely using `--no-verify-ssl` in production** — a temporary workaround for proxies is acceptable, but production should configure a certificate bundle (`AWS_CA_BUNDLE`)

## Related

- [`tools/jq.md`](../../tools/jq.md) — post-processing `--output json`
- [`tools/yq.md`](../../tools/yq.md) — post-processing `--output yaml`
- [`standards/npm-trusted-publishers.md`](../../standards/npm-trusted-publishers.md) — same philosophy of short-lived OIDC credentials
- [`platforms/github/github-actions.md`](../github/github-actions.md) — how to use `configure-aws-credentials`

## References

- [AWS CLI v2 User Guide](https://docs.aws.amazon.com/cli/latest/userguide/)
- [AWS CLI Command Reference](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/index.html)
- [aws/aws-cli (GitHub)](https://github.com/aws/aws-cli)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)
- [aws-vault](https://github.com/99designs/aws-vault)
