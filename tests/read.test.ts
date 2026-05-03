import path from "node:path";
import { describe, expect, it } from "vitest";
import { readArticleFrontmatter, readKnowledge } from "../src/knowledge.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("readKnowledge", () => {
  it("reads a knowledge file by path", async () => {
    const content = await readKnowledge(FIXTURES_DIR, "tools/sample-tool-a");
    expect(content).toContain("# Sample Tool A");
    expect(content).toContain("SAMPLE_A_KEY");
  });

  it("reads from a different category", async () => {
    const content = await readKnowledge(FIXTURES_DIR, "standards/sample-standard");
    expect(content).toContain("# Sample Standard");
    expect(content).toContain("2-space indentation");
  });

  it("reads nested article (depth 2)", async () => {
    const content = await readKnowledge(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    expect(content).toContain("# Sample Nested Agent");
    expect(content).toContain("nested-marker-xyz");
  });

  it("throws for non-existent file", async () => {
    await expect(readKnowledge(FIXTURES_DIR, "tools/nonexistent")).rejects.toThrow();
  });

  it("throws for non-existent category", async () => {
    await expect(readKnowledge(FIXTURES_DIR, "nonexistent/file")).rejects.toThrow();
  });

  it("rejects path traversal attempts", async () => {
    await expect(readKnowledge(FIXTURES_DIR, "../package")).rejects.toThrow("Path traversal");
    await expect(readKnowledge(FIXTURES_DIR, "tools/../../package")).rejects.toThrow(
      "Path traversal",
    );
  });
});

describe("readArticleFrontmatter", () => {
  it("returns parsed and validated frontmatter", async () => {
    const fm = await readArticleFrontmatter(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    expect(fm).not.toBeNull();
    expect(fm?.reviewed).toBe("2026-05-03");
    expect(fm?.stability).toBe("research-preview");
    expect(fm?.tags).toEqual(["ai-workflow", "oss"]);
  });

  it("applies defaults for optional fields", async () => {
    const fm = await readArticleFrontmatter(FIXTURES_DIR, "standards/sample-standard");
    expect(fm?.stability).toBe("ga");
    expect(fm?.aliases).toEqual([]);
  });
});
