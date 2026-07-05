---
reviewed: 2026-06-07
tags: [ai-workflow, methodology, github]
---

# Invoking AI agent CLIs from CI (billing and terms of service)

Summarizes the authentication methods, **whether extra charges apply**, and **terms-of-service compliance** when invoking Claude Code / Codex CLI / Gemini CLI / GitHub Copilot CLI on demand from CI such as GitHub Actions (PR review, auto-fix, etc.). For scheduled execution (cron / Routines / `/loop`), see `ai/practice/scheduled-tasks.md`; for per-CLI specifics, see the `ai/agents/` directory.

The organizing question is "can this be used without incurring extra charges beyond the contracted subscription fee (API metered usage, exceeding the premium request quota, Vertex metered usage)?" The bottom line: **Gemini and Copilot can run CI automation cleanly within subscription quota including terms compliance; Codex is fine via the vendor-managed cloud; Claude has no strong path to using subscription quota from self-hosted CI.**

## Three execution patterns

Methods for invoking from CI fall broadly into three categories, differing in billing and terms characteristics.

| Pattern | Execution location | Billing | Terms |
|---|---|---|---|
| A. Vendor-managed cloud integration | Provider side | **Included in subscription (no extra)** | OK (official feature) |
| B. Official Action on self-hosted runner + API/usage key | Self-hosted GHA runner | **Metered billing** | OK |
| C. Bringing subscription credentials into self-hosted CI | Self-hosted GHA runner | Subscription quota | Not OK, likely violates consumer terms |

Pattern C (bringing in Codex's `auth.json`, using Claude's subscription OAuth token in CI) "technically works" but runs afoul of prohibition clauses in both vendors' consumer terms (details below). **If you want to avoid extra charges, aim for A, not C**, as the basic policy.

## Billing/terms summary (comparison of 4 CLIs)

| CLI | Official zero-extra-charge route | Metered route | Bringing subscription credentials into CI |
|---|---|---|---|
| **Gemini** | AI Studio API key free tier / Code Assist license | Vertex AI + WIF | (personal OAuth is not supported in CI) |
| **Copilot** | Token with Copilot permissions + within monthly premium request quota | Amount over quota | GitHub official auth = terms-compliant |
| **Codex** | Codex Cloud `@codex` integration (included in ChatGPT plan) | `openai/codex-action` + API key | Not OK — bringing in `auth.json` violates terms |
| **Claude** | (no applicable route for self-hosted CI) | API key / Bedrock / Vertex | Not OK — using OAuth token in CI is out of terms |

## Claude Code

Official Action `anthropics/claude-code-action@v1`. Invoked via `@claude` mentions; the quickstart is `/install-github-app` inside Claude Code (for repo admins).

### Authentication and billing

| Input | Authentication | Billing |
|---|---|---|
| `anthropic_api_key` | Direct Anthropic API key | Metered |
| `claude_code_oauth_token` | Subscription OAuth token (exists as an input) | Subscription quota, but **out of terms** (see below) |
| `anthropic_federation_rule_id` etc. | Anthropic Workload Identity Federation (keyless) | Metered |
| `use_bedrock: "true"` | AWS Bedrock (OIDC, `id-token: write`) | AWS billing |
| `use_vertex: "true"` | Google Vertex AI (WIF) | GCP billing |

Minimal configuration (API key):

