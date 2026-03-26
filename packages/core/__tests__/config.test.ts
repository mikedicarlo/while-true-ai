import { describe, it, expect } from "vitest";
import { AppSettingsSchema } from "../src/config/settings.js";

describe("AppSettings", () => {
  it("should parse empty config with all defaults", () => {
    const settings = AppSettingsSchema.parse({});
    expect(settings.appName).toBe("while_true_ai");
    expect(settings.environment).toBe("development");
    expect(settings.loop.minSleepSeconds).toBe(1.0);
    expect(settings.loop.maxSleepSeconds).toBe(300.0);
    expect(settings.budget.maxCostPerDayUsd).toBe(100.0);
    expect(settings.memory.shortTermMaxEntries).toBe(50);
    expect(settings.safety.maxActionsPerCycle).toBe(25);
    expect(settings.providers).toEqual([]);
    expect(settings.api.port).toBe(4200);
  });

  it("should override defaults with provided values", () => {
    const settings = AppSettingsSchema.parse({
      appName: "test-agent",
      loop: { baseIdleSleep: 5.0 },
      budget: { maxCostPerDayUsd: 50.0 },
    });
    expect(settings.appName).toBe("test-agent");
    expect(settings.loop.baseIdleSleep).toBe(5.0);
    expect(settings.loop.minSleepSeconds).toBe(1.0); // Still default
    expect(settings.budget.maxCostPerDayUsd).toBe(50.0);
  });

  it("should parse provider configs", () => {
    const settings = AppSettingsSchema.parse({
      providers: [
        {
          modelId: "gpt-4o",
          adapter: "openai",
          purpose: "acting",
          apiKeyEnv: "OPENAI_API_KEY",
        },
        {
          modelId: "kimi-k2.5",
          adapter: "openai",
          purpose: "deciding",
          baseUrl: "https://api.moonshot.cn/v1",
          apiKeyEnv: "MOONSHOT_API_KEY",
          maxTokens: 8192,
        },
      ],
    });
    expect(settings.providers).toHaveLength(2);
    expect(settings.providers[0].modelId).toBe("gpt-4o");
    expect(settings.providers[1].baseUrl).toBe(
      "https://api.moonshot.cn/v1",
    );
  });

  it("should reject invalid adapter type", () => {
    expect(() =>
      AppSettingsSchema.parse({
        providers: [
          { modelId: "test", adapter: "invalid", purpose: "acting" },
        ],
      }),
    ).toThrow();
  });
});
