import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseUnifiedDiff } from "../../src/diff/parse.js";
import { getDiffPosition, isLineAdded } from "../../src/diff/lineMap.js";

describe("Line Map (lineMap.ts)", () => {
  const fixturePath = path.resolve(__dirname, "../fixtures/sample.diff");
  const diffContent = fs.readFileSync(fixturePath, "utf-8");
  const diffMap = parseUnifiedDiff(diffContent);

  it("maps added lines to correct diff position for new file", () => {
    const mathFile = diffMap.get("src/math.ts")!;
    expect(mathFile).toBeDefined();

    // In src/math.ts:
    // header is position 1
    // lines 1-5 are positions 2, 3, 4, 5, 6
    expect(getDiffPosition(mathFile, 1)).toBe(2);
    expect(getDiffPosition(mathFile, 2)).toBe(3);
    expect(getDiffPosition(mathFile, 5)).toBe(6);
    expect(isLineAdded(mathFile, 1)).toBe(true);
    expect(isLineAdded(mathFile, 100)).toBe(false);
  });

  it("maps lines across multiple hunks accurately", () => {
    const multiFile = diffMap.get("src/multi.ts")!;
    expect(multiFile).toBeDefined();

    // In src/multi.ts:
    // Hunk 1 header: @@ -10,3 +10,4 @@ -> position 1
    // context line (line 10): position 2
    // removed line: position 3
    // added line (line 11): position 4
    // context line (line 12): position 5
    // Hunk 2 header: @@ -30,2 +31,3 @@ -> position 6
    // context line (line 31): position 7
    // added line (line 32): position 8

    expect(getDiffPosition(multiFile, 11)).toBe(4);
    expect(isLineAdded(multiFile, 11)).toBe(true);

    expect(getDiffPosition(multiFile, 32)).toBe(8);
    expect(isLineAdded(multiFile, 32)).toBe(true);
  });

  it("returns null for lines not present in diff", () => {
    const mathFile = diffMap.get("src/math.ts")!;
    expect(getDiffPosition(mathFile, 999)).toBeNull();
  });
});
