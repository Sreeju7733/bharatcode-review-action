import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as core from "@actions/core";
import { parseInputs } from "../../src/inputs.js";
import { ConfigError } from "../../src/errors.js";

describe("Inputs (inputs.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses valid inputs with default fallbacks", () => {
    vi.spyOn(core, "getInput").mockImplementation((name: string) => {
      if (name === "bharatcode-api-key") return "test-api-key";
      if (name === "github-token") return "test-gh-token";
      return "";
    });
    vi.spyOn(core, "getBooleanInput").mockImplementation((name: string) => {
      if (name === "post-labels") return true;
      if (name === "dry-run") return false;
      if (name === "cache-enabled") return true;
      if (name === "allow-forks") return false;
      return false;
    });

    const inputs = parseInputs();
    expect(inputs.bharatcodeApiKey).toBe("test-api-key");
    expect(inputs.githubToken).toBe("test-gh-token");
    expect(inputs.model).toBe("glm-5.3-flash");
    expect(inputs.chunkStrategy).toBe("file");
    expect(inputs.mode).toBe("summary+inline");
    expect(inputs.severityThreshold).toBe("warning");
  });

  it("throws ConfigError on invalid chunk-strategy", () => {
    vi.spyOn(core, "getInput").mockImplementation((name: string) => {
      if (name === "bharatcode-api-key") return "test-api-key";
      if (name === "github-token") return "test-gh-token";
      if (name === "chunk-strategy") return "invalid-strategy";
      return "";
    });

    expect(() => parseInputs()).toThrow(ConfigError);
  });

  it("throws ConfigError on negative or non-numeric max-diff-chars", () => {
    vi.spyOn(core, "getInput").mockImplementation((name: string) => {
      if (name === "bharatcode-api-key") return "test-api-key";
      if (name === "github-token") return "test-gh-token";
      if (name === "max-diff-chars") return "-10";
      return "";
    });

    expect(() => parseInputs()).toThrow(ConfigError);
  });
});
