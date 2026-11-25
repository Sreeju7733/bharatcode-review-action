import * as core from "@actions/core";
import { UpstreamError } from "../errors.js";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatOptions {
  model: string;
  temperature?: number;
  responseFormatJson?: boolean;
}

export interface ChatResponse {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResponse>;
}

export class BharatCodeProvider implements LLMProvider {
  public readonly name = "bharatcode";
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(apiKey: string, baseUrl: string, timeoutMs: number, maxRetries: number) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: opts.model,
      temperature: opts.temperature ?? 0.1,
      response_format: opts.responseFormatJson ? { type: "json_object" } : undefined,
      messages,
    });

    let attempt = 0;
    const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        core.debug(`[BharatCode] Request (attempt ${attempt + 1}/${this.maxRetries + 1}) to ${url}`);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const data = (await response.json()) as any;
          return {
            content: data.choices?.[0]?.message?.content || "",
            usage: data.usage,
          };
        }

        const status = response.status;
        const errText = await response.text();
        const isRetryable = RETRYABLE_STATUSES.includes(status);

        if (!isRetryable || attempt >= this.maxRetries) {
          throw new UpstreamError(
            `BharatCode API failed with HTTP ${status}: ${errText}`,
            status,
            errText,
            isRetryable
          );
        }

        let delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) delayMs = seconds * 1000;
        }

        core.warning(`[BharatCode] HTTP ${status}. Retrying in ${Math.round(delayMs)}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
      } catch (err: any) {
        clearTimeout(timer);
        if (err instanceof UpstreamError) throw err;

        const isAbort = err.name === "AbortError" || controller.signal.aborted;
        const msg = isAbort ? `Timeout after ${this.timeoutMs}ms` : err.message;
        if (attempt >= this.maxRetries) {
          throw new UpstreamError(`[BharatCode] Request failed: ${msg}`, 500, msg, false);
        }
        const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        core.warning(`[BharatCode] Error: ${msg}. Retrying in ${Math.round(delayMs)}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
      }
    }

    throw new UpstreamError("[BharatCode] Max retries exhausted", 500, undefined, false);
  }
}

export class OpenAIProvider implements LLMProvider {
  public readonly name = "openai";
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResponse> {
    const model = opts.model.includes("gpt") ? opts.model : "gpt-4o-mini";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      core.info(`[OpenAI Fallback] Calling model ${model}...`);
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: opts.temperature ?? 0.1,
          response_format: opts.responseFormatJson ? { type: "json_object" } : undefined,
          messages,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
        throw new UpstreamError(`OpenAI API HTTP ${response.status}: ${errText}`, response.status, errText, isRetryable);
      }

      const data = (await response.json()) as any;
      return {
        content: data.choices?.[0]?.message?.content || "",
        usage: data.usage,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof UpstreamError) throw err;
      throw new UpstreamError(`OpenAI request failed: ${err.message}`, 500, err.message, true);
    }
  }
}

export class AnthropicProvider implements LLMProvider {
  public readonly name = "anthropic";
  private apiKey: string;
  private timeoutMs: number;

  constructor(apiKey: string, timeoutMs = 60000) {
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResponse> {
    const model = opts.model.includes("claude") ? opts.model : "claude-3-5-sonnet-20241022";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    // Extract system message from messages array
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const userMessages = messages.filter((m) => m.role !== "system");

    try {
      core.info(`[Anthropic Fallback] Calling model ${model}...`);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          temperature: opts.temperature ?? 0.1,
          system: systemMsg,
          messages: userMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errText = await response.text();
        const isRetryable = [429, 500, 502, 503, 504].includes(response.status);
        throw new UpstreamError(`Anthropic API HTTP ${response.status}: ${errText}`, response.status, errText, isRetryable);
      }

      const data = (await response.json()) as any;
      const content = data.content?.[0]?.text || "";
      return {
        content,
        usage: {
          prompt_tokens: data.usage?.input_tokens,
          completion_tokens: data.usage?.output_tokens,
        },
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (err instanceof UpstreamError) throw err;
      throw new UpstreamError(`Anthropic request failed: ${err.message}`, 500, err.message, true);
    }
  }
}

export async function resilientChat(
  primary: LLMProvider,
  fallbacks: LLMProvider[],
  messages: ChatMessage[],
  opts: ChatOptions
): Promise<ChatResponse> {
  try {
    return await primary.chat(messages, opts);
  } catch (err: any) {
    // If not retryable (e.g. 401 Unauthorized / Bad Request), rethrow immediately
    if (err instanceof UpstreamError && !err.retryable) {
      throw err;
    }

    core.warning(`Primary provider '${primary.name}' failed: ${err.message}. Checking ${fallbacks.length} fallback provider(s)...`);

    for (const fb of fallbacks) {
      try {
        core.info(`Trying fallback provider: ${fb.name}`);
        return await fb.chat(messages, opts);
      } catch (fbErr: any) {
        core.warning(`Fallback provider '${fb.name}' also failed: ${fbErr.message}`);
      }
    }

    throw new UpstreamError(`All LLM providers (primary and fallbacks) failed. Last error: ${err.message}`, 500, undefined, false);
  }
}
