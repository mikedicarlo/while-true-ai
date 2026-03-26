import OpenAI from "openai";
import type {
  LLMRequestOptions,
  LLMResponse,
  ToolCall,
  Message,
} from "../models.js";
import { getLogger } from "../../observability/logger.js";

const log = getLogger("llm:openai");

export class OpenAIAdapter {
  private client: OpenAI;
  private modelId: string;

  constructor(opts: {
    modelId: string;
    apiKey?: string;
    baseUrl?: string;
  }) {
    this.modelId = opts.modelId;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl,
    });
  }

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    const messages = options.messages.map((m) => this.toOpenAIMessage(m));

    const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming =
      {
        model: this.modelId,
        messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature,
      };

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools.map((t) => ({
        type: "function" as const,
        function: {
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        },
      }));
    }

    log.debug({ model: this.modelId }, "Sending completion request");

    const response = await this.client.chat.completions.create(params);
    const choice = response.choices[0];

    if (!choice) {
      throw new Error("No completion choice returned");
    }

    const toolCalls: ToolCall[] = (choice.message.tool_calls ?? []).map(
      (tc) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }),
    );

    const finishReason =
      choice.finish_reason === "tool_calls"
        ? "tool_calls"
        : choice.finish_reason === "length"
          ? "length"
          : "stop";

    return {
      content: choice.message.content,
      toolCalls,
      finishReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      modelId: this.modelId,
    };
  }

  private toOpenAIMessage(
    m: Message,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam {
    if (m.role === "tool") {
      return {
        role: "tool",
        content: m.content ?? "",
        tool_call_id: m.toolCallId ?? "",
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }
    return {
      role: m.role as "system" | "user" | "assistant",
      content: m.content ?? "",
    };
  }
}
