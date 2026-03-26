import type { SafetySettingsSchema } from "../config/settings.js";
import { z } from "zod";
import { getLogger } from "../observability/logger.js";

const log = getLogger("safety:guardrails");

type SafetySettings = z.infer<typeof SafetySettingsSchema>;

export class ActionDeniedError extends Error {
  constructor(
    public reason: string,
    public actionType: string,
  ) {
    super(`Action denied: ${reason} (${actionType})`);
    this.name = "ActionDeniedError";
  }
}

export class Guardrails {
  private actionsThisCycle = 0;

  constructor(private settings: SafetySettings) {}

  checkAction(toolName: string): void {
    // Check action limit per cycle
    if (this.actionsThisCycle >= this.settings.maxActionsPerCycle) {
      throw new ActionDeniedError(
        `Exceeded max actions per cycle (${this.settings.maxActionsPerCycle})`,
        toolName,
      );
    }

    // Check if tool requires approval
    if (this.requiresApproval(toolName)) {
      log.warn({ tool: toolName }, "Tool requires approval");
      // In the future, this would trigger an approval flow
      // For now, we log it
    }

    this.actionsThisCycle++;
  }

  requiresApproval(toolName: string): boolean {
    return this.settings.requireApprovalFor.some(
      (pattern) =>
        toolName === pattern ||
        toolName.startsWith(`${pattern}_`),
    );
  }

  resetCycle(): void {
    this.actionsThisCycle = 0;
  }

  get actionsRemaining(): number {
    return Math.max(
      0,
      this.settings.maxActionsPerCycle - this.actionsThisCycle,
    );
  }
}
