import path from "node:path";
import { describe, expect, it } from "vitest";
import { findRelated } from "../src/knowledge.js";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "fixtures/knowledge");

describe("findRelated", () => {
  it("returns articles in the same directory ranked above unrelated ones", async () => {
    const results = await findRelated(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("ai/agents/sample-related-agent");
  });

  it("scores tag overlap higher than directory alone", async () => {
    const results = await findRelated(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    const top = results[0];
    expect(top.reasons.some((r) => r.includes("same directory"))).toBe(true);
    expect(top.reasons.some((r) => r.includes("shared tags"))).toBe(true);
    expect(top.score).toBeGreaterThanOrEqual(3 + 2);
  });

  it("excludes the source article itself", async () => {
    const results = await findRelated(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    expect(results.every((r) => r.path !== "ai/agents/sample-nested-agent")).toBe(true);
  });

  it("respects the limit option", async () => {
    const results = await findRelated(FIXTURES_DIR, "tools/sample-tool-a", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });
});
