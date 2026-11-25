import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseUnifiedDiff } from "../../src/diff/parse.js";
import { filterDiffFiles } from "../../src/diff/filter.js";

describe("Diff Noise Filtering (filter.ts)", () => {
  const fixturePath = path.resolve(__dirname, "../fixtures/sample.diff");
  const diffContent = fs.readFileSync(fixturePath, "utf-8");
  const diffMap = parseUnifiedDiff(diffContent);

  it("filters out binary files", () => {
    const filtered = filterDiffFiles(diffMap, [], []);
    expect(filtered.has("binary.png")).toBe(false);
  });

  it("filters out deleted files", () => {
    const filtered = filterDiffFiles(diffMap, [], []);
    expect(filtered.has("deleted.txt")).toBe(false);
  });

  it("filters files matching ignore-globs", () => {
    const filtered = filterDiffFiles(diffMap, ["src/math.ts"], []);
    expect(filtered.has("src/math.ts")).toBe(false);
    expect(filtered.has("src/multi.ts")).toBe(true);
  });

  it("keeps only files matching include-globs when provided", () => {
    const filtered = filterDiffFiles(diffMap, [], ["src/math.ts"]);
    expect(filtered.has("src/math.ts")).toBe(true);
    expect(filtered.has("src/multi.ts")).toBe(false);
  });
});
