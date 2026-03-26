import { createHmac } from "node:crypto";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";
import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

export interface SchlageConfig {
  username?: string;
  password?: string;
  accessToken?: string;
}

// Schlage / Allegion Yonomi cloud API constants (from pyschlage)
const BASE_URL = "https://api.allegion.yonomi.cloud/v1";
const API_KEY = "hnuu9jbbJr7MssFDWm5nU2Z7nG5Q5rxsaqWsE7e9";
const COGNITO_USER_POOL_ID = "us-west-2_2zhrVs9d4";
const COGNITO_CLIENT_ID = "t5836cptp2s1il0u9lki03j5";
const COGNITO_CLIENT_SECRET = "1kfmt18bgaig51in4j4v1j3jbe7ioqtjhle5o6knqc5dat0tpuvo";

// WiFi lock model prefixes that use PUT for lock state changes
const WIFI_MODELS = ["BE459", "BE489", "BE499", "FE789"];

function computeSecretHash(username: string): string {
  return createHmac("sha256", COGNITO_CLIENT_SECRET)
    .update(username + COGNITO_CLIENT_ID)
    .digest("base64");
}

/**
 * Patch a CognitoUser's internal client to inject SECRET_HASH into all
 * Cognito API calls (InitiateAuth, RespondToAuthChallenge, etc.).
 * Required because the Schlage user pool has a client secret configured.
 */
function patchCognitoClient(cognitoUser: CognitoUser, username: string): void {
  const client = (cognitoUser as unknown as { client: { request: (...args: unknown[]) => unknown } }).client;
  const origRequest = client.request.bind(client);
  const hash = computeSecretHash(username);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client.request = (...args: any[]) => {
    const [operation, params, callback] = args as [unknown, Record<string, Record<string, string>>, unknown];
    if (params?.AuthParameters) {
      params.AuthParameters.SECRET_HASH = hash;
    }
    if (params?.ChallengeResponses) {
      params.ChallengeResponses.SECRET_HASH = hash;
    }
    return origRequest(operation, params, callback);
  };
}

export class SchlageIntegration extends BaseIntegration {
  readonly name = "schlage";
  readonly description = "Control Schlage smart locks — lock, unlock, access codes, and status";
  readonly requiresApproval = true;

  private accessToken: string | null = null;
  private session: CognitoUserSession | null = null;
  private cognitoUser: CognitoUser | null = null;
  private userId: string | null = null;

  constructor(private config: SchlageConfig) {
    super();
  }

  async initialize(): Promise<void> {
    if (this.config.accessToken) {
      this.accessToken = this.config.accessToken;
      return;
    }

    const username = this.config.username ?? process.env.SCHLAGE_USERNAME;
    const password = this.config.password ?? process.env.SCHLAGE_PASSWORD;

    if (!username || !password) {
      throw new Error(
        "Schlage not configured. Enter your Schlage Home credentials in the web UI (Integrations tab) or set SCHLAGE_USERNAME and SCHLAGE_PASSWORD.",
      );
    }

    await this.authenticate(username, password);
  }

