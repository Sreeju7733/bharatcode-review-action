import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { loadRepoConfig, mergeConfig } from "../../src/config.js";
import { ActionInputs } from "../../src/types.js";

describe("Repo Config (.bharatcode-review.yml loader & merge)", () => {
  const tmpConfigFile = path.resolve(process.cwd(), ".test-repo-config.yml");

  const baseInputs: ActionInputs = {
    bharatcodeApiKey: "key-123",
    bharatcodeBaseUrl: "https://api.bharatcode.ai/v1",
    model: "deepseek-v4.1-flash",
    githubToken: "token-abc",
    maxDiffChars: 24000,
    maxInputTokens: 60000,
    chunkStrategy: "file",
    ignoreGlobs: ["**/*.lock"],
    includeGlobs: [],
    mode: "summary+inline",
    severityThreshold: "warning",
    failOnSeverity: "none",
    postLabels: true,
    labelMap: { error: "bug", warning: "needs-review", info: "nit" },
    maxRetries: 3,
    requestTimeoutMs: 60000,
    concurrency: 3,
    maxUsdBudget: 0,
    dryRun: false,
    cacheEnabled: true,
    allowForks: false,
    configPath: ".test-repo-config.yml",
  };

  afterEach(() => {
    if (fs.existsSync(tmpConfigFile)) {
      fs.unlinkSync(tmpConfigFile);
    }
  });

  it("returns null if config file does not exist", () => {
    const cfg = loadRepoConfig("non-existent-config.yml");
    expect(cfg).toBeNull();
  });

  it("loads YAML config and merges into effective inputs", () => {
    const yamlContent = `
model: deepseek-v4.1-pro
severity-threshold: error
ignore-globs:
  - "docs/**"
rules:
  - name: "no-todo"
    pattern: "TODO"
    severity: info
paths:
  "src/auth/**":
    severity-threshold: error
`;
    fs.writeFileSync(tmpConfigFile, yamlContent, "utf-8");

    const repoConfig = loadRepoConfig(".test-repo-config.yml");
    expect(repoConfig).not.toBeNull();

    const { effectiveInputs, rules, paths } = mergeConfig(baseInputs, repoConfig);

    expect(effectiveInputs.model).toBe("deepseek-v4.1-pro");
    expect(effectiveInputs.severityThreshold).toBe("error");
    expect(effectiveInputs.ignoreGlobs).toContain("docs/**");
    expect(effectiveInputs.ignoreGlobs).toContain("**/*.lock");
    expect(rules.length).toBe(1);
    expect(paths["src/auth/**"]).toBeDefined();
  });
});
