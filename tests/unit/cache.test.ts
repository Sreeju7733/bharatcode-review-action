import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { CacheStore } from "../../src/cache/store.js";
import { Finding } from "../../src/types.js";

describe("Cache Store (store.ts)", () => {
  const testDir = path.resolve(process.cwd(), ".test-cache");
  let store: CacheStore;

  beforeEach(() => {
    store = new CacheStore(".test-cache");
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("generates deterministic cache keys based on sha, model, and promptVersion", () => {
    const k1 = store.getCacheKey("abc1234", "deepseek-v4.1-flash", "2.0.0");
    const k2 = store.getCacheKey("abc1234", "deepseek-v4.1-flash", "2.0.0");
    const k3 = store.getCacheKey("abc1234", "deepseek-v4.1-pro", "2.0.0");

    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });

  it("stores and retrieves review payload", async () => {
    const findings: Finding[] = [
      {
        file: "a.ts",
        line: 1,
        severity: "warning",
        category: "bug",
        title: "Test",
        message: "Msg",
        suggestion: null,
        confidence: 0.9,
      },
    ];

    await store.set("sha-123", "model-x", "1.0", "summary test", findings);
    const cached = await store.get("sha-123", "model-x", "1.0");

    expect(cached).not.toBeNull();
    expect(cached?.commitSha).toBe("sha-123");
    expect(cached?.summary).toBe("summary test");
    expect(cached?.findings.length).toBe(1);
  });

  it("returns null for non-existent cache keys", async () => {
    const cached = await store.get("sha-unknown", "model-x", "1.0");
    expect(cached).toBeNull();
  });
});
