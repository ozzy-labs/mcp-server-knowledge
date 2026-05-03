import { describe, expect, it } from "vitest";
import { normalizeAgentOutput } from "../scripts/staleness/normalize-output.mjs";
import { validateAgentOutput } from "../scripts/staleness/validate-output.mjs";

const baseReport = {
  article: "tools/ripgrep",
  confidence: "high" as const,
  summary: "stub",
  sources_consulted: ["gh release list -R BurntSushi/ripgrep"],
  fetch_failures: [],
  edits: [],
};

describe("validateAgentOutput", () => {
  it("accepts a minimal valid low report", () => {
    const result = validateAgentOutput({ ...baseReport, confidence: "low" });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts a high report with valid edit triple", () => {
    const result = validateAgentOutput({
      ...baseReport,
      edits: [
        {
          locator: "intro paragraph",
          old_string: "old text",
          new_string: "new text",
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unknown confidence value", () => {
    const result = validateAgentOutput({ ...baseReport, confidence: "great" });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.message?.includes("must be equal to one of"))).toBe(true);
  });

  it("rejects edit lacking required fields", () => {
    const result = validateAgentOutput({
      ...baseReport,
      edits: [{ locator: "x" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects extra top-level properties", () => {
    const result = validateAgentOutput({ ...baseReport, extra: 1 });
    expect(result.ok).toBe(false);
  });

  it("rejects fetch_failure missing reason", () => {
    const result = validateAgentOutput({
      ...baseReport,
      confidence: "fail",
      fetch_failures: [{ url: "https://example.com" }],
    });
    expect(result.ok).toBe(false);
  });
});

describe("normalizeAgentOutput", () => {
  it("downgrades high to low when edits are empty", () => {
    const out = normalizeAgentOutput({ ...baseReport, confidence: "high", edits: [] });
    expect(out.confidence).toBe("low");
  });

  it("downgrades medium to low when only frontmatter reviewed is changed", () => {
    const out = normalizeAgentOutput({
      ...baseReport,
      confidence: "medium",
      edits: [
        {
          locator: "frontmatter reviewed",
          old_string: "reviewed: 2026-04-18",
          new_string: "reviewed: 2026-05-04",
        },
      ],
    });
    expect(out.confidence).toBe("low");
  });

  it("keeps high when edits include real body changes", () => {
    const out = normalizeAgentOutput({
      ...baseReport,
      confidence: "high",
      edits: [
        {
          locator: "version note",
          old_string: "v1.6 が現行最新",
          new_string: "v1.8.1 が現行最新",
        },
      ],
    });
    expect(out.confidence).toBe("high");
  });

  it("keeps fail untouched even when edits are empty", () => {
    const out = normalizeAgentOutput({
      ...baseReport,
      confidence: "fail",
      edits: [],
      fetch_failures: [{ url: "https://example.com", reason: "404" }],
    });
    expect(out.confidence).toBe("fail");
  });

  it("keeps high when one edit is reviewed-only but another is real body change", () => {
    const out = normalizeAgentOutput({
      ...baseReport,
      confidence: "high",
      edits: [
        {
          locator: "reviewed",
          old_string: "reviewed: 2026-04-18",
          new_string: "reviewed: 2026-05-04",
        },
        {
          locator: "body bump",
          old_string: "v1.6 currently",
          new_string: "v1.8 currently",
        },
      ],
    });
    expect(out.confidence).toBe("high");
  });
});
