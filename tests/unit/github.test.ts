import { describe, it, expect, vi } from "vitest";
import { formatSummaryComment, upsertSummaryComment, COMMENT_MARKER } from "../../src/github/comments.js";
import { postInlineReview } from "../../src/github/review.js";
import { syncLabels } from "../../src/github/labels.js";
import { createCheckRun } from "../../src/github/checks.js";
import { FileDiff, Finding } from "../../src/types.js";

describe("GitHub Integration (comments, reviews, labels, checks)", () => {
  const sampleFindings: Finding[] = [
    {
      file: "src/main.ts",
      line: 10,
      severity: "error",
      category: "bug",
      title: "Null Pointer",
      message: "Variable may be undefined",
      suggestion: "x?.y",
      confidence: 0.9,
    },
    {
      file: "src/main.ts",
      line: 25,
      severity: "warning",
      category: "performance",
      title: "Slow loop",
      message: "O(n^2) nested loop detected",
      suggestion: null,
      confidence: 0.8,
    },
  ];

  it("formats summary comment with markdown table and marker", () => {
    const formatted = formatSummaryComment("All checks evaluated.", sampleFindings, {
      totalFiles: 2,
      totalChars: 1200,
      estTokens: 300,
      estUsd: 0.0004,
    });

    expect(formatted).toContain(COMMENT_MARKER);
    expect(formatted).toContain("BharatCode PR Review");
    expect(formatted).toContain("Null Pointer");
    expect(formatted).toContain("O(n^2) nested loop");
    expect(formatted).toContain("Estimated cost:");
  });

  it("upserts summary comment creating new if none exists", async () => {
    const mockOctokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({ data: [] }),
          createComment: vi.fn().mockResolvedValue({ data: { html_url: "https://github.com/pr/1#issuecomment-1" } }),
          updateComment: vi.fn(),
        },
      },
    } as any;

    const url = await upsertSummaryComment(mockOctokit, "owner", "repo", 1, "body text");
    expect(url).toBe("https://github.com/pr/1#issuecomment-1");
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
  });

  it("upserts summary comment updating existing if marker found", async () => {
    const mockOctokit = {
      rest: {
        issues: {
          listComments: vi.fn().mockResolvedValue({
            data: [{ id: 999, body: `${COMMENT_MARKER} Previous review` }],
          }),
          updateComment: vi.fn().mockResolvedValue({ data: { html_url: "https://github.com/pr/1#issuecomment-999" } }),
        },
      },
    } as any;

    const url = await upsertSummaryComment(mockOctokit, "owner", "repo", 1, "new body text");
    expect(url).toBe("https://github.com/pr/1#issuecomment-999");
    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 999 })
    );
  });

  it("posts inline reviews mapping lines to diff hunks", async () => {
    const mockDiffMap = new Map<string, FileDiff>();
    mockDiffMap.set("src/main.ts", {
      oldPath: "src/main.ts",
      newPath: "src/main.ts",
      isNew: false,
      isDeleted: false,
      isRenamed: false,
      isBinary: false,
      hunks: [
        {
          header: "@@ -1,30 +1,30 @@",
          oldStart: 1,
          oldLines: 30,
          newStart: 1,
          newLines: 30,
          lines: [
            { type: "add", newLineNumber: 10, content: "foo", position: 5 },
            { type: "add", newLineNumber: 25, content: "bar", position: 15 },
          ],
        },
      ],
      lineMap: new Map([
        [10, 5],
        [25, 15],
      ]),
    });

    const mockOctokit = {
      rest: {
        pulls: {
          createReview: vi.fn().mockResolvedValue({
            data: { html_url: "https://github.com/pr/1#pullrequestreview-123" },
          }),
        },
      },
    } as any;

    const url = await postInlineReview(
      mockOctokit,
      "owner",
      "repo",
      1,
      "sha123",
      sampleFindings,
      mockDiffMap,
      "error"
    );

    expect(url).toBe("https://github.com/pr/1#pullrequestreview-123");
    expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "REQUEST_CHANGES", // because failOnSeverity === "error" and has an error
        comments: expect.arrayContaining([
          expect.objectContaining({ path: "src/main.ts", line: 10 }),
        ]),
      })
    );
  });

  it("syncs severity labels on PR correctly", async () => {
    const mockOctokit = {
      rest: {
        issues: {
          get: vi.fn().mockResolvedValue({
            data: { labels: [{ name: "nit" }] },
          }),
          addLabels: vi.fn().mockResolvedValue({}),
          removeLabel: vi.fn().mockResolvedValue({}),
        },
      },
    } as any;

    const labelMap = { error: "bug", warning: "needs-review", info: "nit" };
    // sampleFindings has error and warning, but NOT info
    await syncLabels(mockOctokit, "owner", "repo", 1, sampleFindings, labelMap);

    expect(mockOctokit.rest.issues.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ labels: expect.arrayContaining(["bug", "needs-review"]) })
    );
    expect(mockOctokit.rest.issues.removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ name: "nit" })
    );
  });

  it("creates check run with conclusion failure if severity threshold breached", async () => {
    const mockOctokit = {
      rest: {
        checks: {
          create: vi.fn().mockResolvedValue({}),
        },
      },
    } as any;

    await createCheckRun(mockOctokit, "owner", "repo", "sha-abc", sampleFindings, "error");
    expect(mockOctokit.rest.checks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        conclusion: "failure",
        name: "BharatCode Review Gate",
      })
    );
  });
});
