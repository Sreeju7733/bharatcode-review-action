import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import { parseInputs } from "../../src/inputs.js";
import { ConfigError } from "../../src/errors.js";

describe("Inputs Validation Coverage (inputs.ts)", () => {
  beforeEach(() => {
    vi.spyOn(core, "getBooleanInput").mockImplementation((name) => {
      if (name === "post-labels") return true;
      if (name === "dry-run") return false;
      if (name === "cache-enabled") return true;
      if (name === "allow-forks") return false;
      return false;
    });
  });

  it("throws ConfigError on invalid mode", () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "key";
      if (name === "github-token") return "token";
      if (name === "mode") return "invalid-mode";
      return "";
    });
    expect(() => parseInputs()).toThrow(ConfigError);
  });

  it("throws ConfigError on invalid severity-threshold", () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "key";
      if (name === "github-token") return "token";
      if (name === "severity-threshold") return "catastrophic";
      return "";
    });
    expect(() => parseInputs()).toThrow(ConfigError);
  });

  it("throws ConfigError on invalid fail-on-severity", () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "key";
      if (name === "github-token") return "token";
      if (name === "fail-on-severity") return "panic";
      return "";
    });
    expect(() => parseInputs()).toThrow(ConfigError);
  });

  it("throws ConfigError on invalid request-timeout-ms or concurrency", () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "key";
      if (name === "github-token") return "token";
      if (name === "request-timeout-ms") return "-50";
      return "";
    });
    expect(() => parseInputs()).toThrow(ConfigError);
  });

  it("throws ConfigError on invalid max-usd-budget", () => {
    vi.spyOn(core, "getInput").mockImplementation((name) => {
      if (name === "bharatcode-api-key") return "key";
      if (name === "github-token") return "token";
      if (name === "max-usd-budget") return "-10";
      return "";
    });
    expect(() => parseInputs()).toThrow(ConfigError);
  });
});

