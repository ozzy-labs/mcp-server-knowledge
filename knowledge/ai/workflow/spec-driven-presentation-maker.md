---
reviewed: 2026-06-07
tags: [ai-workflow, spec, oss, aws, python]
aliases: [sdpm, sample-spec-driven-presentation-maker]
---

# Spec-Driven Presentation Maker

An OSS **spec-driven presentation generation toolkit** published by AWS Samples (`aws-samples/sample-spec-driven-presentation-maker`, MIT-0). It applies the SDD idea of "**decide what to convey (spec) first, let AI decide how to show it (slide)**" to presentation creation. Built as **4 layers** — Agent Skill / local MCP / remote MCP on Amazon Bedrock AgentCore Runtime / React Web UI — so you adopt only the layers you need.

Official: [github.com/aws-samples/sample-spec-driven-presentation-maker](https://github.com/aws-samples/sample-spec-driven-presentation-maker) / [Workshop](https://catalog.us-east-1.prod.workshops.aws/workshops/a275330a-0ae0-40b2-ad35-264e263c3882/en-US)

For the overall SDD concept see `ai/practice/spec-driven-development.md`. For OSS in the same space but aimed at **code generation**, see `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md`. This tool differs in that the spec's output target is **not code but `.pptx`**.

## Philosophy

| | Traditional | Spec-Driven |
|---|---|---|
| Starting point | Blank slide | Source (materials, requirements) |
| Design | Think while building | Logical structure fixed as spec first |
| Construction | Manual layout | AI auto-generates following a template |
| Quality | Ad hoc | Reviewable at the spec level |

Rather than a waterfall that "fixes all features up front," it loops through **briefing → outline → art direction → spec persisted → slide-by-slide build → PPTX**.

## 4-Layer Architecture

| Layer | Directory | Purpose | AWS |
|---|---|---|:---:|
| **Layer 1** | `skill/` | Engine + reference + template. Called directly by SKILL.md-compatible agents | Not required |
| **Layer 2** | `skill/` + `mcp-local/` | Local stdio MCP server. Claude Desktop / Claude Cowork, etc. | Not required |
| **Layer 3** | + `mcp-server/` + `infra/` | HTTP MCP with LibreOffice built in (deployed on Amazon Bedrock AgentCore Runtime) | Required |
| **Layer 4** | + `agent/` + `api/` + `web-ui/` | Full stack: Strands Agent + REST API + React Web UI | Required |

Each layer is a thin wrapper around the previous one. It's all in one repository, but the design lets you **set up only the layers your use case needs**.

## Supported Agents / Clients

| Layer | Client used |
|---|---|
| 1 | **Agent Skill-compatible CLIs**: Claude Code / Codex CLI / Cursor / Kiro / VS Code's GitHub Copilot |
| 2 | **Local MCP clients**: Claude Desktop / Claude Cowork / VS Code / Kiro |
| 3 | **Remote-MCP-only clients**: Claude.ai Web (cannot start a local process) |
| 4 | The bundled React Web UI in the browser |

The repository ships with `AGENTS.md` and `CLAUDE.md`, designed so that simply saying "set up this repository" or "make it usable from Claude Desktop as Layer 2" lets the agent pick the right layer and commands and carry out setup itself (an agent-driven "host onboarding," not spec-driven).

## Prerequisites

- Python 3.10+
- [uv](https://docs.astral.sh/uv/getting-started/installation/) (see `languages/python/uv.md`, not `tools/uv.md`)
- If deploying Layers 3-4 directly with local CDK, you additionally need an AWS account + Node.js 18+ + Docker or Finch + AWS CLI

## Quick Start

### Layer 1 (Agent Skill only)

```bash
cd skill
uv sync

# Fetch icons (optional, recommended)
uv run python3 scripts/download_aws_icons.py
uv run python3 scripts/download_material_icons.py

# Sanity check
uv run python3 scripts/pptx_builder.py examples
```

`SKILL.md` + engine + reference (design pattern / workflow / guide) + sample templates (dark / light) are bundled under `skill/`. Copy them into the agent's skill directory, or bring them in via a symlink.

### Layer 2 (local MCP)

```bash
cd mcp-local
uv sync
uv run python server.py
```

Register it in the client's MCP config (`claude_desktop_config.json`, `.vscode/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "spec-driven-presentation-maker": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/mcp-local", "python", "server.py"]
    }
  }
}
```

Once connected, asking the agent to "create a presentation" triggers:

1. Reading the workflow file from the MCP Server Instructions
2. Gathering the topic, audience, and purpose
3. Designing **briefing → outline → art direction** and persisting it to `specs/`
4. Building slides one at a time
5. Outputting the `.pptx` and showing a preview

### Layers 3-4 (AWS deployment)

One-click CloudFormation is provided in **Tokyo / N. Virginia / Oregon**. Running `scripts/deploy.sh` from CloudShell is the recommended path (no need to install CDK/Docker locally; deploys via CodeBuild).

To deploy directly with local CDK:

```bash
cd infra
npm ci
cp config.example.yaml config.yaml
# In config.yaml, choose stacks: data/runtime/agent/webUi
npx cdk deploy --all                                # When using Docker Desktop
CDK_DOCKER=finch npx cdk deploy --all               # When using Finch
CDK_DOCKER=finch npx cdk deploy --all --require-approval never  # CI/CD
```

Deployment takes 15-30 minutes.

## Model Configuration

Default model: **`global.anthropic.claude-sonnet-4-6`** (via Amazon Bedrock). To switch to Opus etc., edit `infra/config.yaml`:

```yaml
model:
  modelId: "global.anthropic.claude-opus-4-6-v1"
