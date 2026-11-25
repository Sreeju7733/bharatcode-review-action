import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import * as core from "@actions/core";
import { ActionInputs, RepoConfigFile, RuleConfig, PathConfig } from "./types.js";

export function loadRepoConfig(configFilePath: string): RepoConfigFile | null {
  try {
    const fullPath = path.resolve(process.cwd(), configFilePath);
    if (!fs.existsSync(fullPath)) {
      core.debug(`No repo config file found at ${fullPath}`);
      return null;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const parsed = yaml.load(content) as RepoConfigFile;
    core.info(`Loaded repository config from ${configFilePath}`);
    return parsed || null;
  } catch (err: any) {
    core.warning(`Failed to parse repo config at ${configFilePath}: ${err.message}`);
    return null;
  }
}

export function mergeConfig(inputs: ActionInputs, repoConfig: RepoConfigFile | null): {
  effectiveInputs: ActionInputs;
  rules: RuleConfig[];
  paths: Record<string, PathConfig>;
} {
  if (!repoConfig) {
    return {
      effectiveInputs: inputs,
      rules: [],
      paths: {},
    };
  }

  // Inputs take precedence over repoConfig, but repoConfig can provide default overrides if inputs were not explicitly set or can be merged
  // Specifically: ignore-globs and include-globs merge
  const mergedIgnoreGlobs = Array.from(
    new Set([...inputs.ignoreGlobs, ...(repoConfig["ignore-globs"] || [])])
  );
  const mergedIncludeGlobs = Array.from(
    new Set([...inputs.includeGlobs, ...(repoConfig["include-globs"] || [])])
  );

  const effectiveInputs: ActionInputs = {
    ...inputs,
    // Note: The prompt states: "Repo-level config that merges over inputs (inputs win)"
    // So if inputs has default or custom, if we want repo-level defaults:
    // When input is default, we can allow repoConfig to override if present:
    model: (inputs.model === "glm-5.3-flash" || inputs.model === "deepseek-v4.1-flash") && repoConfig.model ? repoConfig.model : inputs.model,
    severityThreshold:
      inputs.severityThreshold === "warning" && repoConfig["severity-threshold"]
        ? repoConfig["severity-threshold"]
        : inputs.severityThreshold,
    failOnSeverity:
      inputs.failOnSeverity === "none" && repoConfig["fail-on-severity"]
        ? repoConfig["fail-on-severity"]
        : inputs.failOnSeverity,
    ignoreGlobs: mergedIgnoreGlobs,
    includeGlobs: mergedIncludeGlobs,
  };

  return {
    effectiveInputs,
    rules: repoConfig.rules || [],
    paths: repoConfig.paths || {},
  };
}
