---
reviewed: 2026-06-07
tags: [ai-agent, desktop, anthropic]
---

# Claude Cowork

A desktop (GUI) based autonomous AI agent provided by Anthropic. It runs on the same agent engine as "Claude Code," the CLI tool for developers, but offers complex file operations and workflow automation for general knowledge workers.

Official: [anthropic.com/product/claude-cowork](https://www.anthropic.com/product/claude-cowork)

## Key Features

- **Autonomous planning**: Rather than being a simple chat, it automatically assembles and executes multiple steps (research, execution, verification) when given a goal.
- **Direct file operations**: Can read, edit, create, move, and delete files within local folders the user has authorized.
- **Sandboxed execution**: Code execution and shell operations run inside a **Linux virtual machine (VM)** isolated from the host environment, providing strong safety guarantees.
- **Parallel task processing**: Internally splits and delegates complex tasks to sub-agents, running them in parallel to reduce processing time.
- **Scheduled execution**: Recurring tasks can be saved and run automatically on a schedule or in response to triggers.

## Use Cases

- **File organization**: Automatically classifies and renames large numbers of files based on content (date, category, project name, etc.).
- **Data extraction and aggregation**: Reads large volumes of PDFs or images (e.g., receipts) and consolidates them into structured data in spreadsheets or Markdown.
- **Research and writing**: Combines web search results (via Claude in Chrome integration) with local materials to automatically generate report drafts.
- **Routine task automation**: Runs daily log aggregation or standard-format report generation with "one click" or fully automatically.

## Comparison with Claude Code (CLI)

| Feature | Claude Cowork | Claude Code |
|---|---|---|
| **Interface** | Desktop app (GUI) | Terminal (CUI) |
| **Primary users** | Knowledge workers / general users | Software engineers |
| **Primary use** | Administrative work, research, file management | Coding, debugging, Git operations |
| **Execution environment** | Isolated dedicated VM | Local host (direct execution) |
| **Onboarding barrier** | Low (install the app) | High (requires Node.js / CLI knowledge) |

## Availability

After a research preview, it is now generally available as a feature of the Claude Desktop app.

- **Plan**: Requires a **paid plan** (Pro / Max / Team / Enterprise).
- **OS**: Available for both macOS and Windows (Windows requires the latest version).
- **Foreground app**: The Claude Desktop app must remain open while work is in progress (closing it ends the session).

## Best Practices

- **Minimize folder permissions**: Grant access only to the specific folders required for the task, and avoid granting access to the entire system.
- **Be specific in prompts**: For tasks with many execution steps, specifying concretely "what the final file structure should look like" improves the success rate.
- **Leverage the sandbox**: Testing untrusted scripts or performing complex data transformations inside the Cowork VM keeps the main environment clean.

## References

- [Claude Cowork product page](https://www.anthropic.com/product/claude-cowork)
- [Claude Help Center: Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
