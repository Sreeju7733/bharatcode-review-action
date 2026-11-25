import * as github from "@actions/github";
import * as core from "@actions/core";
import { FailOnSeverity, FileDiff, Finding } from "../types.js";
import { GitHubApiError } from "../errors.js";
import { getDiffPosition } from "../diff/lineMap.js";

export async function postInlineReview(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  findings: Finding[],
  diffMap: Map<string, FileDiff>,
  failOnSeverity: FailOnSeverity
): Promise<string | null> {
  try {
    const inlineComments: {
      path: string;
      line: number;
      body: string;
    }[] = [];

    let hasFatalError = false;
    let hasFatalWarning = false;

    for (const f of findings) {
      if (f.severity === "error") hasFatalError = true;
      if (f.severity === "warning") hasFatalWarning = true;

      if (!f.line) {
        continue;
      }

      const fileDiff = diffMap.get(f.file);
      if (!fileDiff) {
        core.warning(`Cannot find file ${f.file} in diff map. Skipping inline comment.`);
        continue;
      }

      // Check if line exists in the diff line map
      const position = getDiffPosition(fileDiff, f.line);
      if (position === null) {
        core.warning(
          `Line ${f.line} in file ${f.file} is not part of a modified diff hunk. Dropping inline comment.`
        );
        continue;
      }

      let commentBody = `**[${f.severity.toUpperCase()}] ${f.title}** (\`${f.category}\`)\n\n${f.message}`;
      
      // Auto-fix suggestions: check that suggestion exists and is non-empty
      if (f.suggestion && f.suggestion.trim()) {
        commentBody += `\n\n\`\`\`suggestion\n${f.suggestion}\n\`\`\``;
      }

      inlineComments.push({
        path: f.file,
        line: f.line,
        body: commentBody,
      });
    }

    if (inlineComments.length === 0) {
      core.info("No inline comments to post.");
      return null;
    }

    // Determine review event: COMMENT or REQUEST_CHANGES
    let event: "COMMENT" | "REQUEST_CHANGES" = "COMMENT";
    if (failOnSeverity === "error" && hasFatalError) {
      event = "REQUEST_CHANGES";
    } else if (failOnSeverity === "warning" && (hasFatalError || hasFatalWarning)) {
      event = "REQUEST_CHANGES";
    }

    core.info(
      `Creating pull request review with ${inlineComments.length} inline comment(s) (Event: ${event})...`
    );

    const { data: review } = await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      event,
      body: `BharatCode automated inline review found ${inlineComments.length} point(s) of interest.`,
      comments: inlineComments,
    });

    return review.html_url;
  } catch (err: any) {
    throw new GitHubApiError(`Failed to post inline review: ${err.message}`, err.status);
  }
}