```yaml
name: Claude
on:
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write
jobs:
  claude-response:
    runs-on: ubuntu-latest
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

For Bedrock / Vertex, authenticate first with `aws-actions/configure-aws-credentials@v4` / `google-github-actions/auth@v2`, set `use_bedrock` / `use_vertex`, and specify the model with `claude_args: '--model <id>'`. Put the current-generation model string (Sonnet 4.6 / Opus 4.8 family) in `<id>`. The exact string notation differs between Bedrock and Vertex, so check each provider's model catalog and `docs/cloud-providers.md` (a fixed example would go stale quickly, so none is reproduced here).

**Claude has no official route to run self-hosted CI on subscription quota.** If you want background execution on subscription quota, Anthropic Cloud's Routines (`ai/practice/scheduled-tasks.md`) is the applicable option; for self-hosted GitHub Actions, API key / Bedrock / Vertex (metered) is the official approach.

## Codex CLI

**Codex Cloud is the only route with zero extra charge and terms compliance** that lets you automate GitHub within subscription quota. For self-hosted runners, use an API key (metered).

### A. Codex Cloud `@codex` integration (subscription-included, recommended)

A GitHub-native integration executed by OpenAI-managed cloud. Get started by simply connecting your GitHub account at `chatgpt.com/codex`.

- **Supported plans**: ChatGPT Plus / Pro / Business / Edu / Enterprise (official: "Access is included with ... not through OpenAI API keys.") → **no API charges**
- **Invocation**: `@codex review` in a PR comment (manual), enable auto-review in settings, or `@codex fix the P1 issue` to fix
- **Review policy**: flags only P0/P1 by default. Respects the `Review guidelines` section of `AGENTS.md`
- **Environments** (`/codex/cloud/environments`): configure the repo, setup script (installing dependencies such as pnpm), internet access (enabled by default only during the setup phase; disabled by default during the agent phase), and secrets (encrypted, accessible only from the setup script). Container state is cached for up to 12h

### B. `openai/codex-action@v1` (self-hosted runner, metered)

```yaml
name: Codex pull request review
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  codex:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v5
      - uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          prompt-file: .github/codex/prompts/review.md
```

Authentication is via `openai-api-key` (`OPENAI_API_KEY`) = **API metered billing**. Key inputs are `prompt` / `prompt-file`, `safety-strategy` (default `drop-sudo`, `unsafe` on Windows), and `sandbox` (`workspace-write` / `read-only` / `danger-full-access`). Linux / macOS runners recommended.

### C. Bringing in `auth.json` (not recommended)

Turning the `~/.codex/auth.json` generated by ChatGPT sign-in into a Secret and writing it back into CI runs on subscription quota, but in addition to violating terms (see below), it is unstable because the access token expires (CI is volatile and the refreshed token isn't written back). **No reason to use this since A can replace it.**

## Gemini CLI

Official Action `google-github-actions/run-gemini-cli` (migrated from the former `google-gemini/run-gemini-cli`; the old slug 404s). Billing and backend switch depending on the authentication method.

| Input | Authentication | Billing |
|---|---|---|
| `gemini_api_key: ${{ secrets.GEMINI_API_KEY }}` | AI Studio API key | **No extra charge within the free tier** (metered beyond it. The free tier — AI Studio / unpaid quota — has its submitted content used for Google's product improvement. Paid / Vertex is exempt; see the Gemini API Terms below) |
| `use_gemini_code_assist: true` (`GOOGLE_GENAI_USE_GCA`) | Gemini Code Assist license | Flat monthly fee (no token billing) |
| `use_vertex_ai: true` + `gcp_workload_identity_provider` + `gcp_project_id` | Vertex AI + WIF | Metered |

```yaml
- uses: google-github-actions/run-gemini-cli@v0
  with:
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

Personal Google account OAuth is not headless-compatible and cannot be used in CI. **To aim for zero extra charge, use the AI Studio free tier or a Code Assist license.** API keys are also terms-compliant, being an authentication method designed for automated access.

## GitHub Copilot CLI

Runs `copilot` non-interactively in GitHub Actions. Each invocation consumes a **premium request**; no extra charge as long as it's within the plan's monthly quota.

- **Billing** (official): "each time you use Copilot CLI programmatically, your monthly quota of Copilot premium requests is reduced by one" (multiplied by a per-model multiplier). Consumes the plan's (Pro / Pro+ / Business / Enterprise) monthly premium request quota — **no extra charge within quota**, metered beyond it (a Spending Limit is recommended). GitHub Actions runtime minutes are also consumed separately
- **Non-interactive execution**: flags such as `--allow-all-tools` (automating tool approval) avoid interaction, passing the prompt as an argument
- **Authentication**: the auto-issued `GITHUB_TOKEN` does not include Copilot permissions, so a token (e.g. a PAT) from an account with Copilot enabled is required. Check GitHub's latest documentation for the exact environment variable name and required permissions to pass to CI
- **Terms**: because this is official authentication via a GitHub account/token, it does not amount to "diverting consumer credentials" the way Codex/Claude's approach does, and is comparatively clean