  private authenticate(username: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const pool = new CognitoUserPool({
        UserPoolId: COGNITO_USER_POOL_ID,
        ClientId: COGNITO_CLIENT_ID,
      });

      const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
      patchCognitoClient(cognitoUser, username);

      const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      cognitoUser.authenticateUser(authDetails, {
        onSuccess: (session) => {
          this.session = session;
          this.cognitoUser = cognitoUser;
          this.accessToken = session.getAccessToken().getJwtToken();
          resolve();
        },
        onFailure: (err) => {
          reject(new Error(`Schlage authentication failed: ${err.message ?? String(err)}`));
        },
        newPasswordRequired: () => {
          reject(new Error("Schlage account requires a password change. Please update in the Schlage Home app."));
        },
      });
    });
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    if (!this.session || !this.cognitoUser) return;

    const expiration = this.session.getAccessToken().getExpiration();
    const now = Math.floor(Date.now() / 1000);
    if (now < expiration - 60) return;

    const refreshToken = this.session.getRefreshToken();
    return new Promise((resolve, reject) => {
      this.cognitoUser!.refreshSession(refreshToken, (err: Error | null, session: CognitoUserSession) => {
        if (err) {
          reject(new Error(`Token refresh failed: ${err.message ?? String(err)}`));
          return;
        }
        this.session = session;
        this.accessToken = session.getAccessToken().getJwtToken();
        resolve();
      });
    });
  }

  async shutdown(): Promise<void> {
    this.session = null;
    this.cognitoUser = null;
    this.accessToken = null;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "schlage_devices",
          description: "List all Schlage smart lock devices with their current status",
          parameters: { type: "object", properties: {} },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_status",
          description: "Get detailed lock status including lock state, battery, jam detection, and connectivity",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
            },
            required: ["deviceId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_lock",
          description: "Lock a smart lock",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
            },
            required: ["deviceId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_unlock",
          description: "Unlock a smart lock",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
            },
            required: ["deviceId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_access_codes",
          description: "List all access codes (keypad codes) for a lock",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
            },
            required: ["deviceId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_add_code",
          description: "Add a new keypad access code to a lock",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
              name: { type: "string", description: "Friendly name for the access code" },
              code: { type: "string", description: "4-8 digit numeric code" },
            },
            required: ["deviceId", "name", "code"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_remove_code",
          description: "Remove an access code from a lock by name",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
              codeName: { type: "string", description: "Name of the access code to remove" },
            },
            required: ["deviceId", "codeName"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_history",
          description: "Get recent lock activity history (who locked/unlocked and when)",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
              limit: { type: "number", description: "Max entries to return (default 20)" },
            },
            required: ["deviceId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "schlage_battery",
          description: "Get battery level for a lock",
          parameters: {
            type: "object",
            properties: {
              deviceId: { type: "string", description: "Device ID or lock name" },
            },
            required: ["deviceId"],
          },
        },
      },
    ];
  }

  async execute(action: string, params: Record<string, unknown>): Promise<IntegrationResult> {
    try {
      await this.refreshTokenIfNeeded();
    } catch (err) {
      return { success: false, error: `Auth error: ${err instanceof Error ? err.message : String(err)}` };
    }

    switch (action) {
      case "devices":
        return this.listLocks();
      case "status":
        return this.getLockStatus(params.deviceId as string);
      case "lock":
        return this.setLockState(params.deviceId as string, 1);
      case "unlock":
        return this.setLockState(params.deviceId as string, 0);
      case "access_codes":
        return this.listAccessCodes(params.deviceId as string);
      case "add_code":
        return this.addAccessCode(
          params.deviceId as string,
          params.name as string,
          params.code as string,
        );
      case "remove_code":
        return this.removeAccessCode(
          params.deviceId as string,
          params.codeName as string,
        );
      case "history":
        return this.getHistory(params.deviceId as string, (params.limit as number) ?? 20);
      case "battery":
        return this.getBattery(params.deviceId as string);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  // ─── Lock resolution ─────────────────────────────────
  private async resolveLock(deviceIdOrName: string): Promise<{ deviceId: string; lock: SchlageDevice } | IntegrationResult> {
    const locks = await this.fetchLocks();
    if (!locks) return { success: false, error: "Failed to fetch locks" };

    // Try exact device ID match
    let lock = locks.find((l: SchlageDevice) => l.deviceId === deviceIdOrName);
    if (lock) return { deviceId: lock.deviceId, lock };

    // Try case-insensitive name match
    lock = locks.find((l: SchlageDevice) => l.name.toLowerCase() === deviceIdOrName.toLowerCase());
    if (lock) return { deviceId: lock.deviceId, lock };

    // Try partial name match
    lock = locks.find((l: SchlageDevice) => l.name.toLowerCase().includes(deviceIdOrName.toLowerCase()));
    if (lock) return { deviceId: lock.deviceId, lock };

    return { success: false, error: `Lock not found: "${deviceIdOrName}". Available locks: ${locks.map((l: SchlageDevice) => l.name).join(", ")}` };
  }

  // ─── API methods ─────────────────────────────────────
  private async listLocks(): Promise<IntegrationResult> {
    const locks = await this.fetchLocks();
    if (!locks) return { success: false, error: "Failed to fetch locks" };

    return {
      success: true,
      data: {
        locks: locks.map((l: SchlageDevice) => ({
          name: l.name,
          deviceId: l.deviceId,
          modelName: l.modelName,
          isLocked: l.attributes?.lockState === 1,
          isJammed: l.attributes?.lockState === 2,
          connected: l.connected,
          batteryLevel: l.attributes?.batteryLevel,
        })),
        count: locks.length,
      },
    };
  }

  private async getLockStatus(deviceIdOrName: string): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const res = await this.apiGet(`/devices/${resolved.deviceId}`);
    if (!res.success) return res;

    const device = res.data as SchlageDevice;
    return {
      success: true,
      data: {
        name: device.name,
        deviceId: device.deviceId,
        modelName: device.modelName,
        firmwareVersion: device.firmwareVersion,
        isLocked: device.attributes?.lockState === 1,
        isJammed: device.attributes?.lockState === 2,
        lockState: device.attributes?.lockState === 1 ? "locked" : device.attributes?.lockState === 2 ? "jammed" : "unlocked",
        connected: device.connected,
        batteryLevel: device.attributes?.batteryLevel,
        macAddress: device.macAddress,
      },
    };
  }

  private async setLockState(deviceIdOrName: string, state: number): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const { deviceId, lock } = resolved;
    const isWifi = WIFI_MODELS.some((m) => lock.modelName?.startsWith(m));

    if (isWifi) {
      const res = await this.apiPut(`/devices/${deviceId}`, {
        attributes: { lockState: state },
      });
      if (!res.success) return res;
    } else {
      if (!this.userId) {
        const userRes = await this.apiGet("/users/@me");
        if (userRes.success && userRes.data) {
          this.userId = (userRes.data as { userId: string }).userId;
        }
      }

      const res = await this.apiPost(`/devices/${deviceId}/commands`, {
        name: "changelockstate",
        data: { deviceId, state, userId: this.userId ?? "" },
      });
      if (!res.success) return res;
    }

    return {
      success: true,
      data: {
        name: lock.name,
        deviceId,
        action: state === 1 ? "locked" : "unlocked",
        message: `${lock.name} has been ${state === 1 ? "locked" : "unlocked"}.`,
      },
    };
  }

  private async getBattery(deviceIdOrName: string): Promise<IntegrationResult> {
    const status = await this.getLockStatus(deviceIdOrName);
    if (!status.success) return status;
    const data = status.data as Record<string, unknown>;
    return {
      success: true,
      data: {
        name: data.name,
        batteryLevel: data.batteryLevel,
        message: `${data.name} battery is at ${data.batteryLevel}%.`,
      },
    };
  }

  private async listAccessCodes(deviceIdOrName: string): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const res = await this.apiGet(`/devices/${resolved.deviceId}/storage/accesscode`);
    if (!res.success) return res;

    const codes = (res.data as SchlageAccessCode[]) ?? [];
    return {
      success: true,
      data: {
        lockName: resolved.lock.name,
        codes: codes.map((c) => ({
          name: c.friendlyName,
          accessCodeId: c.accessCodeId,
          disabled: c.disabled === 1,
          notify: c.notificationEnabled === 1,
        })),
        count: codes.length,
      },
    };
  }

  private async addAccessCode(deviceIdOrName: string, name: string, code: string): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const res = await this.apiPost(`/devices/${resolved.deviceId}/commands`, {
      name: "addaccesscode",
      data: {
        friendlyName: name,
        accessCode: parseInt(code, 10),
        accessCodeLength: code.length,
        notificationEnabled: 0,
        disabled: 0,
      },
    });

    if (!res.success) return res;
    return {
      success: true,
      data: { lockName: resolved.lock.name, codeName: name, message: `Access code "${name}" added to ${resolved.lock.name}.` },
    };
  }

  private async removeAccessCode(deviceIdOrName: string, codeName: string): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const codesRes = await this.apiGet(`/devices/${resolved.deviceId}/storage/accesscode`);
    if (!codesRes.success) return codesRes;

    const codes = (codesRes.data as SchlageAccessCode[]) ?? [];
    const code = codes.find((c) => c.friendlyName.toLowerCase() === codeName.toLowerCase());

    if (!code) {
      return { success: false, error: `Access code "${codeName}" not found. Available: ${codes.map((c) => c.friendlyName).join(", ")}` };
    }

    const res = await this.apiPost(`/devices/${resolved.deviceId}/commands`, {
      name: "deleteaccesscode",
      data: { accessCodeId: code.accessCodeId },
    });

    if (!res.success) return res;
    return {
      success: true,
      data: { lockName: resolved.lock.name, codeName, message: `Access code "${codeName}" removed from ${resolved.lock.name}.` },
    };
  }

  private async getHistory(deviceIdOrName: string, limit: number): Promise<IntegrationResult> {
    const resolved = await this.resolveLock(deviceIdOrName);
    if ("success" in resolved) return resolved;

    const res = await this.apiGet(`/devices/${resolved.deviceId}/logs?limit=${limit}&sort=desc`);
    if (!res.success) return res;

    return { success: true, data: { lockName: resolved.lock.name, entries: res.data } };
  }

  // ─── HTTP helpers ────────────────────────────────────
  private async fetchLocks(): Promise<SchlageDevice[] | null> {
    const res = await this.apiGet("/devices?archetype=lock");
    if (!res.success) return null;
    return res.data as SchlageDevice[];
  }

  private async apiGet(path: string): Promise<IntegrationResult> {
    try {
      const res = await fetch(`${BASE_URL}${path}`, { headers: this.headers() });
      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }
      const data = await res.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async apiPost(path: string, body: Record<string, unknown>): Promise<IntegrationResult> {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${respBody}` };
      }
      const contentLen = res.headers.get("content-length");
      const data = contentLen === "0" ? {} : await res.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async apiPut(path: string, body: Record<string, unknown>): Promise<IntegrationResult> {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "PUT",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const respBody = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${respBody}` };
      }
      const contentLen = res.headers.get("content-length");
      const data = contentLen === "0" ? {} : await res.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private headers(): Record<string, string> {
    return {
      "x-api-key": API_KEY,
      Authorization: `Bearer ${this.accessToken}`,
    };
  }
}

// ─── Types ──────────────────────────────────────────────
interface SchlageDevice {
  deviceId: string;
  name: string;
  modelName?: string;
  firmwareVersion?: string;
  macAddress?: string;
  connected?: boolean;
  attributes?: {
    lockState?: number;
    batteryLevel?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SchlageAccessCode {
  accessCodeId: string;
  friendlyName: string;
  accessCode?: number;
  accessCodeLength?: number;
  disabled?: number;
  notificationEnabled?: number;
  [key: string]: unknown;
}
