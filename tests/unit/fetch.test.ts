import { describe, it, expect, vi } from "vitest";
import { fetchPullRequestDiff } from "../../src/diff/fetch.js";
import { GitHubApiError } from "../../src/errors.js";

describe("Diff Fetch (fetch.ts)", () => {
  it("converts ArrayBuffer response data to string", async () => {
    const buffer = Buffer.from("diff --git a/a b/b\n+added", "utf-8").buffer;
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: buffer,
          }),
        },
      },
    } as any;

    const diff = await fetchPullRequestDiff(mockOctokit, "o", "r", 1);
    expect(diff).toContain("diff --git");
  });

  it("converts Uint8Array response data to string", async () => {
    const uint8 = new Uint8Array(Buffer.from("diff --git a/x b/y\n+foo", "utf-8"));
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: uint8,
          }),
        },
      },
    } as any;

    const diff = await fetchPullRequestDiff(mockOctokit, "o", "r", 1);
    expect(diff).toContain("diff --git");
  });

  it("throws GitHubApiError on pull request get failure", async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          get: vi.fn().mockRejectedValue(new Error("Network error")),
        },
      },
    } as any;

    await expect(fetchPullRequestDiff(mockOctokit, "o", "r", 1)).rejects.toThrow(GitHubApiError);
  });
});
