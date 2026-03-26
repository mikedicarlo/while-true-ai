import { describe, it, expect, vi } from "vitest";
import { BaseIntegration } from "../src/integrations/base.js";
import { IntegrationManager } from "../src/integrations/manager.js";
import type { IntegrationResult } from "../src/integrations/base.js";
import type { ToolDefinition } from "../src/llm/models.js";

class MockIntegration extends BaseIntegration {
  readonly name = "mock";
  readonly description = "Mock integration for testing";

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "mock_greet",
          description: "Say hello",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "mock_farewell",
          description: "Say goodbye",
          parameters: {},
        },
      },
    ];
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<IntegrationResult> {
    if (action === "greet") {
      return { success: true, data: `Hello ${params.name}!` };
    }
    if (action === "farewell") {
      return { success: true, data: "Goodbye!" };
    }
    return { success: false, error: `Unknown action: ${action}` };
  }
}

describe("IntegrationManager", () => {
  it("should register an integration and its tools", () => {
    const manager = new IntegrationManager();
    manager.register(new MockIntegration());

    expect(manager.registeredIntegrations).toContain("mock");
    expect(manager.getAllToolDefinitions()).toHaveLength(2);
  });

  it("should route tool calls to the correct integration", async () => {
    const manager = new IntegrationManager();
    manager.register(new MockIntegration());

    const result = await manager.executeToolCall("mock_greet", {
      name: "World",
    });
    expect(result.success).toBe(true);
    expect(result.data).toBe("Hello World!");
  });

  it("should return error for unknown tools", async () => {
    const manager = new IntegrationManager();
    const result = await manager.executeToolCall("unknown_tool", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });

  it("should handle tool execution errors gracefully", async () => {
    const manager = new IntegrationManager();
    const errorIntegration = new MockIntegration();
    vi.spyOn(errorIntegration, "execute").mockRejectedValue(
      new Error("API error"),
    );
    manager.register(errorIntegration);

    const result = await manager.executeToolCall("mock_greet", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("API error");
  });

  it("should initialize all integrations", async () => {
    const manager = new IntegrationManager();
    const integration = new MockIntegration();
    const initSpy = vi.spyOn(integration, "initialize");
    manager.register(integration);

    await manager.initializeAll();
    expect(initSpy).toHaveBeenCalledOnce();
  });
});
