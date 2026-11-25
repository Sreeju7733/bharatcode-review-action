import { FileDiff } from "../types.js";

/**
 * Maps a line number in the new file to the diff position required by GitHub inline review comments.
 * Returns null if the line does not exist in the diff or is not part of a modified/context hunk.
 */
export function getDiffPosition(fileDiff: FileDiff, lineNumber: number): number | null {
  if (!fileDiff || !fileDiff.lineMap) {
    return null;
  }
  return fileDiff.lineMap.get(lineNumber) ?? null;
}

/**
 * Checks if a given line number was an added/changed line in the diff.
 */
export function isLineAdded(fileDiff: FileDiff, lineNumber: number): boolean {
  if (!fileDiff || !fileDiff.hunks) {
    return false;
  }
  for (const hunk of fileDiff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add" && line.newLineNumber === lineNumber) {
        return true;
      }
    }
  }
  return false;
}
