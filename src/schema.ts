import { z } from "zod";

export const StabilitySchema = z.enum(["ga", "beta", "research-preview", "deprecated"]);
export type Stability = z.infer<typeof StabilitySchema>;

export const TagSchema = z.enum([
  "ai-workflow",
  "aws",
  "bash",
  "build",
  "ci",
  "cli",
  "cloud-hosted",
  "codegen",
  "commercial",
  "data-cli",
  "dockerfile",
  "extension",
  "fast",
  "format",
  "framework",
  "gcp",
  "git-hook",
  "github",
  "go",
  "grpc",
  "ide",
  "javascript",
  "json",
  "language",
  "library",
  "lint",
  "lsp",
  "markdown",
  "methodology",
  "npm",
  "oci",
  "oss",
  "package",
  "protobuf",
  "python",
  "release",
  "rust",
  "security",
  "spec",
  "style",
  "task-runner",
  "test",
  "toml",
  "typescript",
  "version-manager",
  "yaml",
]);
export type Tag = z.infer<typeof TagSchema>;

export const FrontmatterSchema = z.object({
  reviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "reviewed must be ISO date YYYY-MM-DD"),
  tags: z.array(TagSchema).optional().default([]),
  aliases: z.array(z.string()).optional().default([]),
  stability: StabilitySchema.optional().default("ga"),
});

export type Frontmatter = z.infer<typeof FrontmatterSchema>;

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseInlineList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (inner === "") return [];
  return inner
    .split(",")
    .map((s) => stripQuotes(s.trim()))
    .filter((s) => s.length > 0);
}

export interface ParseResult {
  frontmatter: Record<string, unknown>;
  bodyOffset: number;
}

export function parseFrontmatter(content: string): ParseResult {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { frontmatter: {}, bodyOffset: 0 };
  }
  const fm: Record<string, unknown> = {};
  let cursor = 1;
  let currentKey: string | null = null;
  const blockList: string[] = [];

  const flushBlock = () => {
    if (currentKey !== null) {
      fm[currentKey] = [...blockList];
      blockList.length = 0;
      currentKey = null;
    }
  };

  while (cursor < lines.length && lines[cursor].trim() !== "---") {
    const line = lines[cursor];
    const blockItem = line.match(/^\s+-\s+(.*)$/);
    if (blockItem && currentKey !== null) {
      blockList.push(stripQuotes(blockItem[1].trim()));
      cursor++;
      continue;
    }
    flushBlock();
    const kv = line.match(/^([\w-]+):\s*(.*?)\s*$/);
    if (kv) {
      const [, key, rawValue] = kv;
      if (rawValue === "") {
        currentKey = key;
      } else if (rawValue.startsWith("[")) {
        fm[key] = parseInlineList(rawValue);
      } else {
        fm[key] = stripQuotes(rawValue);
      }
    }
    cursor++;
  }
  flushBlock();
  const bodyOffset = cursor < lines.length ? cursor + 1 : cursor;
  return { frontmatter: fm, bodyOffset };
}

export interface ValidatedFrontmatter {
  ok: boolean;
  data?: Frontmatter;
  errors?: string[];
}

export function validateFrontmatter(raw: Record<string, unknown>): ValidatedFrontmatter {
  const result = FrontmatterSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    errors: result.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`),
  };
}
