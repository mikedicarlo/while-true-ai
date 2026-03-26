import { describe, it, expect } from "vitest";
import { TokenBudgetManager, BudgetExhaustedError } from "../src/llm/budget.js";

describe("TokenBudgetManager", () => {
  const defaultSettings = {
    maxTokensPerCall: 150_000,
    maxTokensPerMinute: 2_000_000,
    maxTokensPerHour: 50_000_000,
    maxTokensPerDay: 200_000_000,
    maxCostPerDayUsd: 100.0,
    maxCostPerMonthUsd: 1000.0,
  };

  it("should allow requests within budget", () => {
    const budget = new TokenBudgetManager(defaultSettings);
    expect(() => budget.checkBudget(10_000)).not.toThrow();
  });

  it("should reject requests exceeding per-call limit", () => {
    const budget = new TokenBudgetManager(defaultSettings);
    expect(() => budget.checkBudget(200_000)).toThrow(BudgetExhaustedError);
  });

  it("should track remaining daily budget", () => {
    const budget = new TokenBudgetManager({
      ...defaultSettings,
      maxCostPerDayUsd: 10.0,
    });
    expect(budget.remainingDailyBudget).toBe(10.0);

    budget.recordUsage(1000, 3.0);
    expect(budget.remainingDailyBudget).toBeCloseTo(7.0);
  });

  it("should reject when daily cost exceeded", () => {
    const budget = new TokenBudgetManager({
      ...defaultSettings,
      maxCostPerDayUsd: 1.0,
    });
    budget.recordUsage(10_000, 1.5);
    expect(() => budget.checkBudget(100)).toThrow(BudgetExhaustedError);
  });

  it("should track usage across multiple calls", () => {
    const budget = new TokenBudgetManager({
      ...defaultSettings,
      maxTokensPerMinute: 5000,
    });
    budget.recordUsage(3000, 0.01);
    expect(() => budget.checkBudget(3000)).toThrow(BudgetExhaustedError);
  });
});
