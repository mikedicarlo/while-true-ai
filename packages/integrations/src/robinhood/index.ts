import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

export interface RobinhoodConfig {
  accessToken?: string;
  baseUrl?: string;
}

export class RobinhoodIntegration extends BaseIntegration {
  readonly name = "robinhood";
  readonly description = "Trade stocks, crypto, and options on Robinhood";
  readonly requiresApproval = true;

  private accessToken: string | null = null;
  private baseUrl: string;

  constructor(private config: RobinhoodConfig) {
    super();
    this.baseUrl = config.baseUrl ?? "https://api.robinhood.com";
  }

  async initialize(): Promise<void> {
    this.accessToken = this.config.accessToken ?? process.env.ROBINHOOD_ACCESS_TOKEN ?? null;
    if (!this.accessToken) {
      throw new Error("Robinhood access token not configured. Set ROBINHOOD_ACCESS_TOKEN.");
    }
  }

  async shutdown(): Promise<void> {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "robinhood_portfolio",
          description: "Get current portfolio summary (holdings, total value, daily change)",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_positions",
          description: "List all current stock positions",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_quote",
          description: "Get a stock quote",
          parameters: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Stock ticker symbol (e.g. AAPL)" },
            },
            required: ["symbol"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_buy",
          description: "Place a buy order for a stock (requires approval)",
          parameters: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Stock ticker symbol" },
              quantity: { type: "number", description: "Number of shares" },
              type: { type: "string", enum: ["market", "limit"], description: "Order type (default: market)" },
              limitPrice: { type: "number", description: "Limit price (required for limit orders)" },
            },
            required: ["symbol", "quantity"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_sell",
          description: "Place a sell order for a stock (requires approval)",
          parameters: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Stock ticker symbol" },
              quantity: { type: "number", description: "Number of shares" },
              type: { type: "string", enum: ["market", "limit"], description: "Order type (default: market)" },
              limitPrice: { type: "number", description: "Limit price (required for limit orders)" },
            },
            required: ["symbol", "quantity"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_orders",
          description: "List recent orders",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["all", "open", "filled", "cancelled"], description: "Filter by status" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_cancel_order",
          description: "Cancel an open order",
          parameters: {
            type: "object",
            properties: {
              orderId: { type: "string", description: "Order ID to cancel" },
            },
            required: ["orderId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_crypto_positions",
          description: "List crypto holdings",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "robinhood_crypto_quote",
          description: "Get a cryptocurrency quote",
          parameters: {
            type: "object",
            properties: {
              symbol: { type: "string", description: "Crypto symbol (e.g. BTC, ETH)" },
            },
            required: ["symbol"],
          },
        },
      },
    ];
  }

  async execute(action: string, params: Record<string, unknown>): Promise<IntegrationResult> {
    switch (action) {
      case "portfolio":
        return this.apiGet("/portfolios/");
      case "positions":
        return this.apiGet("/positions/?nonzero=true");
      case "quote":
        return this.apiGet(`/quotes/${(params.symbol as string).toUpperCase()}/`);
      case "buy":
        return this.placeOrder("buy", params);
      case "sell":
        return this.placeOrder("sell", params);
      case "orders":
        return this.apiGet("/orders/");
      case "cancel_order":
        return this.apiPost(`/orders/${params.orderId}/cancel/`);
      case "crypto_positions":
        return this.apiGet("/holdings/");
      case "crypto_quote":
        return this.apiGet(`/marketdata/forex/quotes/${(params.symbol as string).toUpperCase()}/`);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async placeOrder(side: "buy" | "sell", params: Record<string, unknown>): Promise<IntegrationResult> {
    const symbol = (params.symbol as string).toUpperCase();

    // Get instrument URL from quote
    const quoteRes = await this.apiGet(`/quotes/${symbol}/`);
    if (!quoteRes.success) return quoteRes;
    const instrumentUrl = (quoteRes.data as Record<string, unknown>)?.instrument;

    const orderType = (params.type as string) ?? "market";
    const order: Record<string, unknown> = {
      account: await this.getAccountUrl(),
      instrument: instrumentUrl,
      symbol,
      quantity: params.quantity,
      side,
      type: orderType,
      time_in_force: "gfd", // good for day
      trigger: "immediate",
    };

    if (orderType === "limit" && params.limitPrice) {
      order.price = params.limitPrice;
    }

    return this.apiPost("/orders/", order);
  }

  private async getAccountUrl(): Promise<string> {
    const res = await this.apiGet("/accounts/");
    const data = res.data as Record<string, unknown>;
    const results = data?.results as Record<string, unknown>[];
    return results?.[0]?.url as string ?? "";
  }

  private async apiGet(path: string): Promise<IntegrationResult> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      const data = await res.json();
      return { success: res.ok, data, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async apiPost(path: string, body?: Record<string, unknown>): Promise<IntegrationResult> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      return { success: res.ok, data, error: res.ok ? undefined : `HTTP ${res.status}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
