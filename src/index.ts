import * as core from "@actions/core";
import * as github from "@actions/github";
import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { parseInputs } from "./inputs.js";
import { loadRepoConfig, mergeConfig } from "./config.js";
import { fetchPullRequestDiff } from "./diff/fetch.js";
import { parseUnifiedDiff } from "./diff/parse.js";
import { filterDiffFiles } from "./diff/filter.js";
import { chunkDiffs, estimateTokens } from "./diff/chunk.js";
import { BharatCodeClient } from "./review/client.js";
import { PROMPT_VERSION, SYSTEM_PROMPT, createUserPrompt } from "./review/prompt.js";
import { parseReviewResponse } from "./review/parse.js";
import { aggregateReviews, applyPathOverrides, runRuleBasedChecks } from "./review/aggregate.js";
import { CacheStore } from "./cache/store.js";
import { formatSummaryComment, upsertSummaryComment } from "./github/comments.js";
import { postInlineReview } from "./github/review.js";
import { syncLabels } from "./github/labels.js";
import { createCheckRun } from "./github/checks.js";
import { convertFindingsToSarif } from "./sarif.js";
import { Telemetry } from "./telemetry.js";
import { BudgetExceededError, ConfigError } from "./errors.js";
import { ChunkReview, Finding } from "./types.js";

// Pricing per 1k tokens: [input, output] in USD
const MODEL_PRICING: Record<string, [number, number]> = {
  "deepseek-v4.1-flash": [0.00014, 0.00028],
  "deepseek-v4.1-pro": [0.0008, 0.0016],
  default: [0.0002, 0.0004],
};

