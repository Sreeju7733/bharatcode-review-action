import { describe, it, expect } from "vitest";
import {
  BharatCodeError,
  ConfigError,
  UpstreamError,
  BudgetExceededError,
  GitHubApiError,
  DiffParseError,
} from "../../src/errors.js";

describe("Errors (errors.ts)", () => {
  it("instantiates each error type with proper name and attributes", () => {
    const bce = new BharatCodeError("bc error");
    expect(bce.name).toBe("BharatCodeError");

    const ce = new ConfigError("config error");
    expect(ce.name).toBe("ConfigError");

    const ue = new UpstreamError("upstream error", 502, "bad gateway", true);
    expect(ue.name).toBe("UpstreamError");
    expect(ue.status).toBe(502);
    expect(ue.body).toBe("bad gateway");
    expect(ue.retryable).toBe(true);

    const be = new BudgetExceededError(5.5, 5.0);
    expect(be.name).toBe("BudgetExceededError");
    expect(be.currentSpend).toBe(5.5);
    expect(be.maxBudget).toBe(5.0);
    expect(be.message).toContain("USD budget exceeded");

    const ge = new GitHubApiError("github api error", 404);
    expect(ge.name).toBe("GitHubApiError");
    expect(ge.status).toBe(404);

    const de = new DiffParseError("diff parse error");
    expect(de.name).toBe("DiffParseError");
  });
});
