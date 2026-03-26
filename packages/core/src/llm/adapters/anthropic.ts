import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMRequestOptions,
  LLMResponse,
  ToolCall,
  Message,
} from "../models.js";
import { getLogger } from "../../observability/logger.js";

const log = getLogger("llm:anthropic");

export class AnthropicAdapter {
  private client: Anthropic;
  private modelId: string;

  constructor(opts: { modelId: string; apiKey?: string }) {
    this.modelId = opts.modelId;
    this.client = new Anthropic({
      apiKey: opts.apiKey,
    });
  }

  async complete(options: LLMRequestOptions): Promise<LLMResponse> {
    // Extract system message
    const systemMsg = options.messages.find((m) => m.role === "system");
    const nonSystemMessages = options.messages.filter(
      (m) => m.role !== "system",
    );

    const messages = nonSystemMessages.map((m) => this.toAnthropicMessage(m));

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: this.modelId,
      max_tokens: options.maxTokens ?? 4096,
      messages,
    };

    if (systemMsg?.content) {
      params.system = systemMsg.content;
    }

    if (options.tools && options.tools.length > 0) {
      params.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
      }));
    }

    if (options.temperature !== undefined) {
      params.temperature = options.temperature;
    }

    log.debug({ model: this.modelId }, "Sending completion request");

    const response = await this.client.messages.create(params);

    // Extract text and tool use from content blocks
    let textContent = "";
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    const finishReason =
      response.stop_reason === "tool_use"
        ? "tool_calls"
        : response.stop_reason === "max_tokens"
          ? "length"
          : "stop";

    return {
      content: textContent || null,
      toolCalls,
      finishReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
      },
      modelId: this.modelId,
    };
  }

  private toAnthropicMessage(
    m: Message,
  ): Anthropic.MessageParam {
    if (m.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: m.toolCallId ?? "",
            content: m.content ?? "",
          },
        ],
      };
    }
    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.toolCalls) {
        content.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
      return { role: "assistant", content };
    }
    return {
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    };
  }
}
