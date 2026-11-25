import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseUnifiedDiff } from "../../src/diff/parse.js";

describe("Diff Parser (parse.ts)", () => {
  const fixturePath = path.resolve(__dirname, "../fixtures/sample.diff");
  const diffContent = fs.readFileSync(fixturePath, "utf-8");

  it("handles new files correctly", () => {
    const diffMap = parseUnifiedDiff(diffContent);
    expect(diffMap.has("src/math.ts")).toBe(true);
    const mathFile = diffMap.get("src/math.ts")!;
    expect(mathFile.isNew).toBe(true);
    expect(mathFile.hunks.length).toBe(1);
    expect(mathFile.hunks[0].lines.length).toBe(6);
  });

  it("handles renamed files correctly", () => {
    const diffMap = parseUnifiedDiff(diffContent);
    expect(diffMap.has("new-file.txt")).toBe(true);
    const renamed = diffMap.get("new-file.txt")!;
    expect(renamed.isRenamed).toBe(true);
    expect(renamed.oldPath).toBe("old-file.txt");
  });

  it("handles deleted files correctly", () => {
    const diffMap = parseUnifiedDiff(diffContent);
    expect(diffMap.has("deleted.txt")).toBe(true);
    const deleted = diffMap.get("deleted.txt")!;
    expect(deleted.isDeleted).toBe(true);
  });

  it("detects binary files correctly", () => {
    const diffMap = parseUnifiedDiff(diffContent);
    expect(diffMap.has("binary.png")).toBe(true);
    const bin = diffMap.get("binary.png")!;
    expect(bin.isBinary).toBe(true);
  });

  it("handles multi-hunk diffs correctly", () => {
    const diffMap = parseUnifiedDiff(diffContent);
    expect(diffMap.has("src/multi.ts")).toBe(true);
    const multi = diffMap.get("src/multi.ts")!;
    expect(multi.hunks.length).toBe(2);
    expect(multi.hunks[0].newStart).toBe(10);
    expect(multi.hunks[1].newStart).toBe(31);
  });

  it("returns empty map on empty diff text", () => {
    const diffMap = parseUnifiedDiff("");
    expect(diffMap.size).toBe(0);
  });
});
