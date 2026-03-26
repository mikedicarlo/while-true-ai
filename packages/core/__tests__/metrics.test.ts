import { describe, it, expect } from "vitest";
import { AgentMetrics } from "../src/observability/metrics.js";

describe("AgentMetrics", () => {
  it("should track cycles", () => {
    const metrics = new AgentMetrics();
    expect(metrics.cycleCount).toBe(0);
    metrics.recordCycle();
    metrics.recordCycle();
    expect(metrics.cycleCount).toBe(2);
  });

  it("should track tokens and cost", () => {
    const metrics = new AgentMetrics();
    metrics.recordTokens(1000, 0.003);
    metrics.recordTokens(500, 0.001);
    expect(metrics.totalTokensUsed).toBe(1500);
    expect(metrics.totalCostUsd).toBeCloseTo(0.004);
  });

  it("should track task outcomes", () => {
    const metrics = new AgentMetrics();
    metrics.recordTaskCompleted();
    metrics.recordTaskCompleted();
    metrics.recordTaskFailed();
    expect(metrics.tasksCompleted).toBe(2);
    expect(metrics.tasksFailed).toBe(1);
  });

  it("should report uptime", () => {
    const metrics = new AgentMetrics();
    expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
    expect(metrics.uptimeFormatted).toMatch(/\d+h \d+m \d+s/);
  });

  it("should serialize to JSON", () => {
    const metrics = new AgentMetrics();
    metrics.recordCycle();
    const json = metrics.toJSON();
    expect(json).toHaveProperty("cycleCount", 1);
    expect(json).toHaveProperty("totalTokensUsed");
    expect(json).toHaveProperty("uptimeFormatted");
  });
});
