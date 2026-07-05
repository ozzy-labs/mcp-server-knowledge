---
reviewed: 2026-06-07
tags: [ai-workflow, methodology]
---

# AI Agent Context Management

The practical usefulness of an LLM agent depends heavily on "how efficiently the context window is used." This article summarizes the key techniques adopted by modern AI agents such as Claude Code, Codex CLI, and Gemini CLI.

## Why It Matters

- **Context length ≠ effective performance**: even with 200K / 1M tokens available, high noise degrades accuracy, speed, and cost (the "lost in the middle" phenomenon)
- **Cost**: input tokens are resent with every request. Bloat means higher billing on every call
- **Latency**: prefill time scales roughly linearly with token count
- **Cache hit rate**: prompt caching keys off "the same leading portion as before." Placing dynamically-changing parts at the front invalidates the cache

## Design Principles

### 1. Static-first ordering (cache optimization)

```text
[ System prompt ]             ← immutable (cached)
[ Fixed docs / conventions ]  ← immutable (cached)
[ Tool definitions ]          ← immutable (cached)
[ Session rules ]             ← quasi-immutable (cached)
━━━ cache breakpoint ━━━
[ Conversation history (oldest first) ]  ← accumulates
[ Latest user utterance ]     ← changes every time
```

Prompt caching matches from the front in order. **Put immutable elements first, dynamic elements last.**

### 2. Just-in-time loading

Don't keep all knowledge loaded in context at all times. Load it **only when needed**:

- **Skills' progressive disclosure**: only the description is resident at startup; the body loads the moment it's triggered
- **Resources / MCP tools**: file contents are fetched only "at the point of query"
- **Delegation to subagents**: heavy reading is done in a child agent, which returns only a summary

### 3. Progressive compression of information

```text
Raw data ─▶ Summary ─▶ Tags/Index ─▶ Pointer (URI/path)
```

- Keep **pointers and summaries** in the agent's parent context
- Maintain a state where "it can be retrieved via `read_file(path)` if needed"
- Claude Code's `resource_link` is exactly this

### 4. Context window budgeting

Decide a context budget at the start of a task:

| Purpose | Rough guide (for a 200K model) |
|---|---|
| System prompt + conventions | 5-15K |
| Tool definitions | 5-20K |
| Conversation history | 20-80K |
| Working read buffer | 30-100K |
| Output reserve | 8-32K |

When exceeded, trigger compression, summarization, or cutting strategies.

## Compaction Techniques

### Manual compaction

Explicitly triggered by the user. Claude Code's `/compact` summarizes the conversation in series while preserving key information (file paths, TODOs, recent errors).

### Automatic compaction

The agent runtime monitors context usage and inserts background summarization at a threshold (e.g., 80%).

### Subagent branching

Tasks requiring extensive exploration are offloaded to **a separate context from the start**:

```text
Parent: "Investigate the codebase's import graph"
     │
     └─▶ Child agent (independent context)
            │ Reads and organizes dozens of files
            ▼
         Returns only "summary + 3 notable spots" to the parent
```

Claude Code's `Agent` tool / `subagent_type` serves this purpose. The parent context stays uncontaminated.

### Trimming conversation history

- **Drop from the oldest messages**: simple, but the LLM loses context
- **Replace with summary**: the LLM summarizes the old range and leaves a placeholder (recommended)
- **Preserve important markers**: don't drop anything explicitly flagged by the system as "must remember"

## Choosing the Right Type of Memory

| Type | Persistence | Purpose |
|---|---|---|
| Session context | Within session | Conversation history |
| Files (`CLAUDE.md`, `AGENTS.md`) | Lifetime of the repository | Project conventions, shared team instructions |
| Auto-memory (Claude Code) | Across conversations (per user) | User preferences, recurring instructions, domain knowledge |
| MCP Resources | Lifetime of the server | Lazy access to structured data sources |
| External vector DB | Arbitrary | Large-scale RAG, organizational knowledge |

Principle: **only put things in context that are fine to discard after the session.** Everything else belongs in external memory, referenced via a pointer.

## Anti-patterns

- **"Paste everything just in case"** — wastes tokens and adds noise. The LLM loses track of what's important
- **Putting a dynamic timestamp at the head of the system prompt** — invalidates the cache every time
- **Writing tool definitions as long strings** — schemas for unused tools eat up context. Unload them if not needed
- **Keeping the entire conversation history verbatim** — noise from old failed attempts degrades accuracy. Use summary replacement instead
- **Returning subagent results wholesale to the parent** — defeats the purpose of isolation. Always return them **compressed**
- **Duplicating the same information in multiple places** — breaks caching, and the LLM gets confused about which copy is authoritative

## Implementation Tips

### When to delegate to a subagent

Delegation is effective when:

- The exploration scope is broad (grepping / reading many files)
- Many failures and trial-and-error are expected (you don't want to pollute the parent context)
- The task is independent and can run in parallel (e.g., reviewing multiple PRs)

Delegation is counterproductive when:

- The result is small and doing it directly in the parent is faster
- The judgment depends on the parent's context (the delegate lacks enough material to decide)

### Designs that play well with prompt caching

- **Keep the system prompt fixed** (don't put dates or session IDs at the head of the prompt)
- **Curate tool definitions carefully** (unload tools that aren't used)
- **Put conventions/background knowledge in a separate block as a cache breakpoint**
- **Clearly delimit dynamic parts and place them at the end**

### Quality criteria for summaries

When adopting automatic summarization, be careful not to lose:

- **Identifiers** such as file paths and function names
- Recent error messages and the direction of the fix
- Incomplete TODOs and pending decisions
- Constraints and prohibitions explicitly stated by the user

Keep these verbatim, and compress only the surrounding explanatory text.

## References

- Anthropic: [Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- Anthropic: [Extended Thinking best practices](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- Claude Code: Skills' progressive disclosure spec (see `ai/agents/claude-code.md`)
- This repository's `ai/practice/prompt-injection.md` — trust boundary design is closely related to context management
- This repository's [`ai/practice/agent-memory.md`](agent-memory.md) — what to persist outside the context window (short-term) as long-term memory. Companion piece to this article
