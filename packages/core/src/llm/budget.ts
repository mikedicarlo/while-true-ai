import type { BudgetSettingsSchema } from "../config/settings.js";
import { z } from "zod";
import { getLogger } from "../observability/logger.js";

const log = getLogger("llm:budget");

type BudgetSettings = z.infer<typeof BudgetSettingsSchema>;

interface TokenWindow {
  tokens: number;
  cost: number;
  timestamp: number;
}

export class BudgetExhaustedError extends Error {
  constructor(
    public reason: string,
    public limit: number,
    public current: number,
  ) {
    super(`Budget exhausted: ${reason} (${current}/${limit})`);
    this.name = "BudgetExhaustedError";
  }
}

export class TokenBudgetManager {
  private minuteWindow: TokenWindow[] = [];
  private hourWindow: TokenWindow[] = [];
  private dayWindow: TokenWindow[] = [];
  private monthCost = 0;
  private monthStart: number;

  constructor(private settings: BudgetSettings) {
    this.monthStart = new Date().setDate(1);
  }

  checkBudget(estimatedTokens: number): void {
    this.pruneWindows();

    // Check per-call limit
    if (estimatedTokens > this.settings.maxTokensPerCall) {
      throw new BudgetExhaustedError(
        "tokens per call",
        this.settings.maxTokensPerCall,
        estimatedTokens,
      );
    }

    // Check per-minute limit
    const minuteTokens = this.sumTokens(this.minuteWindow);
    if (minuteTokens + estimatedTokens > this.settings.maxTokensPerMinute) {
      throw new BudgetExhaustedError(
        "tokens per minute",
        this.settings.maxTokensPerMinute,
        minuteTokens,
      );
    }

    // Check per-hour limit
    const hourTokens = this.sumTokens(this.hourWindow);
    if (hourTokens + estimatedTokens > this.settings.maxTokensPerHour) {
      throw new BudgetExhaustedError(
        "tokens per hour",
        this.settings.maxTokensPerHour,
        hourTokens,
      );
    }

    // Check per-day limits
    const dayTokens = this.sumTokens(this.dayWindow);
    if (dayTokens + estimatedTokens > this.settings.maxTokensPerDay) {
      throw new BudgetExhaustedError(
        "tokens per day",
        this.settings.maxTokensPerDay,
        dayTokens,
      );
    }

    const dayCost = this.sumCost(this.dayWindow);
    if (dayCost > this.settings.maxCostPerDayUsd) {
      throw new BudgetExhaustedError(
        "cost per day (USD)",
        this.settings.maxCostPerDayUsd,
        dayCost,
      );
    }

    // Check monthly cost
    if (this.monthCost > this.settings.maxCostPerMonthUsd) {
      throw new BudgetExhaustedError(
        "cost per month (USD)",
        this.settings.maxCostPerMonthUsd,
        this.monthCost,
      );
    }
  }

  recordUsage(tokens: number, costUsd: number): void {
    const now = Date.now();
    const entry: TokenWindow = { tokens, cost: costUsd, timestamp: now };
    this.minuteWindow.push(entry);
    this.hourWindow.push(entry);
    this.dayWindow.push(entry);

    // Reset monthly if new month
    const currentMonthStart = new Date().setDate(1);
    if (currentMonthStart !== this.monthStart) {
      this.monthCost = 0;
      this.monthStart = currentMonthStart;
    }
    this.monthCost += costUsd;

    log.debug({ tokens, costUsd, monthTotal: this.monthCost }, "Recorded usage");
  }

  get remainingDailyBudget(): number {
    this.pruneWindows();
    const dayCost = this.sumCost(this.dayWindow);
    return Math.max(0, this.settings.maxCostPerDayUsd - dayCost);
  }

  private pruneWindows(): void {
    const now = Date.now();
    this.minuteWindow = this.minuteWindow.filter(
      (w) => now - w.timestamp < 60_000,
    );
    this.hourWindow = this.hourWindow.filter(
      (w) => now - w.timestamp < 3_600_000,
    );
    this.dayWindow = this.dayWindow.filter(
      (w) => now - w.timestamp < 86_400_000,
    );
  }

  private sumTokens(window: TokenWindow[]): number {
    return window.reduce((sum, w) => sum + w.tokens, 0);
  }

  private sumCost(window: TokenWindow[]): number {
    return window.reduce((sum, w) => sum + w.cost, 0);
  }
}
