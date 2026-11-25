import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BharatCodeClient } from "../../src/review/client.js";
import { UpstreamError } from "../../src/errors.js";

describe("BharatCode Client (client.ts)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("successfully returns completion on 200 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary": "All good", "findings": []}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      }),
    });
    global.fetch = mockFetch;

    const client = new BharatCodeClient({
      apiKey: "test-key",
      baseUrl: "https://api.bharatcode.ai/v1",
      timeoutMs: 5000,
      maxRetries: 3,
    });

    const res = await client.createChatCompletion("deepseek-v4.1-flash", [
      { role: "user", content: "hello" },
    ]);

    expect(res.content).toBe('{"summary": "All good", "findings": []}');
    expect(res.usage?.prompt_tokens).toBe(100);
  });

  it("retries on 500 and succeeds when subsequent request succeeds", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
          headers: new Headers(),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary": "Success after retries", "findings": []}' } }],
        }),
      });
    });
    global.fetch = mockFetch;

    const client = new BharatCodeClient({
      apiKey: "test-key",
      baseUrl: "https://api.bharatcode.ai/v1",
      timeoutMs: 5000,
      maxRetries: 3,
    });

    const res = await client.createChatCompletion("deepseek-v4.1-flash", [
      { role: "user", content: "test" },
    ]);

    expect(callCount).toBe(3);
    expect(res.content).toContain("Success after retries");
  });

  it("throws UpstreamError when max retries exhausted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Persistent 500",
      headers: new Headers(),
    });
    global.fetch = mockFetch;

    const client = new BharatCodeClient({
      apiKey: "test-key",
      baseUrl: "https://api.bharatcode.ai/v1",
      timeoutMs: 1000,
      maxRetries: 2,
    });

    await expect(
      client.createChatCompletion("deepseek-v4.1-flash", [{ role: "user", content: "test" }])
    ).rejects.toThrow(UpstreamError);
  });

  it("honors Retry-After header", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => "Rate limit exceeded",
          headers: new Headers({ "retry-after": "1" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary": "Rate limit recovered", "findings": []}' } }],
        }),
      });
    });
    global.fetch = mockFetch;

    const client = new BharatCodeClient({
      apiKey: "test-key",
      baseUrl: "https://api.bharatcode.ai/v1",
      timeoutMs: 5000,
      maxRetries: 2,
    });

    const start = Date.now();
    const res = await client.createChatCompletion("deepseek-v4.1-flash", [
      { role: "user", content: "test" },
    ]);
    const duration = Date.now() - start;

    expect(callCount).toBe(2);
    expect(duration).toBeGreaterThanOrEqual(900); // ~1000ms from Retry-After: 1
    expect(res.content).toContain("Rate limit recovered");
  });
});
