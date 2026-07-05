---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI Agent Evaluation (Agent Evaluation / eval)

The practice of **quantitatively judging whether an AI agent performs a task correctly and reliably**. Whereas [observability](agentic-observability.md) is about "observing what happens in production," evaluation is the offline side that "judges the quality of observed behavior and feeds it back into improvement." The two connect in a closed loop: "production traces → turning failures into an eval dataset → regression testing."

Agent evaluation differs qualitatively from scoring a single LLM output. Anthropic describes it as "an **audit of the workflow** (rather than scoring a single response), evaluated together with the harness/scaffolding that runs the model as an agent."

## Difference from evaluating a single LLM output

| | Single LLM evaluation | Agent evaluation |
|---|---|---|
| Target | One input/output pair | A multi-step execution history (tools, reasoning, retries) |
| Perspective | Output quality | Both **outcome** (final environment state) and **trajectory** |
| Nature | Relatively deterministic | Non-deterministic — results vary even for the same task |

### Outcome evaluation vs trajectory evaluation

- **Outcome (final state)**: judged not by an utterance like "I made the reservation" but by **whether a reservation record actually exists on the environment side (e.g., the DB)**. Suited to verifying business goals
- **Trajectory (process)**: looks at the process of tool calls, reasoning, and handoffs. Suited to debugging and improvement
- Outcome alone can miss "corrupt success" — reaching the correct result by accident via an invalid path. The current consensus is to **evaluate both simultaneously**

## Evaluation methods (3 types of grader)

Anthropic classifies graders into three types. The standard approach is to combine all three layers to optimize cost-effectiveness:

| Grader | Description | Pros / cons |
|---|---|---|
| **Code-based / programmatic** | Unit tests, exact match, static analysis | Fast and reproducible / brittle to correct variations |
| **Model-based (LLM-as-judge)** | Rubric scoring, pairwise comparison | Handles subjective tasks / requires calibration against human judgment |
| **Human** | Expert review, A/B testing | Gold standard / high cost, low speed |

> Anthropic emphasizes that "**you can't tell whether a grader is working correctly without actually reading the transcript**." Continuously verifying the automated graders themselves by hand is essential.

### LLM-as-judge bias and mitigation

Main biases: position / verbosity / self-preference / format / calibration drift.

- **Position bias**: in pairwise comparisons, **randomize the order every time**, evaluate both orderings, and treat order-dependent judgments as a tie (swap-and-average) — this substantially reduces the bias
- Use pointwise (absolute score) and pairwise (relative comparison) appropriately, and also distinguish single-turn/multi-turn and reference-based/reference-free

## Metric design: pass@k and pass^k

Because of non-determinism, a single-run accuracy rate is insufficient. The two metrics tell **opposite stories**:

- **pass@k** — the probability of succeeding at least once in k attempts. Measures **capability (what's possible)**
- **pass^k** — the probability of succeeding in all k attempts. Measures **consistency / reliability**

In τ-bench, pass@k can be nearly 100% while pass^k drops sharply (e.g., GPT-4o scores pass^8 < 25% on τ-retail). Choose the metric based on production requirements (is solving it once enough, or must it succeed every time?). Also use outcome metrics (goal verification) and trajectory metrics (debugging) together.

## The closed loop between offline eval and online monitoring

```text
Production trace ─▶ Annotate failure ─▶ Build eval dataset ─▶ Improve prompt/tools via eval ─▶ Regression test
      ▲                                                                          │
      └──────────────────────── Improvement generates new traces ◀────────────────────┘
```

It has become common practice to add problematic traces to an eval dataset "with one click," **turning production failures into permanent regression tests**. Fast iteration via automated eval before launch and real-world failure detection via production monitoring are **each insufficient alone** — combine them.

## Major benchmarks

They measure different things and should not be collapsed into a single ranking:

| Benchmark | What it measures |
|---|---|
| **SWE-bench / SWE-bench Verified** | Generating patches that solve real GitHub issues. Verified against the repository's own tests. Verified is a human-verified 500-task subset |
| **τ-bench (tau-bench)** | Retail / airline customer support. Compares the DB state at conversation end against the goal. Uses pass^k to measure reliability |
| **GAIA** | A general-purpose assistant using multiple tools plus multi-step reasoning. Designed to be easy for humans and hard for LLMs |
| **WebArena** | Browser-operation tasks on websites that reproduce real functionality (long-horizon autonomy) |
| **AgentBench** | Agent capability across 8 environments including OS / DB / knowledge graph / games |
| **BFCL (Berkeley Function Calling Leaderboard)** | Function (tool) calling accuracy. As the version evolves, v4 also covers agentic evaluation and irrelevance detection |

> Public benchmarks carry a risk of **training-data contamination**. A company-specific eval dataset is important for guaranteeing production quality.

## Evaluation tools / frameworks

Practice tends to converge on a two-pronged setup: "**lightweight frameworks for CI/CD gates**" plus "**platforms for human annotation, regression tracking, and dashboards**":

| Tool | Type | Characteristics |
|---|---|---|
| **OpenAI Evals** | OSS | Reference eval harness + registry |
| **DeepEval** (Confident AI) | OSS (Apache-2.0) | 50+ metrics, pytest integration, geared toward CI/CD gates |
| **Ragas** | OSS (Apache-2.0) | Standard for RAG evaluation (faithfulness / context precision & recall) |
| **Promptfoo** | OSS | Lightweight CI gate |
| **LangSmith** | SaaS | Traces + eval, full multi-turn conversation evaluation |
| **Braintrust** / **Arize Phoenix** / **Langfuse** | SaaS / OSS | Regression tracking, human annotation, [observability](agentic-observability.md) integration |

## Best practices

- **Start small** — don't wait for a comprehensive suite; start with **20-50 tasks drawn from real failures**. Turn manual tests directly into test cases
- **Create unambiguous references** — tasks with correct answers that experts would reach identically
- **Balance positive / negative examples** — prevents one-sided optimization
- **Keep calibrating graders against human judgment** — always read transcripts by hand and verify the automated graders themselves
- **Confirm the task is one "a competent agent could actually solve"** — unsolvable or broken tasks provide no signal
- **Avoid contamination with company-specific evals** — don't over-trust public benchmark scores

## Anti-patterns

- **Scoring only the final output** — misses corrupt success. Also look at trajectory
- **Judging by single-run accuracy** — ignores non-determinism. Measure reliability with pass^k
- **Trusting LLM-as-judge at face value** — without mitigating position/verbosity bias or doing human verification
- **Separating production monitoring from eval** — failure traces never become regression tests, so the same bug recurs

## References

- Anthropic: [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) (outcome vs transcript, the 3 grader types, pass@k / pass^k)
- Anthropic: [Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) / [Bloom (behavioral evaluation OSS)](https://www.anthropic.com/research/bloom)
- [SWE-bench Verified (OpenAI)](https://openai.com/index/introducing-swe-bench-verified/) / [τ-bench paper arXiv:2406.12045](https://arxiv.org/pdf/2406.12045) / [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html)
- Tools: [OpenAI Evals](https://github.com/openai/evals) / [DeepEval](https://deepeval.com/) / [Ragas](https://docs.ragas.io/) / [LangChain: Agent Observability](https://www.langchain.com/resources/agent-observability)
- Related: [AI Agent Observability](agentic-observability.md), [Loop Engineering](loop-engineering.md), [Agentic Workflow Patterns](agentic-workflow-patterns.md), [Human-in-the-Loop](human-in-the-loop.md)
