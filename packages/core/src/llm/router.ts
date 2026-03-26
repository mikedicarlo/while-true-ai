import type { ProviderConfig, LLMPurpose } from "../config/settings.js";
import type { LLMRequestOptions, LLMResponse } from "./models.js";
import { OpenAIAdapter } from "./adapters/openai.js";
import { AnthropicAdapter } from "./adapters/anthropic.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("llm:router");

type Adapter = OpenAIAdapter | AnthropicAdapter;

export class LLMRouter {
  private adapters = new Map<LLMPurpose, Adapter>();
  private configs = new Map<LLMPurpose, ProviderConfig>();

  constructor(providers: ProviderConfig[]) {
    for (const config of providers) {
      const adapter = this.createAdapter(config);
      this.adapters.set(config.purpose, adapter);
      this.configs.set(config.purpose, config);
      log.info(
        { purpose: config.purpose, model: config.modelId, adapter: config.adapter },
        "Registered LLM adapter",
      );
    }
  }

  async complete(
    purpose: LLMPurpose,
    options: LLMRequestOptions,
  ): Promise<LLMResponse> {
    const adapter = this.adapters.get(purpose);
    const config = this.configs.get(purpose);

    if (!adapter || !config) {
      // Fall back to any available adapter
      const fallback = this.adapters.values().next().value;
      if (!fallback) {
        throw new Error(`No LLM adapter configured for purpose: ${purpose}`);
      }
      log.warn({ purpose }, "No adapter for purpose, using fallback");
      return fallback.complete({
        ...options,
        maxTokens: options.maxTokens ?? 4096,
      });
    }

    return adapter.complete({
      ...options,
      maxTokens: options.maxTokens ?? config.maxTokens,
      temperature: options.temperature ?? config.temperature,
    });
  }

  getConfig(purpose: LLMPurpose): ProviderConfig | undefined {
    return this.configs.get(purpose);
  }

  hasAdapter(purpose: LLMPurpose): boolean {
    return this.adapters.has(purpose);
  }

  get availablePurposes(): LLMPurpose[] {
    return [...this.adapters.keys()];
  }

  private createAdapter(config: ProviderConfig): Adapter {
    const apiKey = config.apiKeyEnv
      ? process.env[config.apiKeyEnv]
      : undefined;

    switch (config.adapter) {
      case "openai":
      case "ollama":
        return new OpenAIAdapter({
          modelId: config.modelId,
          apiKey,
          baseUrl:
            config.adapter === "ollama"
              ? config.baseUrl ?? "http://localhost:11434/v1"
              : config.baseUrl,
        });

      case "anthropic":
        return new AnthropicAdapter({
          modelId: config.modelId,
          apiKey,
        });

      case "google":
        // Google uses OpenAI-compatible interface via baseURL
        return new OpenAIAdapter({
          modelId: config.modelId,
          apiKey,
          baseUrl:
            config.baseUrl ??
            "https://generativelanguage.googleapis.com/v1beta/openai/",
        });

      default:
        throw new Error(`Unknown adapter type: ${config.adapter}`);
    }
  }
}
