---
reviewed: 2026-06-28
tags: [ai-workflow, methodology, practice]
---

# AI Agent Memory

The mechanism by which an AI agent **retains conversation and task experience so it can be referenced later**. Whereas [Context Management](ai-context-management.md) addresses "how to optimize the context window (short-term)," this article addresses "**what to persist outside the window, how, and when to read it back**" (long-term). It underpins the State/Memory elements of [Loop Engineering](loop-engineering.md), and is the premise for continuing a loop beyond a single conversation.

## Short-term Memory vs Long-term Memory

| | Short-term memory (working memory) | Long-term memory |
|---|---|---|
| Scope | Within a thread / single session | Persists across multiple threads/sessions |
| Substance | Conversation history within the context window | External store (retrievable from any thread) |
| Lifespan | Reset when the session ends | Persistent (until explicitly deleted) |

### Three categories borrowed from cognitive science (analogy)

Borrowed from the classification of human long-term memory; note this is not a strict mapping but an **analogy** (officially adopted by LangChain / LangMem):

- **Semantic memory** — facts and concepts (user profiles, document collections)
- **Episodic memory** — past experiences and events (dialogue summaries, few-shot examples of successes)
- **Procedural memory** — how to perform tasks (prompts, code, model weights; refined via Reflection)

## Long-term Memory Implementation Approaches

| Approach | Overview |
|---|---|
| **Vector store / embedding search** | Stores memories as documents and retrieves via semantic search. Strong for direct questions |
| **Knowledge graph** | Stores entities (nodes) and relationships (edges). Strong for multi-hop relational queries. **Temporal KGs** (Zep / Graphiti) hold a validity interval per edge, enabling non-destructive updates |
| **Summaries / structured notes** | Retains conversation summaries (Anthropic's structured note-taking) |
| **File-based** | Create/read/update/delete as external files (Anthropic memory tool's `/memories`) |
| **Key-value store** | Hierarchical memory (CrewAI: long-term=SQLite, short-term=ChromaDB+RAG, etc.) |

### Difference from RAG

While RAG generally refers to augmentation via "**static document retrieval**," agent memory is more dynamic in that it "**writes, updates, and consolidates**" dialogue and experience for cross-cutting use (per each vendor's positioning). Direct questions favor vector search, while relationship-traversal queries favor graphs; neither alone is considered sufficient.

## Memory Operations

- **Write** — two modes: *hot path* (generated in real time during execution; immediately usable but adds latency) and *background* (formed asynchronously; lower latency but requires trigger design). Requires extraction/reflection on what to remember
- **Read** — retrieved via semantic search/filtering from a namespace + key hierarchy
- **Update / consolidation** — merges with existing memory via **conflict detection and resolution** (Mem0). OpenAI ChatGPT auto-curates history through a background process called "dreaming"
- **Forgetting (decay / deletion)** — explicit deletion or memory expiration. **Without a decay mechanism, noise accumulates and performance degrades**

## MemGPT / Virtual Context Management

**Virtual context management** proposed by the paper **MemGPT: Towards LLMs as Operating Systems** (arXiv:2310.08560, 2023). Inspired by an OS's hierarchical memory (paging between fast/slow memory to present the illusion of larger capacity), it lets the **agent read and write its own context** via function calling, providing extended context beyond the limited window.

This OS-like hierarchy is implemented in its successor, **Letta**:

```text
main context    … working memory visible every turn (editable memory blocks)
recall storage  … recent history (searchable)
archival storage … long-term knowledge in an external DB
```

## Boundary with Context Engineering

Anthropic frames the distinction between short-term (in-window) and long-term (persistent) as follows:

- **Context rot** — performance degrades as context grows longer. This is why short-term optimization is necessary
- **Compaction** — when nearing the window limit, summarize conversation history (retain important design decisions, discard redundant output). **Keeping the window small = short-term**
- **Memory** — persist externally information that must not be lost to summarization = **long-term**
- **Just-in-time loading** — retain lightweight identifiers (paths, URLs) and fetch dynamically via tools at execution time
- **Context editing** — the client automatically clears stale tool calls/results from the window

For long-running agents, **using both compaction and memory together** is recommended. See [Context Management](ai-context-management.md) for details.

## Framework / Product Implementations

| Implementation | OSS | Characteristics |
|---|---|---|
| **LangGraph / LangMem** (LangChain) | OSS | short-term=checkpoint, long-term=BaseStore. Semantic/episodic/procedural plus a Memory Manager |
| **Mem0** | OSS + managed | Vector (pgvector by default) + optional graph (Mem0g), user/session/agent hierarchy |
| **Letta** (formerly MemGPT) | OSS | OS-like 3-tier main/recall/archival. Agent self-edits via tools |
| **Zep / Graphiti** | Managed + OSS engine | Temporal knowledge graph (bi-temporal) |
| **CrewAI memory** | OSS | short (ChromaDB+RAG) / long (SQLite) / entity / contextual, enabled via `memory=True` |
| **OpenAI ChatGPT memory** | Product | Saved memories + chat history reference, background "dreaming" process |
| **Anthropic memory tool** (`memory_20250818`) | Product (client-side implementation) | File operations under `/memories`. GA from Claude 4 onward; storage is user-managed |

Claude Code's `CLAUDE.md` (project instructions) and auto-memory (`MEMORY.md`) share the same underlying philosophy of "offloading knowledge to external files and reading it back each time," but no official documentation states a formal implementation relationship with the API's memory tool.

## Best Practices and Challenges

- **What to remember and what to discard** — the principle is the **smallest high-signal token set that maximizes the desired outcome**; record only information relevant to the topic
- **Memory pollution (retrieval pollution)** — a core weakness of append-only stores. **Memory hallucination** (storing a hallucination as fact) and **temporal obsolescence** (information that is correct but stale) are failure modes. Pure semantic similarity cannot distinguish a synonymous memory from "5 minutes ago" from one from "5 weeks ago"
- **Consolidation and decay are essential for long-term health** — unboundedly growing raw logs increase inference time, retrieval noise, and privacy risk
- **Privacy / auditable forgetting** — do not retain sensitive information beyond necessity. Path traversal prevention, pre-write filtering, size limits, and expiration (security responsibilities of the Anthropic memory tool)

## Anti-patterns

- **Accumulating raw logs without bound** — without consolidation/decay, this invites noise and degradation
- **Retrieving by semantic similarity alone** — ignores temporal freshness, surfacing stale information as if current
- **Conflating short-term and long-term** — stuffing everything into the context window. What should persist belongs in external memory; disposable content should go through compaction
- **Unconditionally memorizing sensitive information** — a privacy risk; filter before writing

## References

- Anthropic: [Memory tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool) / [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) / [Context management](https://anthropic.com/news/context-management)
- Papers: [MemGPT arXiv:2310.08560](https://arxiv.org/abs/2310.08560) / [Zep arXiv:2501.13956](https://arxiv.org/html/2501.13956v1) / [Mem0 arXiv:2504.19413](https://arxiv.org/pdf/2504.19413)
- Frameworks: [LangChain Memory overview](https://docs.langchain.com/oss/python/concepts/memory) / [LangMem](https://www.langchain.com/blog/langmem-sdk-launch) / [Letta: Agent Memory](https://www.letta.com/blog/agent-memory/) / [CrewAI Memory](https://docs.crewai.com/en/concepts/memory) / [Mem0](https://docs.mem0.ai/)
- Related: [AI Agent Context Management](ai-context-management.md), [Loop Engineering](loop-engineering.md), [AI Agent Observability](agentic-observability.md), [Anthropic API](../platform/anthropic-api.md)
