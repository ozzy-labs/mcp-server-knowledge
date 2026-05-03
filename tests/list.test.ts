import path from "node:path";
import { describe, expect, it } from "vitest";
import { listCategories, listEntries, listFiles } from "../src/knowledge.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("listEntries", () => {
  it("returns top-level directories sorted", async () => {
    const { directories, files } = await listEntries(FIXTURES_DIR);
    expect(directories).toEqual(["ai", "standards", "tools"]);
    expect(files).toEqual([]);
  });

  it("returns files for a leaf directory sorted without .md", async () => {
    const { files, directories } = await listEntries(FIXTURES_DIR, "tools");
    expect(files).toEqual(["sample-tool-a", "sample-tool-b"]);
    expect(directories).toEqual([]);
  });

  it("returns nested subdirectory listing", async () => {
    const { directories } = await listEntries(FIXTURES_DIR, "ai");
    expect(directories).toEqual(["agents"]);
  });

  it("returns nested files at depth 2", async () => {
    const { files } = await listEntries(FIXTURES_DIR, "ai/agents");
    expect(files).toEqual(["sample-nested-agent", "sample-related-agent"]);
  });

  it("throws for non-existent path", async () => {
    await expect(listEntries(FIXTURES_DIR, "nonexistent")).rejects.toThrow();
  });

  it("rejects path traversal attempts", async () => {
    await expect(listEntries(FIXTURES_DIR, "../")).rejects.toThrow("Path traversal");
    await expect(listEntries(FIXTURES_DIR, "tools/../../")).rejects.toThrow("Path traversal");
  });

  it("excludes INDEX.md from files", async () => {
    const { files } = await listEntries(FIXTURES_DIR, "tools");
    expect(files).not.toContain("INDEX");
  });
});

describe("listCategories (legacy wrapper)", () => {
  it("returns sorted top-level category names", async () => {
    const categories = await listCategories(FIXTURES_DIR);
    expect(categories).toEqual(["ai", "standards", "tools"]);
  });
});

describe("listFiles (legacy wrapper)", () => {
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
