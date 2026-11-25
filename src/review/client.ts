import * as core from "@actions/core";
import { UpstreamError } from "../errors.js";

export interface BharatCodeClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export class BharatCodeClient {
  private apiKey: string;
  private baseUrl: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(options: BharatCodeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries;
  }

  public async createChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    temperature = 0.1
  ): Promise<{ content: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
    const url = `${this.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages,
    });

    let attempt = 0;
    const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];

    while (attempt <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        core.debug(`BharatCode API request (attempt ${attempt + 1}/${this.maxRetries + 1}) to ${url}`);
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
          const choice = data.choices?.[0];
          const content = choice?.message?.content || "";
          return {
            content,
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

        // Handle Retry-After header if present
        let delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds) && seconds > 0) {
            delayMs = seconds * 1000;
          }
        }

        core.warning(
          `BharatCode API returned ${status}. Retrying in ${Math.round(delayMs)}ms... (Attempt ${
            attempt + 1
          }/${this.maxRetries})`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
      } catch (err: any) {
        clearTimeout(timer);

        if (err instanceof UpstreamError) {
          throw err;
        }

        const isAbort = err.name === "AbortError" || controller.signal.aborted;
        const errorMsg = isAbort
          ? `Request timed out after ${this.timeoutMs}ms`
          : err.message || "Network error";

        if (attempt >= this.maxRetries) {
          throw new UpstreamError(`BharatCode API request failed: ${errorMsg}`, 500, errorMsg, false);
        }

        const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        core.warning(
          `BharatCode API error: ${errorMsg}. Retrying in ${Math.round(delayMs)}ms... (Attempt ${
            attempt + 1
          }/${this.maxRetries})`
        );
        await new Promise((r) => setTimeout(r, delayMs));
        attempt++;
      }
    }

    throw new UpstreamError("BharatCode API max retries exhausted", 500, undefined, false);
  }
}