export async function run(): Promise<void> {
  const telemetry = Telemetry.getInstance();
  const rootSpan = telemetry.startSpan("action_run");

  // Global safety timeout: abort after 10 min
  const globalTimeout = setTimeout(() => {
    core.setFailed("Action timed out after 10 minutes global limit.");
    process.exit(1);
  }, 10 * 60 * 1000);

  // Clean exit on SIGTERM
  process.on("SIGTERM", async () => {
    core.warning("Received SIGTERM. Flushing telemetry and exiting...");
    await telemetry.flush();
    process.exit(0);
  });

  try {
    core.info("🚀 Initializing BharatCode PR Reviewer...");

    const inputs = parseInputs();
    const repoConfig = loadRepoConfig(inputs.configPath);
    const { effectiveInputs, rules, paths } = mergeConfig(inputs, repoConfig);

    // Check if event is pull_request OR issue_comment on a PR
    const context = github.context;
    let prNumber: number;
    let commitSha: string;
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    const pullRequest = context.payload.pull_request;
    const issue = context.payload.issue;
    const comment = context.payload.comment;

    const octokit = github.getOctokit(effectiveInputs.githubToken, {
      request: { fetch: globalThis.fetch },
    });

    if (pullRequest) {
      prNumber = pullRequest.number;
      commitSha = pullRequest.head.sha;

      // Fork guard: skip if head repo full name is different, unless allow-forks is true
      const headRepoFullName = pullRequest.head?.repo?.full_name;
      const baseRepoFullName = pullRequest.base?.repo?.full_name || `${owner}/${repo}`;
      if (headRepoFullName && headRepoFullName !== baseRepoFullName && !effectiveInputs.allowForks) {
        core.info(
          `Skipping review: Pull request is from a fork (${headRepoFullName}) and allow-forks is disabled.`
        );
        return;
      }
    } else if (issue && issue.pull_request && comment) {
      // Triggered by issue_comment
      const commentBody = comment.body?.trim() || "";
      if (!commentBody.startsWith("/bharatcode review")) {
        core.info("Comment does not trigger /bharatcode review. Skipping.");
        return;
      }

      // Permission check: only allow OWNER, MEMBER, or COLLABORATOR
      const authorAssoc = comment.author_association;
      const allowedAssoc = ["OWNER", "MEMBER", "COLLABORATOR"];
      if (!allowedAssoc.includes(authorAssoc)) {
        core.warning(
          `User ${comment.user?.login} has association '${authorAssoc}' and is not authorized to trigger /bharatcode review.`
        );
        return;
      }

      prNumber = issue.number;
      core.info(`Triggered via slash command on PR #${prNumber} by ${comment.user?.login}`);

      // Add 👀 reaction to triggering comment
      try {
        await octokit.rest.reactions.createForIssueComment({
          owner,
          repo,
          comment_id: comment.id,
          content: "eyes",
        });
      } catch (e: any) {
        core.debug(`Failed to add reaction to comment: ${e.message}`);
      }

      // Fetch PR head SHA
      const prDetails = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });
      commitSha = prDetails.data.head.sha;
    } else {
      core.info("Event is neither a pull_request nor a PR issue_comment. Skipping BharatCode PR review.");
      return;
    }

    core.info(`Processing PR #${prNumber} on ${owner}/${repo} (Head SHA: ${commitSha})`);

    // 1. Fetch Diff
    const diffSpan = telemetry.startSpan("fetch_and_parse_diff");
    const rawDiff = await fetchPullRequestDiff(octokit, owner, repo, prNumber);
    const diffChars = rawDiff.length;
    const allFilesDiff = parseUnifiedDiff(rawDiff);

    core.info(`Fetched diff with ${allFilesDiff.size} file(s) (${diffChars} characters)`);

    // Pre-flight diff size check
    if (diffChars > effectiveInputs.maxDiffChars * 5) {
      core.warning(
        `Diff size (${diffChars} chars) significantly exceeds max-diff-chars (${effectiveInputs.maxDiffChars}). Aggressive filtering applied.`
      );
    }

    // Filter files
    const filteredDiff = filterDiffFiles(
      allFilesDiff,
      effectiveInputs.ignoreGlobs,
      effectiveInputs.includeGlobs
    );
    telemetry.endSpan(diffSpan, { totalFiles: allFilesDiff.size, filteredFiles: filteredDiff.size });

    if (filteredDiff.size === 0) {
      core.info("No matching files to review after filtering.");
      core.setOutput("findings-count", 0);
      core.setOutput("error-count", 0);
      core.setOutput("est-usd", "0.0000");
      return;
    }

    // 2. Local rule-based checks (regex, no API cost)
    core.info(`Executing ${rules.length} local regex rules...`);
    const ruleFindings = runRuleBasedChecks(filteredDiff, rules);

    // 3. Check Cache
    const cacheStore = new CacheStore();
    let aggregatedFindings: Finding[] = [];
    let reviewSummary = "";
    let estSpendUsd = 0;
    let cacheHit = false;

    if (effectiveInputs.cacheEnabled) {
      const cached = await cacheStore.get(commitSha, effectiveInputs.model, PROMPT_VERSION);
      if (cached) {
        core.info(`[Cache] Using cached review results for commit ${commitSha}`);
        reviewSummary = cached.summary;
        aggregatedFindings = cached.findings;
        cacheHit = true;
      }
    }

    // 4. LLM Review Pass if not cached
    if (!cacheHit) {
      // Chunk diff
      const chunks = chunkDiffs(
        filteredDiff,
        effectiveInputs.chunkStrategy,
        effectiveInputs.maxInputTokens
      );
      core.info(
        `Created ${chunks.length} review chunk(s) using '${effectiveInputs.chunkStrategy}' strategy`
      );

      // Pre-flight token check
      const totalEstimatedTokens = chunks.reduce((acc, c) => acc + c.estimatedTokens, 0);
      if (totalEstimatedTokens > effectiveInputs.maxInputTokens * 2) {
        core.warning(
          `Total estimated tokens (~${totalEstimatedTokens}) exceeds recommended limits. Review will proceed under concurrency and budget constraints.`
        );
      }

      const client = new BharatCodeClient({
        apiKey: effectiveInputs.bharatcodeApiKey,
        baseUrl: effectiveInputs.bharatcodeBaseUrl,
        timeoutMs: effectiveInputs.requestTimeoutMs,
        maxRetries: effectiveInputs.maxRetries,
        fallbackProviders: effectiveInputs.fallbackProviders,
        openaiApiKey: effectiveInputs.openaiApiKey,
        anthropicApiKey: effectiveInputs.anthropicApiKey,
      });

      const pricing = MODEL_PRICING[effectiveInputs.model] || MODEL_PRICING.default;
      const limit = pLimit(effectiveInputs.concurrency);
      const chunkReviews: ChunkReview[] = [];

      let runningCost = 0;

      const reviewPromises = chunks.map((chunk, index) =>
        limit(async () => {
          // Check budget before launching chunk
          if (effectiveInputs.maxUsdBudget > 0 && runningCost >= effectiveInputs.maxUsdBudget) {
            core.warning(
              `USD budget reached: $${runningCost.toFixed(4)} >= $${effectiveInputs.maxUsdBudget.toFixed(
                4
              )}. Skipping remaining chunks.`
            );
            return null;
          }

          const userPrompt = createUserPrompt(chunk.content);
          core.info(`Reviewing chunk ${index + 1}/${chunks.length} (${chunk.chunkId})...`);

          const completion = await client.createChatCompletion(effectiveInputs.model, [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ]);

          // Compute usage cost
          const inTokens = completion.usage?.prompt_tokens ?? chunk.estimatedTokens;
          const outTokens =
            completion.usage?.completion_tokens ?? estimateTokens(completion.content);
          const chunkCost = (inTokens / 1000) * pricing[0] + (outTokens / 1000) * pricing[1];
          runningCost += chunkCost;

          const parsedReview = parseReviewResponse(
            completion.content,
            chunk.files[0]?.path || "general"
          );
          return parsedReview;
        })
      );

      const results = await Promise.all(reviewPromises);
      for (const res of results) {
        if (res) chunkReviews.push(res);
      }

      estSpendUsd = runningCost;

      // Aggregate and dedupe LLM reviews
      const aggregated = aggregateReviews(
        chunkReviews,
        0.6,
        effectiveInputs.severityThreshold
      );
      reviewSummary = aggregated.summary;

      // Combine with rule-based findings
      aggregatedFindings = [...ruleFindings, ...aggregated.findings];

      // Cache results
      if (effectiveInputs.cacheEnabled) {
        await cacheStore.set(
          commitSha,
          effectiveInputs.model,
          PROMPT_VERSION,
          reviewSummary,
          aggregatedFindings
        );
      }
    }

    // 5. Apply Path Overrides
    aggregatedFindings = applyPathOverrides(aggregatedFindings, paths);

    // 6. Calculate Metrics & Outputs
    const errorCount = aggregatedFindings.filter((f) => f.severity === "error").length;
    const totalFindingsCount = aggregatedFindings.length;

    core.setOutput("findings-count", totalFindingsCount);
    core.setOutput("error-count", errorCount);
    core.setOutput("est-usd", estSpendUsd.toFixed(4));

    core.info(
      `Review complete. Total findings: ${totalFindingsCount} (${errorCount} errors). Estimated cost: $${estSpendUsd.toFixed(
        4
      )}`
    );

    // 7. SARIF Export (if enabled)
    if (effectiveInputs.sarifOutput) {
      const sarifReport = convertFindingsToSarif(aggregatedFindings);
      const outPath = path.resolve(process.cwd(), effectiveInputs.sarifPath);
      fs.writeFileSync(outPath, JSON.stringify(sarifReport, null, 2), "utf-8");
      core.info(`Generated SARIF 2.1.0 report at ${outPath}`);
    }

    // 8. Dry-Run Handling
    if (effectiveInputs.dryRun) {
      core.info("ℹ️ Running in DRY-RUN mode. Write API calls will be skipped.");
      console.log("=== DRY RUN SUMMARY ===");
      console.log(reviewSummary);
      console.log("=== DRY RUN FINDINGS ===");
      console.log(JSON.stringify(aggregatedFindings, null, 2));
      core.setOutput("review-url", "");
      return;
    }

    let reviewUrl = "";

    // 8. GitHub Actions Summary Page Output
    try {
      if (process.env.GITHUB_STEP_SUMMARY) {
        await core.summary
          .addHeading("👁️ BharatCode PR Review Summary")
          .addTable([
            [
              { data: "Total Findings", header: true },
              { data: "Errors", header: true },
              { data: "Warnings", header: true },
              { data: "Est. Spend (USD)", header: true },
            ],
            [
              String(totalFindingsCount),
              String(errorCount),
              String(aggregatedFindings.filter((f) => f.severity === "warning").length),
              `$${estSpendUsd.toFixed(4)}`,
            ],
          ])
          .addRaw(`\n\n${reviewSummary}\n\n`)
          .write();
      }
    } catch (e: any) {
      core.debug(`Failed to write step summary: ${e.message}`);
    }

    // 9. Summary Comment Upsert (mode: summary or summary+inline)
    if (effectiveInputs.mode === "summary" || effectiveInputs.mode === "summary+inline") {
      const summaryBody = formatSummaryComment(reviewSummary, aggregatedFindings, {
        totalFiles: filteredDiff.size,
        totalChars: diffChars,
        estTokens: estimateTokens(rawDiff),
        estUsd: estSpendUsd,
      });

      const url = await upsertSummaryComment(octokit, owner, repo, prNumber, summaryBody);
      reviewUrl = url;
    }

    // 10. Inline Review Comments (mode: inline or summary+inline)
    if (effectiveInputs.mode === "inline" || effectiveInputs.mode === "summary+inline") {
      const inlineUrl = await postInlineReview(
        octokit,
        owner,
        repo,
        prNumber,
        commitSha,
        aggregatedFindings,
        filteredDiff,
        effectiveInputs.failOnSeverity
      );
      if (inlineUrl) {
        reviewUrl = inlineUrl;
      }
    }

    core.setOutput("review-url", reviewUrl);

    // 11. Sync Labels
    if (effectiveInputs.postLabels) {
      await syncLabels(octokit, owner, repo, prNumber, aggregatedFindings, effectiveInputs.labelMap);
    }

    // 12. Check Run Gate (mode: gate)
    if (effectiveInputs.mode === "gate") {
      await createCheckRun(
        octokit,
        owner,
        repo,
        commitSha,
        aggregatedFindings,
        effectiveInputs.failOnSeverity
      );
    }

    // 13. Fail action if fail-on-severity matches
    if (
      effectiveInputs.failOnSeverity === "error" &&
      errorCount > 0
    ) {
      core.setFailed(`Review failed: Found ${errorCount} error-level finding(s).`);
    } else if (
      effectiveInputs.failOnSeverity === "warning" &&
      (errorCount > 0 || aggregatedFindings.some((f) => f.severity === "warning"))
    ) {
      core.setFailed("Review failed: Found error or warning-level finding(s).");
    }

    telemetry.endSpan(rootSpan, { status: "success" });
  } catch (error: any) {
    telemetry.endSpan(rootSpan, { status: "error", error: error.message });
    if (error instanceof ConfigError) {
      core.setFailed(`Configuration Error: ${error.message}`);
    } else if (error instanceof BudgetExceededError) {
      core.setFailed(error.message);
    } else {
      core.setFailed(`BharatCode Action Error: ${error.message}`);
    }
  } finally {
    clearTimeout(globalTimeout);
    await telemetry.flush();
  }
}

if (process.env.NODE_ENV !== "test") {
  run();
}
