import picomatch from "picomatch";
import { FileDiff } from "../types.js";
import * as core from "@actions/core";

export const MAX_FILE_DIFF_BYTES = 50 * 1024; // 50 KB per file cap

export function filterDiffFiles(
  diffMap: Map<string, FileDiff>,
  ignoreGlobs: string[],
  includeGlobs: string[]
): Map<string, FileDiff> {
  const filtered = new Map<string, FileDiff>();

  const isIgnored = ignoreGlobs.length > 0 ? picomatch(ignoreGlobs, { dot: true }) : () => false;
  const isIncluded = includeGlobs.length > 0 ? picomatch(includeGlobs, { dot: true }) : () => true;

  for (const [path, fileDiff] of diffMap.entries()) {
    // Skip binary files
    if (fileDiff.isBinary) {
      core.debug(`Skipping binary file: ${path}`);
      continue;
    }

    // Skip deleted files (nothing to review inline in the new commit)
    if (fileDiff.isDeleted) {
      core.debug(`Skipping deleted file: ${path}`);
      continue;
    }

    // Check glob ignore
    if (isIgnored(path)) {
      core.debug(`Skipping ignored file (ignore-globs): ${path}`);
      continue;
    }

    // Check glob include
    if (includeGlobs.length > 0 && !isIncluded(path)) {
      core.debug(`Skipping not-included file (include-globs): ${path}`);
      continue;
    }

    // Calculate approximate size of hunks in bytes
    let totalBytes = 0;
    for (const hunk of fileDiff.hunks) {
      totalBytes += hunk.header.length + 1;
      for (const line of hunk.lines) {
        totalBytes += line.content.length + 2;
      }
    }

    if (totalBytes > MAX_FILE_DIFF_BYTES) {
      core.warning(
        `Skipping file ${path}: diff size (${(totalBytes / 1024).toFixed(1)} KB) exceeds 50 KB cap`
      );
      continue;
    }

    filtered.set(path, fileDiff);
  }

  return filtered;
}
