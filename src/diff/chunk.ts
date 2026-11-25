import { Chunk, ChunkStrategy, FileDiff } from "../types.js";

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function serializeHunk(hunk: FileDiff["hunks"][0]): string {
  const linesStr = hunk.lines
    .map((l) => {
      const prefix = l.type === "add" ? "+" : l.type === "del" ? "-" : " ";
      return `${prefix}${l.content}`;
    })
    .join("\n");
  return `${hunk.header}\n${linesStr}\n`;
}

export function chunkDiffs(
  diffMap: Map<string, FileDiff>,
  strategy: ChunkStrategy,
  maxInputTokens: number
): Chunk[] {
  const chunks: Chunk[] = [];

  if (strategy === "file") {
    // Strategy: file -> 1 API call per file
    let chunkIdx = 0;
    for (const [filePath, fileDiff] of diffMap.entries()) {
      let fileContent = `### File: ${filePath}\n`;
      const hunkIndices: number[] = [];

      fileDiff.hunks.forEach((hunk, idx) => {
        hunkIndices.push(idx);
        fileContent += serializeHunk(hunk);
      });

      const tokens = estimateTokens(fileContent);
      chunks.push({
        chunkId: `chunk-file-${chunkIdx++}-${filePath}`,
        files: [{ path: filePath, hunkIndices }],
        content: fileContent,
        estimatedTokens: tokens,
      });
    }
    return chunks;
  }

  if (strategy === "hunk") {
    // Strategy: hunk -> 1 call per hunk
    let chunkIdx = 0;
    for (const [filePath, fileDiff] of diffMap.entries()) {
      fileDiff.hunks.forEach((hunk, hIdx) => {
        const content = `### File: ${filePath} (Hunk ${hIdx + 1})\n${serializeHunk(hunk)}`;
        chunks.push({
          chunkId: `chunk-hunk-${chunkIdx++}`,
          files: [{ path: filePath, hunkIndices: [hIdx] }],
          content,
          estimatedTokens: estimateTokens(content),
        });
      });
    }
    return chunks;
  }

  if (strategy === "token") {
    // Strategy: token -> pack hunks until maxInputTokens
    let chunkIdx = 0;
    let currentContent = "";
    let currentFiles: { path: string; hunkIndices: number[] }[] = [];
    let currentTokens = 0;

    for (const [filePath, fileDiff] of diffMap.entries()) {
      for (let hIdx = 0; hIdx < fileDiff.hunks.length; hIdx++) {
        const hunk = fileDiff.hunks[hIdx];
        const hunkStr = `### File: ${filePath} (Hunk ${hIdx + 1})\n${serializeHunk(hunk)}`;
        const hunkTokens = estimateTokens(hunkStr);

        if (currentTokens + hunkTokens > maxInputTokens && currentContent.length > 0) {
          // Flush current chunk
          chunks.push({
            chunkId: `chunk-token-${chunkIdx++}`,
            files: currentFiles,
            content: currentContent,
            estimatedTokens: currentTokens,
          });
          currentContent = "";
          currentFiles = [];
          currentTokens = 0;
        }

        currentContent += hunkStr;
        currentTokens += hunkTokens;

        const existingFile = currentFiles.find((f) => f.path === filePath);
        if (existingFile) {
          existingFile.hunkIndices.push(hIdx);
        } else {
          currentFiles.push({ path: filePath, hunkIndices: [hIdx] });
        }
      }
    }

    if (currentContent.length > 0) {
      chunks.push({
        chunkId: `chunk-token-${chunkIdx++}`,
        files: currentFiles,
        content: currentContent,
        estimatedTokens: currentTokens,
      });
    }

    return chunks;
  }

  return chunks;
}
