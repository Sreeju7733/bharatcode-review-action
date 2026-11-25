import * as github from "@actions/github";
import * as core from "@actions/core";
import { GitHubApiError } from "../errors.js";

export async function fetchPullRequestDiff(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string> {
  try {
    core.info(`Fetching diff for ${owner}/${repo}#${pullNumber}`);
    const response = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      headers: {
        accept: "application/vnd.github.v3.diff",
      },
    });

    if (typeof response.data === "string") {
      return response.data;
    }
    if (response.data instanceof ArrayBuffer) {
      return Buffer.from(response.data).toString("utf-8");
    }
    if (ArrayBuffer.isView(response.data)) {
      return Buffer.from(
        response.data.buffer,
        response.data.byteOffset,
        response.data.byteLength
      ).toString("utf-8");
    }
    return String(response.data);
  } catch (err: any) {
    throw new GitHubApiError(`Failed to fetch pull request diff: ${err.message}`, err.status);
  }
}
