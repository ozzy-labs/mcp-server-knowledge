---
reviewed: 2026-08-16
tags: [ai-agent, desktop, anthropic]
---

# Claude Cowork

A desktop (GUI) based autonomous AI agent provided by Anthropic. It runs on the same agent engine as "Claude Code," the CLI tool for developers, but offers complex file operations and workflow automation for general knowledge workers.

Official: [claude.com/product/cowork](https://claude.com/product/cowork)

## Key Features

- **Autonomous planning**: Rather than being a simple chat, it automatically assembles and executes multiple steps (research, execution, verification) when given a goal.
- **Direct file operations**: Can read, edit, create, move, and delete files within local folders the user has authorized.
- **Sandboxed execution**: Code execution and shell operations run inside a **Linux virtual machine (VM)** isolated from the host environment, providing strong safety guarantees.
- **Parallel task processing**: Internally splits and delegates complex tasks to sub-agents, running them in parallel to reduce processing time.
- **Scheduled execution**: Recurring tasks can be saved and run automatically on a schedule or in response to triggers.
- **Projects**: Group related tasks into separate workspaces with their own files, context, instructions, and memory.
- **Chrome side panel (2026-08-12)**: The Claude in Chrome side panel is now a full Cowork session — conversations are saved to your history, **skills and connectors work in the browser**, and a task started in a tab can be finished on the desktop, web, and mobile apps. Available on **Max and Team**, rolling out to Pro; **off by default on Enterprise** (admins can enable it and restrict it to approved domains).
- **Permission modes**: Each run uses an approval mode — **Manual** (Claude pauses for approval on each action), **Auto** (Claude self-reviews and automatically blocks anything it determines to be unsafe), or **Skip** (no automatic checks).

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

After a research preview, it became **generally available on 2026-04-09** as a feature of the Claude Desktop app.

- **Plan**: Requires a **paid plan** (Pro / Max / Team / Enterprise).
- **Surfaces and plans**:

  | Surface | Pro | Max | Team | Enterprise |
  |---|---|---|---|---|
  | Desktop (macOS) | Yes | Yes | Yes | Yes |
  | Desktop (Windows, latest version) | Yes | Yes | Yes | Yes |
  | Web (claude.ai) | Yes | Yes | Yes | Admin-enabled |
  | Mobile (iOS / Android) | Yes | Yes | Yes | Admin-enabled |
  | Chrome side panel | Rolling out | Yes | Yes | Admin-enabled |

  Web and mobile began as a staged beta on **2026-07-07** (Max subscribers first) and have since reached Pro and Team.
- **Linux desktop (beta)**: The desktop app on Linux gives the same Chat / Cowork / Claude Code experience as macOS and Windows (Ubuntu 22.04+ or Debian 12+, `x86_64` or `arm64`, installed from Anthropic's apt repository). **Computer Use and dictation are not available in the Linux beta**, and only Debian-based distributions are supported today.
- **Background execution**: Tasks run on Anthropic's managed infrastructure and continue even when the device is offline or closed; the **mobile app notifies** you when the agent needs a decision.
- **Desktop-app-only capabilities**: Working with **files on your computer or with other applications** still requires the desktop app. **Live artifacts** and **plugins that include local MCP servers** are also desktop-only. Browser-based work no longer requires the desktop app now that the Chrome side panel runs a Cowork session.

## Limitations

- **No session sharing**: Cowork sessions can't be shared with others. Team / Enterprise can share **live artifacts** within the organization.
- **Memory is not shared with Chat**: What Claude remembers about you in chat doesn't carry into Cowork sessions yet; within Cowork, memory is supported **in projects only**.
- **Usage cost**: Working on tasks with Cowork **consumes more of your usage allocation** than chatting with Claude.

## Best Practices

- **Minimize folder permissions**: Grant access only to the specific folders required for the task, and avoid granting access to the entire system.
- **Be specific in prompts**: For tasks with many execution steps, specifying concretely "what the final file structure should look like" improves the success rate.
- **Leverage the sandbox**: Testing untrusted scripts or performing complex data transformations inside the Cowork VM keeps the main environment clean.

## References

- [Claude Cowork product page](https://claude.com/product/cowork)
- [Claude Help Center: Get started with Claude Cowork](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)
- [Claude Cowork comes to the Chrome side panel](https://claude.com/blog/cowork-chrome-side-panel)
- [Claude Desktop on Linux (beta)](https://code.claude.com/docs/en/desktop-linux)
