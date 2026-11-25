import { describe, it, expect } from "vitest";
import { runRuleBasedChecks, applyPathOverrides, aggregateReviews } from "../../src/review/aggregate.js";
import { ChunkReview, FileDiff, Finding, PathConfig, RuleConfig } from "../../src/types.js";

describe("Review Aggregator & Local Rules (aggregate.ts)", () => {
  it("runs local regex rules before LLM pass", () => {
    const rules: RuleConfig[] = [
      {
        name: "no-console-log",
        pattern: "console\\.log",
        severity: "warning",
        message: "Remove console.log before merge.",
      },
    ];

    const mockDiffMap = new Map<string, FileDiff>();
    mockDiffMap.set("src/index.ts", {
      oldPath: "src/index.ts",
      newPath: "src/index.ts",
      isNew: false,
      isDeleted: false,
      isRenamed: false,
      isBinary: false,
      hunks: [
        {
          header: "@@ -1,3 +1,3 @@",
          oldStart: 1,
          oldLines: 3,
          newStart: 1,
          newLines: 3,
          lines: [
            { type: "add", newLineNumber: 2, content: "  console.log('debug');", position: 2 },
          ],
        },
      ],
      lineMap: new Map([[2, 2]]),
    });

    const findings = runRuleBasedChecks(mockDiffMap, rules);
    expect(findings.length).toBe(1);
    expect(findings[0].file).toBe("src/index.ts");
    expect(findings[0].line).toBe(2);
    expect(findings[0].title).toBe("Rule Check: no-console-log");
  });

  it("applies path overrides correctly", () => {
    const findings: Finding[] = [
      {
        file: "src/payments/service.ts",
        line: 10,
        severity: "info",
        category: "style",
        title: "Nit",
        message: "style nit",
        suggestion: null,
        confidence: 0.9,
      },
      {
        file: "docs/readme.md",
        line: 1,
        severity: "warning",
        category: "docs",
        title: "Doc issue",
        message: "doc",
        suggestion: null,
        confidence: 0.9,
      },
    ];

    const paths: Record<string, PathConfig> = {
      "src/payments/**": {
        "severity-threshold": "error", // filters out info and warning
      },
      "docs/**": {
        ignore: true, // completely ignored
      },
    };

    const result = applyPathOverrides(findings, paths);
    expect(result.length).toBe(0);
  });

  it("aggregates and dedupes multiple chunk reviews", () => {
    const chunk1: ChunkReview = {
      summary: "First chunk summary.",
      findings: [
        {
          file: "src/app.ts",
          line: 20,
          severity: "error",
          category: "bug",
          title: "Critical Bug",
          message: "Null dereference",
          suggestion: null,
          confidence: 0.9,
        },
      ],
    };

    const chunk2: ChunkReview = {
      summary: "Second chunk summary.",
      findings: [
        {
          file: "src/app.ts",
          line: 20,
          severity: "error",
          category: "bug",
          title: "Critical Bug",
          message: "Null dereference",
          suggestion: null,
          confidence: 0.9,
        },
        {
          file: "src/low.ts",
          line: 5,
          severity: "info",
          category: "style",
          title: "Low confidence",
          message: "Maybe rename",
          suggestion: null,
          confidence: 0.4, // below minConfidence (0.6)
        },
      ],
    };

    const aggregated = aggregateReviews([chunk1, chunk2], 0.6, "info");
    expect(aggregated.findings.length).toBe(1); // Deduped & low confidence filtered
    expect(aggregated.summary).toContain("First chunk summary.");
    expect(aggregated.summary).toContain("Second chunk summary.");
  });
});
