import { DiffHunk, DiffLine, FileDiff } from "../types.js";

export function parseUnifiedDiff(diffText: string): Map<string, FileDiff> {
  const files = new Map<string, FileDiff>();
  if (!diffText || !diffText.trim()) {
    return files;
  }

  const rawLines = diffText.split(/\r?\n/);
  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let positionCounter = 0; // 1-based index within the diff file for GitHub inline comments

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (line.startsWith("diff --git ")) {
      // Starting a new file
      positionCounter = 0;
      currentHunk = null;

      // Extract paths: diff --git a/file1 b/file2
      const parts = line.split(" ");
      let oldPath = "";
      let newPath = "";
      if (parts.length >= 4) {
        oldPath = parts[2].replace(/^a\//, "");
        newPath = parts[3].replace(/^b\//, "");
      }

      currentFile = {
        oldPath,
        newPath,
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        isBinary: false,
        hunks: [],
        lineMap: new Map<number, number>(),
      };
      files.set(newPath || oldPath, currentFile);
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith("new file mode ")) {
      currentFile.isNew = true;
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      currentFile.isDeleted = true;
      continue;
    }
    if (line.startsWith("similarity index ")) {
      currentFile.isRenamed = true;
      continue;
    }
    if (line.startsWith("rename from ")) {
      currentFile.oldPath = line.substring("rename from ".length).trim();
      currentFile.isRenamed = true;
      continue;
    }
    if (line.startsWith("rename to ")) {
      currentFile.newPath = line.substring("rename to ".length).trim();
      currentFile.isRenamed = true;
      files.delete(currentFile.oldPath);
      files.set(currentFile.newPath, currentFile);
      continue;
    }
    if (line.startsWith("Binary files ") || line.includes("GIT binary patch")) {
      currentFile.isBinary = true;
      continue;
    }
    if (line.startsWith("--- ")) {
      if (line === "--- /dev/null") {
        currentFile.isNew = true;
      } else {
        const p = line.substring(4).trim().replace(/^a\//, "");
        if (p) currentFile.oldPath = p;
      }
      continue;
    }
    if (line.startsWith("+++ ")) {
      if (line === "+++ /dev/null") {
        currentFile.isDeleted = true;
      } else {
        const p = line.substring(4).trim().replace(/^b\//, "");
        if (p) {
          currentFile.newPath = p;
          files.set(p, currentFile);
        }
      }
      continue;
    }

    // Check for hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    if (line.startsWith("@@ ")) {
      positionCounter++;
      const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (match) {
        const oldStart = parseInt(match[1], 10);
        const oldLines = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newLines = match[4] !== undefined ? parseInt(match[4], 10) : 1;

        currentHunk = {
          header: line,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
      continue;
    }

    if (currentHunk) {
      positionCounter++;
      const firstChar = line[0];
      let currentNewNumber: number | undefined;
      let currentOldNumber: number | undefined;

      // Calculate line numbers
      let addedSoFar = 0;
      let delSoFar = 0;
      let normalSoFar = 0;
      for (const hl of currentHunk.lines) {
        if (hl.type === "add") addedSoFar++;
        else if (hl.type === "del") delSoFar++;
        else normalSoFar++;
      }

      let diffLine: DiffLine | null = null;

      if (firstChar === "+") {
        currentNewNumber = currentHunk.newStart + normalSoFar + addedSoFar;
        diffLine = {
          type: "add",
          newLineNumber: currentNewNumber,
          content: line.substring(1),
          position: positionCounter,
        };
        currentFile.lineMap.set(currentNewNumber, positionCounter);
      } else if (firstChar === "-") {
        currentOldNumber = currentHunk.oldStart + normalSoFar + delSoFar;
        diffLine = {
          type: "del",
          oldLineNumber: currentOldNumber,
          content: line.substring(1),
          position: positionCounter,
        };
      } else if (firstChar === " " || line === "") {
        currentOldNumber = currentHunk.oldStart + normalSoFar + delSoFar;
        currentNewNumber = currentHunk.newStart + normalSoFar + addedSoFar;
        diffLine = {
          type: "normal",
          oldLineNumber: currentOldNumber,
          newLineNumber: currentNewNumber,
          content: line.substring(1),
          position: positionCounter,
        };
        currentFile.lineMap.set(currentNewNumber, positionCounter);
      } else if (line.startsWith("\\ No newline at end of file")) {
        // Just an indicator line
        continue;
      }

      if (diffLine) {
        currentHunk.lines.push(diffLine);
      }
    }
  }

  return files;
}
