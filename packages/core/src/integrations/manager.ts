import type { BaseIntegration, IntegrationResult } from "./base.js";
import type { ToolDefinition } from "../llm/models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("integrations:manager");

interface ToolRoute {
  integration: string;
  action: string;
}

export class IntegrationManager {
  private integrations = new Map<string, BaseIntegration>();
  private toolRoutes = new Map<string, ToolRoute>();

  register(integration: BaseIntegration): void {
    this.integrations.set(integration.name, integration);

    // Map tool names to their integration + action
    for (const tool of integration.getToolDefinitions()) {
      const toolName = tool.function.name;
      // Convention: tool name is "integration_action" (e.g., "gmail_list")
      const action = toolName.replace(`${integration.name}_`, "");
      this.toolRoutes.set(toolName, {
        integration: integration.name,
        action,
      });
    }

    log.info(
      {
        name: integration.name,
        tools: integration.getToolDefinitions().length,
      },
      "Integration registered",
    );
  }

  async initializeAll(): Promise<void> {
    for (const [name, integration] of this.integrations) {
      try {
        await integration.initialize();
        log.info({ name }, "Integration initialized");
      } catch (error) {
        log.error({ name, error }, "Failed to initialize integration");
      }
    }
  }

  async shutdownAll(): Promise<void> {
    for (const [name, integration] of this.integrations) {
      try {
        await integration.shutdown();
      } catch (error) {
        log.error({ name, error }, "Failed to shutdown integration");
      }
    }
  }

  getAllToolDefinitions(): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    for (const integration of this.integrations.values()) {
      tools.push(...integration.getToolDefinitions());
    }
    return tools;
  }

  async executeToolCall(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<IntegrationResult> {
    const route = this.toolRoutes.get(toolName);
    if (!route) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    const integration = this.integrations.get(route.integration);
    if (!integration) {
      return {
        success: false,
        error: `Integration not found: ${route.integration}`,
      };
    }

    try {
      log.debug(
        { tool: toolName, integration: route.integration, action: route.action },
        "Executing tool call",
      );
      return await integration.execute(route.action, args);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log.error({ tool: toolName, error: errorMsg }, "Tool execution failed");
      return { success: false, error: errorMsg };
    }
  }

  getIntegration(name: string): BaseIntegration | undefined {
    return this.integrations.get(name);
  }

  get registeredIntegrations(): string[] {
    return [...this.integrations.keys()];
  }

  requiresApproval(toolName: string): boolean {
    const route = this.toolRoutes.get(toolName);
    if (!route) return false;
    const integration = this.integrations.get(route.integration);
    return integration?.requiresApproval ?? false;
  }

  async pollAll(): Promise<Record<string, unknown>[]> {
    const signals: Record<string, unknown>[] = [];
    for (const integration of this.integrations.values()) {
      try {
        const results = await integration.poll();
        signals.push(...results);
      } catch {
        // Polling failures are non-critical
      }
    }
    return signals;
  }
}
