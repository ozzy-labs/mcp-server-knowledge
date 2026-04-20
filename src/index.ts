#!/usr/bin/env node

import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { listCategories, listFiles, readKnowledge, searchKnowledge } from "./knowledge.js";

const KNOWLEDGE_DIR = path.resolve(import.meta.dirname, "..", "knowledge");

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer(
  { name: "knowledge", version: "0.1.0" },
  {
    instructions:
      "Provides verified, up-to-date knowledge for AI agents. " +
      "Use 'list' to discover categories and files, 'read' to retrieve a specific knowledge article, " +
      "and 'search' to find relevant knowledge by keyword.",
  },
);

// --- list tool ---
server.registerTool(
  "list",
  {
    title: "List Knowledge",
    description:
      "List available knowledge categories or files within a category. " +
      "Call without arguments to get all categories, or with a category name to list its files.",
    inputSchema: {
      category: z
        .string()
        .optional()
        .describe("Category name to list files in. Omit to list all categories."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ category }) => {
    if (category === undefined) {
      const categories = await listCategories(KNOWLEDGE_DIR);
      return {
        content: [
          {
            type: "text" as const,
            text:
              categories.length > 0
                ? `Categories:\n${categories.map((c) => `- ${c}`).join("\n")}`
                : "No categories found.",
          },
        ],
      };
    }

    try {
      const files = await listFiles(KNOWLEDGE_DIR, category);
      return {
        content: [
          {
            type: "text" as const,
            text:
              files.length > 0
                ? `Files in "${category}":\n${files.map((f) => `- ${f}`).join("\n")}`
                : `No knowledge files in category "${category}".`,
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text" as const, text: `Category "${category}" not found.` }],
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
      'Read a specific knowledge article. Provide the path as "category/name" (e.g. "tools/claude-code").',
    inputSchema: {
      path: z.string().describe('Path to the knowledge file, e.g. "tools/claude-code".'),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ path: filePath }) => {
    try {
      const content = await readKnowledge(KNOWLEDGE_DIR, filePath);
      return {
        content: [{ type: "text" as const, text: content }],
      };
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
    description: "Search the knowledge base by keyword. Matches against file names and content.",
    inputSchema: {
      query: z.string().describe("Search keyword."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ query }) => {
    const results = await searchKnowledge(KNOWLEDGE_DIR, query);

    if (results.length === 0) {
      return {
        content: [{ type: "text" as const, text: `No results for "${query}".` }],
      };
    }

    const text = results
      .map((r) => {
        const snippets = r.matches.map((m) => `  ${m}`).join("\n  ---\n");
        return `## ${r.path}\n${snippets}`;
      })
      .join("\n\n");

    return {
      content: [{ type: "text" as const, text: text }],
    };
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("knowledge-mcp-server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