## Terms of service (primary sources)

The pattern of bringing subscription credentials into self-hosted CI (Codex `auth.json` / Claude OAuth token) falls under prohibition clauses in both vendors' consumer terms.

### OpenAI — Terms of Use (Effective: 2026-01-01)

- **Registration and access**: "You may not share your account credentials or make your account available to anyone else"
- **Using our Services** (prohibited conduct): "Automatically or programmatically extract data or Output" / "sell or distribute any of our Services"

→ Placing `auth.json` in shared CI = sharing credentials, and obtaining output from CI via subscription auth = programmatic extraction — both apply.

### Anthropic — Consumer Terms (Effective: 2025-10-08)

- §2: "You may not share your Account login information, Anthropic API key, or Account credentials with anyone else." / "You also may not make your Account available to anyone else."
- §3 (Prohibited): "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."

In addition, Anthropic's Legal and compliance page ([OAuth vs. API key usage](https://code.claude.com/docs/en/legal-and-compliance)) explicitly states that OAuth authentication is intended solely for "ordinary use of Claude Code and other native Anthropic apps," and that **building products/services (including with the Agent SDK) should use API key authentication**. GitHub Actions / self-hosted CI fall outside the former scope — API key is the official approach.

## Recommendation

Order that best balances zero extra charge with terms compliance:

1. **Gemini CLI** — AI Studio free tier or Code Assist flat rate. API key auth is terms-clean and the quickest to set up
2. **Copilot CLI** — PAT + within premium request quota. Clean via official GitHub auth, and pairs well with GitHub-centric workflows
3. **Codex Cloud `@codex`** — included in ChatGPT plan, terms-compliant. However this runs on OpenAI's cloud, not a self-hosted runner

Choosing based on contracted assets: already paying for ChatGPT → Codex Cloud; already contracted for Copilot → Copilot CLI + PAT; leaning Google → Gemini; **Claude Max only → there is no clever trick for zero-extra-charge, terms-compliant self-hosted CI** (substitute with Routines, or accept API metered billing for GitHub Actions).

## Common mistakes AI agents make

1. **Bringing subscription credentials into self-hosted CI** — Codex `auth.json` / Claude OAuth tokens technically work but violate terms. Codex should use Codex Cloud `@codex`; Claude should use API/Bedrock/Vertex
2. **Using the auto-issued `GITHUB_TOKEN` for Copilot** — this doesn't work since it lacks Copilot permissions. Use a token from an account with Copilot enabled
3. **Trying to run Gemini in CI with personal OAuth** — not headless-compatible. Use API key, Code Assist, or Vertex+WIF
4. **Conflating "runs on subscription" with "free and compliant"** — billing (whether it consumes quota or is metered) and terms (whether the use is permitted) are separate axes. Check both

## References

- [OpenAI Codex Cloud](https://developers.openai.com/codex/cloud) / [Codex GitHub integration](https://developers.openai.com/codex/integrations/github) / [Codex GitHub Action](https://developers.openai.com/codex/github-action)
- [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)
- [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) (`docs/setup.md` / `docs/cloud-providers.md`)
- [Anthropic Consumer Terms](https://www.anthropic.com/legal/consumer-terms) / [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- [google-github-actions/run-gemini-cli](https://github.com/google-github-actions/run-gemini-cli) / [Gemini Code Assist pricing](https://cloud.google.com/products/gemini/code-assist) / [Gemini API Terms (data-use difference between free/paid)](https://ai.google.dev/gemini-api/terms)
- [About GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli) / [Requests in GitHub Copilot](https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests)
- Related: `ai/practice/scheduled-tasks.md` / `ai/agents/claude-code.md` / `ai/agents/codex-cli.md` / `ai/agents/gemini-cli.md` / `ai/agents/github-copilot-cli.md`
