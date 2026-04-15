import path from "node:path";
import { describe, expect, it } from "vitest";
import { listCategories, listFiles } from "../src/knowledge.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("listCategories", () => {
  it("returns sorted category names", async () => {
    const categories = await listCategories(FIXTURES_DIR);
    expect(categories).toEqual(["standards", "tools"]);
  });

  it("ignores files at the root level", async () => {
    const categories = await listCategories(FIXTURES_DIR);
    for (const c of categories) {
      expect(typeof c).toBe("string");
    }
  });
});

describe("listFiles", () => {
  it("returns sorted file names without .md extension", async () => {
    const files = await listFiles(FIXTURES_DIR, "tools");
    expect(files).toEqual(["sample-tool-a", "sample-tool-b"]);
  });

  it("returns files for standards category", async () => {
    const files = await listFiles(FIXTURES_DIR, "standards");
    expect(files).toEqual(["sample-standard"]);
  });

  it("throws for non-existent category", async () => {
    await expect(listFiles(FIXTURES_DIR, "nonexistent")).rejects.toThrow();
  });

  it("rejects path traversal attempts", async () => {
    await expect(listFiles(FIXTURES_DIR, "../")).rejects.toThrow("Path traversal");
    await expect(listFiles(FIXTURES_DIR, "tools/../../")).rejects.toThrow("Path traversal");
  });
});
