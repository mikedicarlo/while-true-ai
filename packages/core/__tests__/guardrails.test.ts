import { describe, it, expect } from "vitest";
import { Guardrails, ActionDeniedError } from "../src/safety/guardrails.js";

describe("Guardrails", () => {
  it("should allow actions within limit", () => {
    const guard = new Guardrails({
      maxActionsPerCycle: 3,
      requireApprovalFor: [],
      killSwitchFile: "test",
    });

    expect(() => guard.checkAction("test_tool")).not.toThrow();
    expect(() => guard.checkAction("test_tool")).not.toThrow();
    expect(() => guard.checkAction("test_tool")).not.toThrow();
  });

  it("should deny actions exceeding limit", () => {
    const guard = new Guardrails({
      maxActionsPerCycle: 2,
      requireApprovalFor: [],
      killSwitchFile: "test",
    });

    guard.checkAction("a");
    guard.checkAction("b");
    expect(() => guard.checkAction("c")).toThrow(ActionDeniedError);
  });

  it("should reset cycle counter", () => {
    const guard = new Guardrails({
      maxActionsPerCycle: 1,
      requireApprovalFor: [],
      killSwitchFile: "test",
    });

    guard.checkAction("a");
    guard.resetCycle();
    expect(() => guard.checkAction("b")).not.toThrow();
  });

  it("should identify tools requiring approval", () => {
    const guard = new Guardrails({
      maxActionsPerCycle: 25,
      requireApprovalFor: ["robinhood", "tesla_unlock"],
      killSwitchFile: "test",
    });

    expect(guard.requiresApproval("robinhood_order_stock")).toBe(true);
    expect(guard.requiresApproval("tesla_unlock")).toBe(true);
    expect(guard.requiresApproval("gmail_list")).toBe(false);
  });

  it("should track remaining actions", () => {
    const guard = new Guardrails({
      maxActionsPerCycle: 5,
      requireApprovalFor: [],
      killSwitchFile: "test",
    });

    expect(guard.actionsRemaining).toBe(5);
    guard.checkAction("a");
    expect(guard.actionsRemaining).toBe(4);
  });
});
