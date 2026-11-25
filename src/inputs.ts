import * as core from "@actions/core";
import { ActionInputs, ChunkStrategy, FailOnSeverity, ReviewMode, Severity } from "./types.js";
import { ConfigError } from "./errors.js";

const VALID_CHUNK_STRATEGIES: ChunkStrategy[] = ["file", "hunk", "token"];
const VALID_MODES: ReviewMode[] = ["summary", "inline", "summary+inline", "gate"];
const VALID_SEVERITIES: Severity[] = ["info", "warning", "error"];
const VALID_FAIL_ON_SEVERITY: FailOnSeverity[] = ["none", "error", "warning"];

export function parseInputs(): ActionInputs {
  const bharatcodeApiKey = core.getInput("bharatcode-api-key", { required: true });
  const bharatcodeBaseUrl = core.getInput("bharatcode-base-url") || "https://api.bharatcode.ai/v1";
  const model = core.getInput("model") || "deepseek-v4.1-flash";
  const githubToken = core.getInput("github-token", { required: true });

  const maxDiffChars = parseInt(core.getInput("max-diff-chars") || "24000", 10);
  if (isNaN(maxDiffChars) || maxDiffChars <= 0) {
    throw new ConfigError(`Invalid max-diff-chars: ${core.getInput("max-diff-chars")}`);
  }

  const maxInputTokens = parseInt(core.getInput("max-input-tokens") || "60000", 10);
  if (isNaN(maxInputTokens) || maxInputTokens <= 0) {
    throw new ConfigError(`Invalid max-input-tokens: ${core.getInput("max-input-tokens")}`);
  }

  const chunkStrategyInput = (core.getInput("chunk-strategy") || "file").toLowerCase() as ChunkStrategy;
  if (!VALID_CHUNK_STRATEGIES.includes(chunkStrategyInput)) {
    throw new ConfigError(
      `Invalid chunk-strategy: "${chunkStrategyInput}". Allowed: ${VALID_CHUNK_STRATEGIES.join(", ")}`
    );
  }

  const ignoreGlobsInput = core.getInput("ignore-globs") || "**/*.lock,**/dist/**,**/*.min.js,**/*.map";
  const ignoreGlobs = ignoreGlobsInput
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const includeGlobsInput = core.getInput("include-globs") || "";
  const includeGlobs = includeGlobsInput
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const modeInput = (core.getInput("mode") || "summary+inline").toLowerCase() as ReviewMode;
  if (!VALID_MODES.includes(modeInput)) {
    throw new ConfigError(`Invalid mode: "${modeInput}". Allowed: ${VALID_MODES.join(", ")}`);
  }

  const severityThresholdInput = (core.getInput("severity-threshold") || "warning").toLowerCase() as Severity;
  if (!VALID_SEVERITIES.includes(severityThresholdInput)) {
    throw new ConfigError(
      `Invalid severity-threshold: "${severityThresholdInput}". Allowed: ${VALID_SEVERITIES.join(", ")}`
    );
  }

  const failOnSeverityInput = (core.getInput("fail-on-severity") || "none").toLowerCase() as FailOnSeverity;
  if (!VALID_FAIL_ON_SEVERITY.includes(failOnSeverityInput)) {
    throw new ConfigError(
      `Invalid fail-on-severity: "${failOnSeverityInput}". Allowed: ${VALID_FAIL_ON_SEVERITY.join(", ")}`
    );
  }

  const postLabels = core.getBooleanInput("post-labels");

  const labelMapRaw = core.getInput("label-map") || "error:bug,warning:needs-review,info:nit";
  const labelMap: Record<Severity, string> = {
    error: "bug",
    warning: "needs-review",
    info: "nit",
  };
  labelMapRaw.split(",").forEach((item) => {
    const [sev, label] = item.split(":").map((s) => s.trim());
    if (sev && label && (sev === "info" || sev === "warning" || sev === "error")) {
      labelMap[sev as Severity] = label;
    }
  });

  const maxRetries = parseInt(core.getInput("max-retries") || "3", 10);
  if (isNaN(maxRetries) || maxRetries < 0) {
    throw new ConfigError(`Invalid max-retries: ${core.getInput("max-retries")}`);
  }

  const requestTimeoutMs = parseInt(core.getInput("request-timeout-ms") || "60000", 10);
  if (isNaN(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new ConfigError(`Invalid request-timeout-ms: ${core.getInput("request-timeout-ms")}`);
  }

  const concurrency = parseInt(core.getInput("concurrency") || "3", 10);
  if (isNaN(concurrency) || concurrency <= 0) {
    throw new ConfigError(`Invalid concurrency: ${core.getInput("concurrency")}`);
  }

  const maxUsdBudget = parseFloat(core.getInput("max-usd-budget") || "0");
  if (isNaN(maxUsdBudget) || maxUsdBudget < 0) {
    throw new ConfigError(`Invalid max-usd-budget: ${core.getInput("max-usd-budget")}`);
  }

  const dryRun = core.getBooleanInput("dry-run");
  const cacheEnabled = core.getBooleanInput("cache-enabled");
  const allowForks = core.getBooleanInput("allow-forks");
  const configPath = core.getInput("config-path") || ".bharatcode-review.yml";

  return {
    bharatcodeApiKey,
    bharatcodeBaseUrl,
    model,
    githubToken,
    maxDiffChars,
    maxInputTokens,
    chunkStrategy: chunkStrategyInput,
    ignoreGlobs,
    includeGlobs,
    mode: modeInput,
    severityThreshold: severityThresholdInput,
    failOnSeverity: failOnSeverityInput,
    postLabels,
    labelMap,
    maxRetries,
    requestTimeoutMs,
    concurrency,
    maxUsdBudget,
    dryRun,
    cacheEnabled,
    allowForks,
    configPath,
  };
}
