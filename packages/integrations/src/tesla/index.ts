import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

export interface TeslaConfig {
  accessToken?: string;
  refreshToken?: string;
  vehicleId?: string;
  baseUrl?: string;
}

export class TeslaIntegration extends BaseIntegration {
  readonly name = "tesla";
  readonly description = "Control Tesla vehicles — lock, unlock, climate, charge, and more";
  readonly requiresApproval = true;

  private accessToken: string | null = null;
  private vehicleId: string | null = null;
  private baseUrl: string;

  constructor(private config: TeslaConfig) {
    super();
    this.baseUrl = config.baseUrl ?? "https://fleet-api.prd.na.vn.cloud.tesla.com";
  }

  async initialize(): Promise<void> {
    this.accessToken = this.config.accessToken ?? process.env.TESLA_ACCESS_TOKEN ?? null;
    this.vehicleId = this.config.vehicleId ?? process.env.TESLA_VEHICLE_ID ?? null;

    if (!this.accessToken) {
      throw new Error("Tesla access token not configured. Set TESLA_ACCESS_TOKEN or run setup.");
    }
  }

  async shutdown(): Promise<void> {}

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "tesla_vehicles",
          description: "List all Tesla vehicles on the account",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_status",
          description: "Get vehicle status (location, battery, climate, locks)",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string", description: "Vehicle ID (uses default if omitted)" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_lock",
          description: "Lock the vehicle doors",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_unlock",
          description: "Unlock the vehicle doors",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_climate_on",
          description: "Turn on climate control (heating/cooling)",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
              temperature: { type: "number", description: "Temperature in Fahrenheit" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_climate_off",
          description: "Turn off climate control",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_charge_start",
          description: "Start charging the vehicle",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_charge_stop",
          description: "Stop charging the vehicle",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_honk",
          description: "Honk the horn",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_flash",
          description: "Flash the headlights",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "tesla_trunk",
          description: "Open or close the trunk",
          parameters: {
            type: "object",
            properties: {
              vehicleId: { type: "string" },
              which: { type: "string", enum: ["rear", "front"], description: "Which trunk (default: rear)" },
            },
          },
        },
      },
    ];
  }

  async execute(action: string, params: Record<string, unknown>): Promise<IntegrationResult> {
    const vid = (params.vehicleId as string) ?? this.vehicleId;
    if (!vid && action !== "vehicles") {
      return { success: false, error: "No vehicle ID specified. Use tesla_vehicles to list vehicles first." };
    }

    switch (action) {
      case "vehicles":
        return this.apiGet("/api/1/vehicles");
      case "status":
        return this.apiGet(`/api/1/vehicles/${vid}/vehicle_data`);
      case "lock":
        return this.apiPost(`/api/1/vehicles/${vid}/command/door_lock`);
      case "unlock":
        return this.apiPost(`/api/1/vehicles/${vid}/command/door_unlock`);
      case "climate_on": {
        if (params.temperature) {
          const tempC = ((params.temperature as number) - 32) * 5 / 9;
          await this.apiPost(`/api/1/vehicles/${vid}/command/set_temps`, {
            driver_temp: tempC,
            passenger_temp: tempC,
          });
        }
        return this.apiPost(`/api/1/vehicles/${vid}/command/auto_conditioning_start`);
      }
      case "climate_off":
        return this.apiPost(`/api/1/vehicles/${vid}/command/auto_conditioning_stop`);
      case "charge_start":
        return this.apiPost(`/api/1/vehicles/${vid}/command/charge_start`);
      case "charge_stop":
        return this.apiPost(`/api/1/vehicles/${vid}/command/charge_stop`);
      case "honk":
        return this.apiPost(`/api/1/vehicles/${vid}/command/honk_horn`);
      case "flash":
        return this.apiPost(`/api/1/vehicles/${vid}/command/flash_lights`);
      case "trunk": {
        const which = (params.which as string) ?? "rear";
        return this.apiPost(`/api/1/vehicles/${vid}/command/actuate_trunk`, {
          which_trunk: which,
        });
      }
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
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
