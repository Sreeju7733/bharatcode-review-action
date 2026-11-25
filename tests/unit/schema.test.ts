import { describe, it, expect } from "vitest";
import { ChunkReviewSchema, FindingSchema } from "../../src/review/schema.js";
import { parseReviewResponse } from "../../src/review/parse.js";

describe("Zod Schema & Parser (schema.ts & parse.ts)", () => {
  it("validates well-formed finding and chunk review", () => {
    const valid = {
      summary: "Looks good with minor notes",
      findings: [
        {
          file: "src/index.ts",
          line: 10,
          severity: "error",
          category: "bug",
          title: "Null Pointer",
          message: "Potential undefined access",
          suggestion: "foo?.bar",
          confidence: 0.9,
        },
      ],
    };

    const res = ChunkReviewSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects malformed finding with invalid severity or confidence", () => {
    const invalidSeverity = {
      file: "src/index.ts",
      line: 10,
      severity: "catastrophic", // invalid
      category: "bug",
      title: "Title",
      message: "Msg",
      suggestion: null,
      confidence: 0.9,
    };
    expect(FindingSchema.safeParse(invalidSeverity).success).toBe(false);

    const invalidConfidence = {
      file: "src/index.ts",
      line: 10,
      severity: "error",
      category: "bug",
      title: "Title",
      message: "Msg",
      suggestion: null,
      confidence: 1.5, // > 1.0
    };
    expect(FindingSchema.safeParse(invalidConfidence).success).toBe(false);
  });

  it("strips markdown code blocks in parseReviewResponse", () => {
    const raw = "```json\n" + JSON.stringify({ summary: "Clean code", findings: [] }) + "\n```";
    const res = parseReviewResponse(raw);
    expect(res.summary).toBe("Clean code");
    expect(res.findings.length).toBe(0);
  });

  it("falls back to markdown without crashing on unparseable JSON", () => {
    const raw = "This is not json at all. Just some prose review comments.";
    const res = parseReviewResponse(raw, "fallback.ts");
    expect(res.findings.length).toBe(1);
    expect(res.findings[0].category).toBe("other");
    expect(res.findings[0].message).toContain("This is not json");
  });
});
