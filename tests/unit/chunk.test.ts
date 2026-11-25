import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseUnifiedDiff } from "../../src/diff/parse.js";
import { chunkDiffs } from "../../src/diff/chunk.js";

describe("Diff Chunking (chunk.ts)", () => {
  const fixturePath = path.resolve(__dirname, "../fixtures/sample.diff");
  const diffContent = fs.readFileSync(fixturePath, "utf-8");
  const diffMap = parseUnifiedDiff(diffContent);

  it("respects 'file' chunking strategy", () => {
    const chunks = chunkDiffs(diffMap, "file", 1000);
    expect(chunks.length).toBe(diffMap.size);
    for (const chunk of chunks) {
      expect(chunk.files.length).toBe(1);
      expect(chunk.content).toContain("### File: ");
    }
  });

  it("respects 'hunk' chunking strategy", () => {
    const chunks = chunkDiffs(diffMap, "hunk", 1000);
    // src/math.ts has 1 hunk, src/multi.ts has 2 hunks -> at least 3 chunks
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const chunk of chunks) {
      expect(chunk.content).toContain("(Hunk ");
    }
  });

  it("respects 'token' chunking strategy and packs hunks within maxInputTokens", () => {
    // Pack into a single chunk if token limit is high
    const chunksLarge = chunkDiffs(diffMap, "token", 10000);
    expect(chunksLarge.length).toBe(1);

    // Pack into multiple chunks if token limit is small
    const chunksSmall = chunkDiffs(diffMap, "token", 30);
    expect(chunksSmall.length).toBeGreaterThan(1);
    for (const chunk of chunksSmall) {
      expect(chunk.estimatedTokens).toBeGreaterThan(0);
    }
  });
});
