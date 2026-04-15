import path from "node:path";
import { describe, expect, it } from "vitest";
import { readKnowledge } from "../src/knowledge.js";

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

  it("throws for non-existent file", async () => {
    await expect(readKnowledge(FIXTURES_DIR, "tools/nonexistent")).rejects.toThrow();
  });

  it("throws for non-existent category", async () => {
    await expect(readKnowledge(FIXTURES_DIR, "nonexistent/file")).rejects.toThrow();
  });
});