```

Avoid the cross-region inference profile when data sovereignty is a requirement. Bedrock Model Invocation Logging can be enabled optionally via `features.enableInvocationLogging: true`.

## Spec / Template Structure

| File | Role |
|---|---|
| `.pptx` | Template. **Any `.pptx`** can be used as a template (layout / colors / fonts / placeholders are auto-parsed) |
| `slides.json` | The presentation spec. A list of slide objects with `type` / `src` / `x` / `y` / `width` / `height` |
| `manifest.json` | Asset metadata (list of icons / images) |
| `config.json` | User settings (output directory, additional asset sources) |
| `.html` | Custom style guide (CSS variables) |

Asset references use the form `"assets:{source}/{name}"` (e.g. `"assets:aws/Lambda"`).

User-local persistent directory:

- macOS / Linux: `~/.config/sdpm/`
- Windows: `%APPDATA%\sdpm\`

Templates / styles / assets survive package updates.

## Use Cases

- **Auto-composition from materials**: generate spec → PPTX end-to-end from URL / PDF / CSV / meeting minutes / industry-specific data as input
- **Template-conformant mass production**: specifying an internal template `.pptx` as the template lets you mass-produce decks with consistent layout, colors, and fonts
- **Teams / Slack integration**: `docs/en/teams-slack-integration.md` documents an operational pattern for handling requests via chat
- **Workshop**: official hands-on covering manufacturing / finance / healthcare / IT industry scenarios building slides from real data

## Differences from Other SDD Tools

| | SDPM | cc-sdd | GitHub Spec Kit | Kiro |
|---|---|---|---|---|
| Output | **`.pptx`** | Code | Code | Code |
| Provider | AWS Samples | OSS (gotalab) | GitHub official | AWS |
| Spec format | `slides.json` + `.pptx` template | EARS + design + tasks | Core template (overridable) | EARS native |
| Deployment form | Skill / local MCP / AWS remote MCP / Web UI | npm package | Python CLI | IDE + CLI |
| Primary LLM | Claude Sonnet 4.6 via Bedrock (changeable) | Depends on the agent | Depends on the agent | Claude Sonnet 4.5 by default |
| Number of agents | 5+ (SKILL.md-compatible + MCP-compatible) | 8 | 40+ | 1 (Kiro alone) |
| License | MIT-0 | MIT | MIT | Commercial |

The biggest difference from the other three tools is that **"what's built spec-driven is a deck, not code."** It shares the SDD methodology but has a distinct engine and output.

## Security

Explicitly documented as "**a demonstration / educational sample, not for production use**." Controls implemented by default:

- S3: public access blocked, SSE-S3, versioning
- DynamoDB: encryption at rest, PITR
- TLS in transit
- API Gateway: Cognito JWT authorizer
- CloudFront: OAI, HTTPS-only, security headers
- IAM: least-privilege (no wildcard resources)

Environment-dependent controls **not included** by default (evaluate as needed):

1. CloudTrail (to avoid conflicting with account-level settings)
2. VPC endpoint (this stack is not deployed inside a VPC)
3. WAF IP allowlist (environment-dependent, configure in `config.yaml`)
4. CORS restriction
5. S3 access logging
6. Cognito MFA / compromised-credentials detection
7. Bedrock cross-region inference profile (avoid if there's a data sovereignty requirement)

## Common Mistakes AI Agents Make

1. **Deploying the full AWS stack when Layer 1 alone would suffice** — with Claude Code / Codex CLI / Cursor / Kiro, the Skill alone works. If you don't need MCP, Layer 2 and above are unnecessary
2. **Asking "build me slides from this" without writing a spec** — output is unstable unless the briefing → outline → art direction workflow runs. Take the path of having the workflow read via the MCP Server Instructions
3. **Assuming any `.pptx` dropped in as a template will just work** — layout / placeholder parsing is automatic, but an extremely custom slide master can fail because no markers are found. Prepare placeholders per `docs/*/custom-template.md`
4. **Expecting Opus without realizing the default model is Sonnet** — set `model.modelId` in `infra/config.yaml` explicitly
5. **Manually trying `pip install` without having the agent read AGENTS.md / CLAUDE.md** — the bundled instruction files are designed to let the agent set things up automatically; that's faster than doing it by hand
6. **Hitting a "Docker not found" error during a Layer 3 deployment** — `CDK_DOCKER=finch` lets you fall back to Finch. Via CloudShell, local Docker isn't needed at all
7. **Running with Cognito MFA / WAF stripped out as if it were production-ready** — any usage beyond the sample stack's assumptions requires a security team review
8. **Still writing asset references as `icons:Lambda`** — backward compatibility is retained, but the current form is `assets:{source}/{name}` (e.g. `assets:aws/Lambda`)
9. **Assuming templates are lost on package reinstall, not knowing about `~/.config/sdpm/`** — they live in the user-local persistent directory, so they aren't lost

## References

- [aws-samples/sample-spec-driven-presentation-maker](https://github.com/aws-samples/sample-spec-driven-presentation-maker)
- [Architecture](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/architecture.md) / [Getting Started](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/getting-started.md) / [Custom Templates](https://github.com/aws-samples/sample-spec-driven-presentation-maker/blob/main/docs/en/custom-template.md)
- [Workshop (industry-specific hands-on)](https://catalog.us-east-1.prod.workshops.aws/workshops/a275330a-0ae0-40b2-ad35-264e263c3882/en-US)
- Related: `ai/practice/spec-driven-development.md` / `ai/workflow/cc-sdd.md` / `ai/workflow/github-spec-kit.md` / `ai/workflow/kiro.md` / `ai/platform/agent-skills-spec.md` / `ai/platform/mcp-protocol.md`
