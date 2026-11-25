import * as github from "@actions/github";
import * as core from "@actions/core";
import { FailOnSeverity, Finding } from "../types.js";
import { GitHubApiError } from "../errors.js";

export async function createCheckRun(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  headSha: string,
  findings: Finding[],
  failOnSeverity: FailOnSeverity
): Promise<void> {
  try {
    core.info(`Creating check run on commit ${headSha}...`);

    let conclusion: "success" | "failure" = "success";
    const hasError = findings.some((f) => f.severity === "error");
    const hasWarning = findings.some((f) => f.severity === "warning");

    if (failOnSeverity === "error" && hasError) {
      conclusion = "failure";
    } else if (failOnSeverity === "warning" && (hasError || hasWarning)) {
      conclusion = "failure";
    }

    const title =
      conclusion === "success"
        ? "BharatCode Review Passed"
        : "BharatCode Review Gate Blocked";

    const errorCount = findings.filter((f) => f.severity === "error").length;
    const warningCount = findings.filter((f) => f.severity === "warning").length;
    const infoCount = findings.filter((f) => f.severity === "info").length;

    const summary = `Found ${findings.length} issue(s): ${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info(s). Gate policy: fail on '${failOnSeverity}'.`;

    await octokit.rest.checks.create({
      owner,
      repo,
      name: "BharatCode Review Gate",
      head_sha: headSha,
      status: "completed",
      conclusion,
      output: {
        title,
        summary,
        text: `### Summary\n\n${summary}`,
      },
    });

    core.info(`Check run created with conclusion: ${conclusion}`);
  } catch (err: any) {
    throw new GitHubApiError(`Failed to create check run: ${err.message}`, err.status);
  }
}
