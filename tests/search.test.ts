import path from "node:path";
import { describe, expect, it } from "vitest";
import { searchKnowledge } from "../src/knowledge.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("searchKnowledge", () => {
  it("finds results matching content", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "installation");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.path === "tools/sample-tool-a")).toBe(true);
  });

  it("matches case-insensitively", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "PLUGIN");
    expect(results.some((r) => r.path === "tools/sample-tool-b")).toBe(true);
  });

  it("matches against file names", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "sample-tool-a");
    expect(results.some((r) => r.path === "tools/sample-tool-a")).toBe(true);
  });

  it("returns empty array for no matches", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "zzz-nonexistent-query");
    expect(results).toEqual([]);
  });

  it("searches across categories", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "indentation");
    expect(results.some((r) => r.path === "standards/sample-standard")).toBe(true);
  });

  it("includes context snippets in matches", async () => {
    const results = await searchKnowledge(FIXTURES_DIR, "cross-platform");
    const toolB = results.find((r) => r.path === "tools/sample-tool-b");
    expect(toolB).toBeDefined();
    expect(toolB!.matches.length).toBeGreaterThan(0);
    expect(toolB!.matches[0]).toContain("Cross-platform");
  });
});
