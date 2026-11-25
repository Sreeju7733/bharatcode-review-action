import * as github from "@actions/github";
import * as core from "@actions/core";
import { Finding, Severity } from "../types.js";
import { GitHubApiError } from "../errors.js";

export const COMMENT_MARKER = "<!-- bharatcode-review-action -->";

export function formatSummaryComment(
  summary: string,
  findings: Finding[],
  diffStats: { totalFiles: number; totalChars: number; estTokens: number; estUsd: number }
): string {
  const errorCount = findings.filter((f) => f.severity === "error").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;

  let body = `${COMMENT_MARKER}\n`;
  body += `## 👁️ BharatCode PR Review\n\n`;
  body += `${summary}\n\n`;

  body += `### 📊 Review Overview\n\n`;
  body += `| Total Findings | 🚨 Errors | ⚠️ Warnings | ℹ️ Infos |\n`;
  body += `| :--- | :--- | :--- | :--- |\n`;
  body += `| **${findings.length}** | **${errorCount}** | **${warningCount}** | **${infoCount}** |\n\n`;

  if (findings.length > 0) {
    body += `### 🔍 Detailed Findings\n\n`;
    body += `| Severity | Category | File:Line | Title & Message |\n`;
    body += `| :--- | :--- | :--- | :--- |\n`;

    // Sort by severity (error -> warning -> info)
    const sevOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
    const sorted = [...findings].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

    for (const f of sorted) {
      const sevIcon = f.severity === "error" ? "🚨" : f.severity === "warning" ? "⚠️" : "ℹ️";
      const fileLine = f.line ? `\`${f.file}:${f.line}\`` : `\`${f.file}\``;
      const titleEscaped = f.title.replace(/\|/g, "\\|");
      const msgEscaped = f.message.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
      body += `| ${sevIcon} ${f.severity} | \`${f.category}\` | ${fileLine} | **${titleEscaped}**<br>${msgEscaped} |\n`;
    }
    body += `\n`;
  }

  body += `<details>\n<summary>📈 <b>Review & Diff Diagnostics</b></summary>\n\n`;
  body += `- **Files analyzed:** ${diffStats.totalFiles}\n`;
  body += `- **Diff size:** ${diffStats.totalChars.toLocaleString()} characters (~${diffStats.estTokens.toLocaleString()} tokens)\n`;
  body += `- **Estimated cost:** $${diffStats.estUsd.toFixed(4)} USD\n`;
  body += `\n</details>\n\n`;
  body += `*Automated review powered by [BharatCode AI](https://bharatcode.ai)*`;

  return body;
}

export async function upsertSummaryComment(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  pullNumber: number,
  commentBody: string
): Promise<string> {
  try {
    core.info(`Searching for existing summary comment on PR #${pullNumber}...`);
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });

    const existingComment = comments.find((c) => c.body?.includes(COMMENT_MARKER));

    if (existingComment) {
      core.info(`Updating existing comment (ID: ${existingComment.id})`);
      const { data: updated } = await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
      return updated.html_url;
    } else {
      core.info("Creating new summary comment");
      const { data: created } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody,
      });
      return created.html_url;
    }
  } catch (err: any) {
    throw new GitHubApiError(`Failed to upsert summary comment: ${err.message}`, err.status);
  }
}
