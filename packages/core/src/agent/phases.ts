import type { Task } from "../tasks/models.js";
import type { TaskManager } from "../tasks/manager.js";
import type { IntegrationManager } from "../integrations/manager.js";
import type { LLMRouter } from "../llm/router.js";
import type { TokenBudgetManager } from "../llm/budget.js";
import type { Guardrails } from "../safety/guardrails.js";
import type { EventBus } from "../observability/events.js";
import type { AgentMetrics } from "../observability/metrics.js";
import type { Message, ToolCall } from "../llm/models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("agent:phases");

// ─── Think Phase ──────────────────────────────────────────────

export interface ThinkContext {
  pendingTasks: Task[];
  hasWork: boolean;
  signals: Record<string, unknown>[];
}

export async function thinkPhase(deps: {
  taskManager: TaskManager;
  integrationManager: IntegrationManager;
}): Promise<ThinkContext> {
  const pendingTasks = deps.taskManager.getPending();
  const signals = await deps.integrationManager.pollAll();

  return {
    pendingTasks,
    hasWork: pendingTasks.length > 0 || signals.length > 0,
    signals,
  };
}

// ─── Decide Phase ─────────────────────────────────────────────

export interface ActionPlan {
  isIdle: boolean;
  task: Task | null;
  reasoning: string;
}

export async function decidePhase(
  context: ThinkContext,
  deps: {
    taskManager: TaskManager;
    llmRouter: LLMRouter;
  },
): Promise<ActionPlan> {
  if (!context.hasWork) {
    return { isIdle: true, task: null, reasoning: "No pending work" };
  }

  // Simple priority-based selection (LLM-based selection can be added later)
  const nextTask = deps.taskManager.getNextTask();

  if (!nextTask) {
    return { isIdle: true, task: null, reasoning: "No actionable tasks" };
  }

  return {
    isIdle: false,
    task: nextTask,
    reasoning: `Selected task "${nextTask.title}" (priority: ${nextTask.priority})`,
  };
}

// ─── Act Phase ────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  outcome: string;
  tokensUsed: number;
  costUsd: number;
  toolCallsMade: number;
}

const MAX_TOOL_ITERATIONS = 20;

export async function actPhase(
  plan: ActionPlan,
  deps: {
    taskManager: TaskManager;
    integrationManager: IntegrationManager;
    llmRouter: LLMRouter;
    budget: TokenBudgetManager;
    guardrails: Guardrails;
    metrics: AgentMetrics;
  },
): Promise<ActionResult> {
  if (plan.isIdle || !plan.task) {
    return {
      success: true,
      outcome: "Idle",
      tokensUsed: 0,
      costUsd: 0,
      toolCallsMade: 0,
    };
  }

  const task = plan.task;
  deps.taskManager.markInProgress(task.id);

  const tools = deps.integrationManager.getAllToolDefinitions();
  let totalTokens = 0;
  let totalCost = 0;
  let toolCallsMade = 0;

  const messages: Message[] = [
    {
      role: "system",
      content: `You are an autonomous AI agent executing a task. Use the available tools to complete the task. Be efficient and focused.`,
    },
    {
      role: "user",
      content: `Task: ${task.title}\n${task.description ? `Description: ${task.description}` : ""}`,
    },
  ];

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      deps.budget.checkBudget(10_000); // Estimate

      const response = await deps.llmRouter.complete("acting", {
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });

      totalTokens += response.usage.totalTokens;
      // Rough cost estimate — can be refined per model
      totalCost += response.usage.totalTokens * 0.000003;
      deps.budget.recordUsage(response.usage.totalTokens, totalCost);
      deps.metrics.recordTokens(response.usage.totalTokens, totalCost);

      // If no tool calls, we're done
      if (
        response.finishReason !== "tool_calls" ||
        response.toolCalls.length === 0
      ) {
        const outcome = response.content ?? "Task completed (no output)";
        deps.taskManager.markCompleted(task.id, outcome);
        deps.metrics.recordTaskCompleted();
        return {
          success: true,
          outcome,
          tokensUsed: totalTokens,
          costUsd: totalCost,
          toolCallsMade,
        };
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        deps.guardrails.checkAction(toolCall.function.name);
        toolCallsMade++;

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        const result = await deps.integrationManager.executeToolCall(
          toolCall.function.name,
          args,
        );

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: toolCall.id,
        });
      }
    }

    // Exceeded max iterations
    const outcome = "Reached maximum tool call iterations";
    deps.taskManager.markCompleted(task.id, outcome);
    log.warn({ taskId: task.id }, outcome);

    return {
      success: true,
      outcome,
      tokensUsed: totalTokens,
      costUsd: totalCost,
      toolCallsMade,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    deps.taskManager.markFailed(task.id, errorMsg);
    deps.metrics.recordTaskFailed();
    log.error({ taskId: task.id, error: errorMsg }, "Act phase failed");

    return {
      success: false,
      outcome: errorMsg,
      tokensUsed: totalTokens,
      costUsd: totalCost,
      toolCallsMade,
    };
  }
}

// ─── Reflect Phase ────────────────────────────────────────────

export async function reflectPhase(
  result: ActionResult,
  _deps: {
    eventBus: EventBus;
  },
): Promise<void> {
  // Future: store result in memory, update user context, etc.
  log.debug(
    {
      success: result.success,
      tokens: result.tokensUsed,
      tools: result.toolCallsMade,
    },
    "Cycle reflection complete",
  );
}
