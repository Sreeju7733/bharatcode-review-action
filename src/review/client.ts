import * as core from "@actions/core";
import { BharatCodeProvider, OpenAIProvider, AnthropicProvider, LLMProvider, resilientChat } from "./providers.js";

export interface BharatCodeClientOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
  fallbackProviders?: string[];
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export class BharatCodeClient {
  private primaryProvider: BharatCodeProvider;
  private fallbackProviders: LLMProvider[] = [];

  constructor(options: BharatCodeClientOptions) {
    this.primaryProvider = new BharatCodeProvider(
      options.apiKey,
      options.baseUrl,
      options.timeoutMs,
      options.maxRetries
    );

    if (options.fallbackProviders && options.fallbackProviders.length > 0) {
      for (const providerName of options.fallbackProviders) {
        if (providerName === "openai" && options.openaiApiKey) {
          this.fallbackProviders.push(new OpenAIProvider(options.openaiApiKey, options.timeoutMs));
        } else if (providerName === "anthropic" && options.anthropicApiKey) {
          this.fallbackProviders.push(new AnthropicProvider(options.anthropicApiKey, options.timeoutMs));
        } else {
          core.debug(`Fallback provider '${providerName}' skipped (missing API key or unsupported)`);
        }
      }
    }
  }

  public async createChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    temperature = 0.1
  ): Promise<{ content: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
    return resilientChat(
      this.primaryProvider,
      this.fallbackProviders,
      messages,
      {
        model,
        temperature,
        responseFormatJson: true,
      }
    );
  }
}
