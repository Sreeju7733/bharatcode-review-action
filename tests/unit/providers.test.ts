import { describe, it, expect, vi } from "vitest";
import {
  BharatCodeProvider,
  OpenAIProvider,
  AnthropicProvider,
  resilientChat,
} from "../../src/review/providers.js";
import { UpstreamError } from "../../src/errors.js";

describe("Multi-Provider Fallback (providers.ts)", () => {
  it("calls primary provider when successful", async () => {
    const primary = new BharatCodeProvider("bc-key", "https://bharatcode.ai/api/model/v1", 5000, 1);
    vi.spyOn(primary, "chat").mockResolvedValue({
      content: "primary content",
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const openai = new OpenAIProvider("openai-key");
    const spyOpenAI = vi.spyOn(openai, "chat");

    const res = await resilientChat(primary, [openai], [{ role: "user", content: "hi" }], {
      model: "test",
    });

    expect(res.content).toBe("primary content");
    expect(spyOpenAI).not.toHaveBeenCalled();
  });

  it("fails over to OpenAI when primary encounters retryable UpstreamError", async () => {
    const primary = new BharatCodeProvider("bc-key", "https://bharatcode.ai/api/model/v1", 5000, 1);
    vi.spyOn(primary, "chat").mockRejectedValue(new UpstreamError("500 Server Error", 500, "error", true));

    const openai = new OpenAIProvider("openai-key");
    vi.spyOn(openai, "chat").mockResolvedValue({
      content: "openai fallback content",
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    });

    const res = await resilientChat(primary, [openai], [{ role: "user", content: "hi" }], {
      model: "test",
    });

    expect(res.content).toBe("openai fallback content");
  });

  it("fails over to Anthropic when primary and OpenAI fail", async () => {
    const primary = new BharatCodeProvider("bc-key", "https://bharatcode.ai/api/model/v1", 5000, 1);
    vi.spyOn(primary, "chat").mockRejectedValue(new UpstreamError("500 Server Error", 500, "error", true));

    const openai = new OpenAIProvider("openai-key");
    vi.spyOn(openai, "chat").mockRejectedValue(new UpstreamError("OpenAI 429", 429, "rate limit", true));

    const anthropic = new AnthropicProvider("anthropic-key");
    vi.spyOn(anthropic, "chat").mockResolvedValue({
      content: "anthropic content",
    });

    const res = await resilientChat(primary, [openai, anthropic], [{ role: "user", content: "hi" }], {
      model: "test",
    });

    expect(res.content).toBe("anthropic content");
  });

  it("does not fallback on non-retryable 401 Unauthorized", async () => {
    const primary = new BharatCodeProvider("bc-key", "https://bharatcode.ai/api/model/v1", 5000, 1);
    vi.spyOn(primary, "chat").mockRejectedValue(new UpstreamError("401 Unauthorized", 401, "invalid key", false));

    const openai = new OpenAIProvider("openai-key");
    const spyOpenAI = vi.spyOn(openai, "chat");

    await expect(
      resilientChat(primary, [openai], [{ role: "user", content: "hi" }], { model: "test" })
    ).rejects.toThrow("401 Unauthorized");

    expect(spyOpenAI).not.toHaveBeenCalled();
  });
});
