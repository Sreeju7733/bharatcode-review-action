import * as github from "@actions/github";
import * as core from "@actions/core";
import { Finding, Severity } from "../types.js";
import { GitHubApiError } from "../errors.js";

export async function syncLabels(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
  findings: Finding[],
  labelMap: Record<Severity, string>
): Promise<void> {
  try {
    core.info(`Syncing severity labels on PR #${pullNumber}...`);

    // Determine active severities
    const activeSeverities = new Set<Severity>();
    for (const f of findings) {
      activeSeverities.add(f.severity);
    }

    // Fetch existing labels on PR
    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: pullNumber,
    });

    const currentLabels = (issue.labels || []).map((l: any) =>
      typeof l === "string" ? l : l.name
    );

    const labelsToAdd: string[] = [];
    const labelsToRemove: string[] = [];

    const severities: Severity[] = ["error", "warning", "info"];
    for (const sev of severities) {
      const targetLabel = labelMap[sev];
      if (!targetLabel) continue;

      if (activeSeverities.has(sev)) {
        if (!currentLabels.includes(targetLabel)) {
          labelsToAdd.push(targetLabel);
        }
      } else {
        if (currentLabels.includes(targetLabel)) {
          labelsToRemove.push(targetLabel);
        }
      }
    }

    if (labelsToAdd.length > 0) {
      core.info(`Adding labels: ${labelsToAdd.join(", ")}`);
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pullNumber,
        labels: labelsToAdd,
      });
    }

    for (const label of labelsToRemove) {
      core.info(`Removing label: ${label}`);
      try {
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number: pullNumber,
          name: label,
        });
      } catch (e: any) {
        // Label might already be gone
        core.debug(`Failed to remove label ${label}: ${e.message}`);
      }
    }
  } catch (err: any) {
    throw new GitHubApiError(`Failed to sync labels: ${err.message}`, err.status);
  }
}
