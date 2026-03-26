import type { LLMRouter } from "../llm/router.js";
import type { TokenBudgetManager } from "../llm/budget.js";
import type { IntegrationManager } from "../integrations/manager.js";
import type { MemoryManager } from "../memory/manager.js";
import type { AgentMetrics } from "../observability/metrics.js";
import type { UserContext } from "../user/context.js";
import type { Message, ToolDefinition } from "../llm/models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("chat:interface");

const MAX_TOOL_ITERATIONS = 10;

/**
 * Per-integration guidance injected into the system prompt when the integration is active.
 * Helps the LLM understand when and how to use each integration's tools.
 */
const INTEGRATION_GUIDANCE: Record<string, string> = {
  gmail: `You have full access to the user's Gmail account. When the user asks about email, messages, or inbox — use gmail_search or gmail_list to find emails, gmail_read to read specific messages, and gmail_send to compose and send emails. When the user says "check my email" or "do I have new messages", always call gmail_list. When they ask you to reply or send a message, use gmail_send. Summarize email content concisely — include sender, subject, and key points. Never fabricate email content.`,

  calendar: `You have full access to the user's Google Calendar. When the user asks about their schedule, meetings, appointments, or availability — use calendar_list to retrieve events. When they want to create, move, or cancel events — use calendar_create, calendar_update, or calendar_delete. Always confirm date/time with the user before creating or modifying events. Show times in a human-friendly format. When listing events, include the title, time, and location if available.`,

  tesla: `You have live access to the user's Tesla vehicle. When the user asks about their car, vehicle status, battery, range, or location — use tesla_status. When they want to lock/unlock, start climate, open trunk/frunk, or control charging — use the corresponding tesla_ tool. Always confirm before executing actions that physically affect the vehicle (unlock, trunk, climate). Report battery percentage, estimated range, and charging state when asked about vehicle status.`,

  robinhood: `You have access to the user's Robinhood brokerage account. When the user asks about their portfolio, stock positions, account balance, or market prices — use the appropriate robinhood_ tool. When they want to buy or sell stocks, options, or crypto — use the trade tools. CRITICAL: Always confirm trade details (symbol, quantity, order type, price) with the user before executing any buy/sell order. Show portfolio values and gains/losses clearly. Never make trades without explicit user confirmation.`,

  schlage: `You have live access to the user's Schlage smart locks. When the user asks about their locks, doors, or home security — use schlage_devices to list all locks, then schlage_status to get the status of specific locks. When they want to lock or unlock a door — use schlage_lock or schlage_unlock. When they ask about access codes — use schlage_access_codes to list them, schlage_add_code to create new ones, and schlage_remove_code to delete them. Use schlage_history to show recent lock activity. Always confirm before unlocking a door. Report lock state (locked/unlocked), battery level, and last activity when showing status.`,

  rest: `You can make arbitrary HTTP requests to any API using the rest tools. Use rest_get for GET requests, rest_post for POST requests, and rest_request for other HTTP methods. When the user asks you to call an API, fetch data from a URL, or interact with a web service — use these tools. Include appropriate headers (like Content-Type, Authorization) as needed.`,
};

export interface ChatResponse {
  content: string;
  tokensUsed: number;
  toolCallsMade: number;
}

export class ChatInterface {
  private history: Message[] = [];
  private systemPrompt: string;

  constructor(
    private llmRouter: LLMRouter,
    private budget: TokenBudgetManager,
    private integrationManager: IntegrationManager,
    private memoryManager: MemoryManager,
    private opts: {
      userContext?: string;
      userContextStore?: UserContext;
      metrics?: AgentMetrics;
    } = {},
  ) {
    this.systemPrompt = this.buildSystemPrompt();
  }

  async sendMessage(userMessage: string): Promise<ChatResponse> {
    this.history.push({ role: "user", content: userMessage });

    const tools = this.integrationManager.getAllToolDefinitions();
    let totalTokens = 0;
    let toolCallsMade = 0;

    // Build messages with system prompt + recent memory context
    const memoryContext = this.memoryManager.getRecentContext(2000);
    const messages: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...(memoryContext
        ? [{ role: "system" as const, content: `Recent context:\n${memoryContext}` }]
        : []),
      ...this.history,
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      this.budget.checkBudget(10_000);

      const response = await this.llmRouter.complete("chat", {
        messages,
        tools: tools.length > 0 ? tools : undefined,
      });

      const costUsd = response.usage.totalTokens * 0.000003;
      totalTokens += response.usage.totalTokens;
      this.budget.recordUsage(response.usage.totalTokens, costUsd);
      this.opts.metrics?.recordTokens(response.usage.totalTokens, costUsd);

      // No tool calls — done
      if (response.finishReason !== "tool_calls" || response.toolCalls.length === 0) {
        const content = response.content ?? "";
        this.history.push({ role: "assistant", content });

        // Store in memory
        this.memoryManager.store(
          `User: ${userMessage}\nAssistant: ${content}`,
          "chat",
          { shortTerm: true },
        );

        // Learn user context from conversation
        this.opts.userContextStore?.learnFromConversation(userMessage, content);

        return { content, tokensUsed: totalTokens, toolCallsMade };
      }

      // Process tool calls
      messages.push({
        role: "assistant",
        content: response.content,
        toolCalls: response.toolCalls,
      });

      for (const toolCall of response.toolCalls) {
        toolCallsMade++;
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          args = {};
        }

        log.debug({ tool: toolCall.function.name }, "Executing chat tool call");
        const result = await this.integrationManager.executeToolCall(
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

    // Exceeded iterations
    const fallback = "I've reached the maximum number of tool calls for this message.";
    this.history.push({ role: "assistant", content: fallback });
    return { content: fallback, tokensUsed: totalTokens, toolCallsMade };
  }

  clearHistory(): void {
    this.history = [];
  }

  private buildSystemPrompt(): string {
    const integrations = this.integrationManager.registeredIntegrations;
    const tools = this.integrationManager.getAllToolDefinitions();
    const now = new Date().toLocaleString();

    let prompt = `You are while-true-ai, a helpful autonomous AI assistant running on the user's local machine.
Current date/time: ${now}

IMPORTANT: You have real, live tool access to the user's connected services. When the user asks about something that one of your tools can answer, you MUST call the appropriate tool to get real data — do NOT make up answers or say you cannot help. Always prefer using tools over giving generic responses.

If a tool call fails, report the actual error to the user rather than pretending the tool doesn't exist.`;

    if (integrations.length > 0) {
      prompt += `\n\nActive integrations: ${integrations.join(", ")}`;

      // Give the LLM a quick mapping of what each integration does
      const toolsByIntegration = new Map<string, string[]>();
      for (const tool of tools) {
        const prefix = tool.function.name.split("_")[0];
        if (!toolsByIntegration.has(prefix)) toolsByIntegration.set(prefix, []);
        toolsByIntegration.get(prefix)!.push(`${tool.function.name}: ${tool.function.description}`);
      }

      prompt += "\n\nAvailable tools by integration:";
      for (const [integration, toolList] of toolsByIntegration) {
        prompt += `\n\n${integration.toUpperCase()}:`;
        for (const t of toolList) {
          prompt += `\n  - ${t}`;
        }

        // Add integration-specific guidance
        const guidance = INTEGRATION_GUIDANCE[integration];
        if (guidance) {
          prompt += `\n  GUIDANCE: ${guidance}`;
        }
      }
    }

    if (this.opts.userContext) {
      prompt += `\n\nUser context:\n${this.opts.userContext}`;
    }

    return prompt;
  }
}
