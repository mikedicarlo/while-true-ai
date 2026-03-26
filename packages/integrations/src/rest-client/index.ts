import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

export class RestClientIntegration extends BaseIntegration {
  readonly name = "rest";
  readonly description = "Make HTTP requests to external APIs";

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "rest_get",
          description: "Make an HTTP GET request to a URL",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL to request",
              },
              headers: {
                type: "object",
                description: "Optional HTTP headers",
              },
            },
            required: ["url"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "rest_post",
          description: "Make an HTTP POST request",
          parameters: {
            type: "object",
            properties: {
              url: {
                type: "string",
                description: "The URL to request",
              },
              body: {
                type: "object",
                description: "JSON body to send",
              },
              headers: {
                type: "object",
                description: "Optional HTTP headers",
              },
            },
            required: ["url"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "rest_request",
          description:
            "Make an HTTP request with any method (GET, POST, PUT, DELETE, PATCH)",
          parameters: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                description: "HTTP method",
              },
              url: {
                type: "string",
                description: "The URL to request",
              },
              body: {
                type: "object",
                description: "Optional JSON body",
              },
              headers: {
                type: "object",
                description: "Optional HTTP headers",
              },
            },
            required: ["method", "url"],
          },
        },
      },
    ];
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<IntegrationResult> {
    try {
      let method = "GET";
      const url = params.url as string;
      const headers = (params.headers as Record<string, string>) ?? {};
      let body: string | undefined;

      if (action === "post") {
        method = "POST";
      } else if (action === "request") {
        method = (params.method as string) ?? "GET";
      }

      if (params.body && method !== "GET") {
        body = JSON.stringify(params.body);
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }

      const response = await fetch(url, {
        method,
        headers,
        body,
      });

      const contentType = response.headers.get("content-type") ?? "";
      let data: unknown;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Truncate long responses
        data = text.length > 5000 ? text.slice(0, 5000) + "...(truncated)" : text;
      }

      return {
        success: response.ok,
        data: {
          status: response.status,
          statusText: response.statusText,
          data,
        },
        error: response.ok
          ? undefined
          : `HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
