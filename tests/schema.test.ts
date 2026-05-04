import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateAllFrontmatter, walkArticles } from "../src/knowledge.js";
import { parseFrontmatter, validateFrontmatter } from "../src/schema.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("parseFrontmatter", () => {
  it("returns empty when no frontmatter is present", () => {
    const { frontmatter, bodyOffset } = parseFrontmatter("# Title\n\nbody");
    expect(frontmatter).toEqual({});
    expect(bodyOffset).toBe(0);
  });

  it("parses inline list values", () => {
    const content = ["---", "tags: [a, b, c]", "---", "# Title"].join("\n");
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.tags).toEqual(["a", "b", "c"]);
  });

  it("parses block list values", () => {
    const content = ["---", "tags:", "  - one", "  - two", "---", "# Title"].join("\n");
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.tags).toEqual(["one", "two"]);
  });

  it("strips quotes from scalar values", () => {
    const content = ["---", 'reviewed: "2026-05-03"', "---", "# Title"].join("\n");
    const { frontmatter } = parseFrontmatter(content);
    expect(frontmatter.reviewed).toBe("2026-05-03");
  });
});

describe("validateFrontmatter", () => {
  it("accepts valid frontmatter and applies defaults", () => {
    const result = validateFrontmatter({ reviewed: "2026-05-03" });
    expect(result.ok).toBe(true);
    expect(result.data?.stability).toBe("ga");
    expect(result.data?.tags).toEqual([]);
    expect(result.data?.aliases).toEqual([]);
  });

  it("rejects malformed reviewed date", () => {
    const result = validateFrontmatter({ reviewed: "May 3 2026" });
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.includes("reviewed"))).toBe(true);
  });

  it("rejects unknown stability value", () => {
    const result = validateFrontmatter({
      reviewed: "2026-05-03",
      stability: "experimental",
    });
    expect(result.ok).toBe(false);
  });

  it("requires reviewed field", () => {
    const result = validateFrontmatter({});
    expect(result.ok).toBe(false);
  });

  it("accepts known tags from the controlled vocabulary", () => {
    const result = validateFrontmatter({
      reviewed: "2026-05-04",
      tags: ["cli", "go", "lint"],
    });
    expect(result.ok).toBe(true);
    expect(result.data?.tags).toEqual(["cli", "go", "lint"]);
  });

  it("rejects unknown tags not in the vocabulary", () => {
    const result = validateFrontmatter({
      reviewed: "2026-05-04",
      tags: ["cli", "linter"],
    });
    expect(result.ok).toBe(false);
    expect(result.errors?.some((e) => e.includes("tags"))).toBe(true);
  });
});

describe("walkArticles", () => {
  it("yields all articles across nested directories", async () => {
    const collected: string[] = [];
    for await (const entry of walkArticles(FIXTURES_DIR)) {
      collected.push(entry.path);
    }
    expect(collected).toContain("tools/sample-tool-a");
    expect(collected).toContain("tools/sample-tool-b");
    expect(collected).toContain("standards/sample-standard");
    expect(collected).toContain("ai/agents/sample-nested-agent");
  });

  it("scopes walking to a subPath when given", async () => {
    const collected: string[] = [];
    for await (const entry of walkArticles(FIXTURES_DIR, "ai")) {
      collected.push(entry.path);
    }
    expect(collected).toEqual(["ai/agents/sample-nested-agent", "ai/agents/sample-related-agent"]);
  });
});

describe("validateAllFrontmatter", () => {
  it("returns no issues for fixture set", async () => {
    const issues = await validateAllFrontmatter(FIXTURES_DIR);
    expect(issues).toEqual([]);
  });
});
