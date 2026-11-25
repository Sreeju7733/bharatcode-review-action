import { describe, it, expect } from "vitest";
import { convertFindingsToSarif } from "../../src/sarif.js";
import { Finding } from "../../src/types.js";

describe("SARIF Converter (sarif.ts)", () => {
  it("converts findings to valid SARIF 2.1.0 format", () => {
    const findings: Finding[] = [
      {
        file: "src/auth.ts",
        line: 42,
        severity: "error",
        category: "security",
        title: "Hardcoded Credential",
        message: "Secret token detected in code.",
        suggestion: "process.env.SECRET",
        confidence: 0.95,
      },
      {
        file: "src/utils.ts",
        line: null,
        severity: "warning",
        category: "performance",
        title: "Memory leak",
        message: "Large map never cleared.",
        suggestion: null,
        confidence: 0.8,
      },
    ];

    const sarif = convertFindingsToSarif(findings);

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif-schema-2.1.0.json");
    expect(sarif.runs.length).toBe(1);

    const results = sarif.runs[0].results;
    expect(results.length).toBe(2);

    expect(results[0].ruleId).toBe("BC-SECURITY");
    expect(results[0].level).toBe("error");
    expect(results[0].locations[0].physicalLocation.artifactLocation.uri).toBe("src/auth.ts");
    expect(results[0].locations[0].physicalLocation.region?.startLine).toBe(42);

    expect(results[1].ruleId).toBe("BC-PERFORMANCE");
    expect(results[1].level).toBe("warning");
    expect(results[1].locations[0].physicalLocation.region).toBeUndefined();
  });
});
