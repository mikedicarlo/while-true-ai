import type { ToolDefinition } from "../llm/models.js";

export interface IntegrationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export abstract class BaseIntegration {
  abstract readonly name: string;
  abstract readonly description: string;
  readonly requiresApproval: boolean = false;

  abstract initialize(): Promise<void>;
  abstract shutdown(): Promise<void>;

  abstract execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<IntegrationResult>;

  abstract getToolDefinitions(): ToolDefinition[];

  async healthCheck(): Promise<boolean> {
    return true;
  }

  /** Optional: return signals/tasks discovered from this integration */
  async poll(): Promise<Record<string, unknown>[]> {
    return [];
  }
}
