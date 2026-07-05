---
reviewed: 2026-05-10
---
# Private Knowledge

This directory is for personal knowledge articles that you do not want to commit to the repository.

## Characteristics

- **Excluded from Git**: Files under this directory (except README.md) are excluded from Git tracking and commits via `.gitignore`.
- **MCP integration**: Like other directories (`ai/`, `tools/`, etc.), this directory is automatically recognized by the MCP server. It can be used alongside public knowledge via the `list` and `search` tools.

## Usage

1. Create a `.md` file in this directory.
2. Write frontmatter as you would for any other article.
3. From an MCP client (e.g. Claude), instruct it to "find articles under _private/" to use them.
