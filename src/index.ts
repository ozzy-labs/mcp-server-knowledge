#!/usr/bin/env node

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  listEntries,
  readKnowledge,
  searchKnowledge,
  validateAllFrontmatter,
} from "./knowledge.js";

const KNOWLEDGE_DIR = path.resolve(import.meta.dirname, "..", "knowledge");

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "knowledge", version: "0.2.0" },
  {
    instructions:
      "Provides verified, up-to-date knowledge for AI agents. " +
      "Use 'list' to discover categories and articles (supports nested paths like 'ai/agents'), " +
      "'read' to retrieve a specific article, and 'search' to find relevant content by keyword.",
  },
);

// --- list tool ---
server.registerTool(
  "list",
  {
    title: "List Knowledge",
    description:
      "List knowledge entries (subdirectories and articles) at the given path. " +
      "Call without arguments to list the top level. " +
      'Use a nested path like "ai" or "ai/agents" to navigate deeper.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe('Path to list (e.g. "ai" or "ai/agents"). Omit for the top-level entries.'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ path: subPath }) => {
    try {
      const { directories, files } = await listEntries(KNOWLEDGE_DIR, subPath ?? "");
      const lines: string[] = [];
      const label = subPath && subPath !== "" ? `"${subPath}"` : "top level";
      if (directories.length > 0) {
        lines.push(`Subdirectories in ${label}:`);
        for (const d of directories) lines.push(`- ${d}/`);
      }
      if (files.length > 0) {
        if (lines.length > 0) lines.push("");
        lines.push(`Articles in ${label}:`);
        for (const f of files) lines.push(`- ${f}`);
      }
      if (lines.length === 0) lines.push(`No entries in ${label}.`);
      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch {
      return {
        content: [{ type: "text" as const, text: `Path "${subPath ?? ""}" not found.` }],
        isError: true,
      };
    }
  },
);

// --- read tool ---
server.registerTool(
  "read",
  {
    title: "Read Knowledge",
    description:
      'Read a specific knowledge article. Provide the path without ".md" extension ' +
      '(e.g. "tools/ripgrep" or "ai/agents/claude-code").',
    inputSchema: {
      path: z
        .string()
        .describe('Path to the article, e.g. "tools/ripgrep" or "ai/agents/claude-code".'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ path: filePath }) => {
    try {
      const content = await readKnowledge(KNOWLEDGE_DIR, filePath);
      return { content: [{ type: "text" as const, text: content }] };
    } catch {
      return {
        content: [{ type: "text" as const, text: `Knowledge not found: "${filePath}".` }],
        isError: true,
      };
    }
  },
);

// --- search tool ---
server.registerTool(
  "search",
  {
    title: "Search Knowledge",
    description:
      "Search the knowledge base by keyword across all nested directories. " +
      "Matches against article paths and content.",
    inputSchema: {
      query: z.string().describe("Search keyword."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const results = await searchKnowledge(KNOWLEDGE_DIR, query);

    if (results.length === 0) {
      return { content: [{ type: "text" as const, text: `No results for "${query}".` }] };
    }

    const text = results
      .map((r) => {
        const snippets = r.matches.map((m) => `  ${m}`).join("\n  ---\n");
        return `## ${r.path}\n${snippets}`;
      })
      .join("\n\n");

    return { content: [{ type: "text" as const, text: text }] };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const issues = await validateAllFrontmatter(KNOWLEDGE_DIR);
  for (const issue of issues) {
    console.error(`[knowledge] frontmatter warning: ${issue.path} — ${issue.errors.join("; ")}`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("knowledge-mcp-server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
