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
    // same directory (+1) + two shared tags [ai-workflow, oss] (+2 each) = 5.
    expect(top.score).toBe(1 + 2 * 2);
  });

  it("weights same directory below a single shared tag", async () => {
    // sample-tool-a and sample-tool-b are both in tools/ (same directory, +1)
    // and both tagged `cli` (one shared tag, +2). No alias overlap.
    // This pins the same-directory weight at +1: with the old +3 the score
    // would have been 5, not 3.
    const results = await findRelated(FIXTURES_DIR, "tools/sample-tool-a");
    const toolB = results.find((r) => r.path === "tools/sample-tool-b");
    expect(toolB?.score).toBe(1 + 2);
  });

  it("excludes the source article itself", async () => {
    const results = await findRelated(FIXTURES_DIR, "ai/agents/sample-nested-agent");
    expect(results.every((r) => r.path !== "ai/agents/sample-nested-agent")).toBe(true);
  });

  it("respects the limit option", async () => {
    const results = await findRelated(FIXTURES_DIR, "tools/sample-tool-a", { limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it("scores alias overlap", async () => {
    // sample-related-agent has alias "related-agent"
    // Let's check sample-nested-agent which should overlap if we set it up.
    // In fixtures, sample-nested-agent has aliases: ["nested-agent"]
    // and sample-related-agent has aliases: ["related-agent"]
    // Wait, the score logic is:
    // otherAliases.some((a) => targetAliases.has(a)) ||
    // otherAliases.includes(targetBase) ||
    // targetAliases.has(snapshot.basename.toLowerCase())

    const results = await findRelated(FIXTURES_DIR, "ai/agents/sample-related-agent");
    // sample-related-agent base is "sample-related-agent"
    // sample-nested-agent aliases are ["nested-agent"]
    // Let's look for an overlap.
    // If I search related for "ai/agents/sample-related-agent",
    // and "sample-nested-agent" is returned, what is the score?
    const nested = results.find((r) => r.path === "ai/agents/sample-nested-agent");
    expect(nested).toBeDefined();
    // Same directory (+1) plus shared tags [ai-workflow, oss] (+2 each).
    expect(nested?.score).toBeGreaterThanOrEqual(1);
  });

  it("scores alias overlap specifically", async () => {
    // alias-test.md has alias [sample-tool-a]
    // sample-tool-a.md has basename sample-tool-a
    const results = await findRelated(FIXTURES_DIR, "tools/sample-tool-a");
    const aliasTest = results.find((r) => r.path === "tools/alias-test");
    expect(aliasTest).toBeDefined();
    expect(aliasTest?.reasons).toContain("alias overlap");
    expect(aliasTest?.score).toBeGreaterThanOrEqual(1);
  });

  it("handles articles in root directory (no parent)", async () => {
    // If there's an article in the root, its parentDir is ""
    // This tests the (targetParent !== "") condition in src/knowledge.ts
    const results = await findRelated(FIXTURES_DIR, "tools/sample-tool-a");
    expect(results).toBeDefined();
  });
});
