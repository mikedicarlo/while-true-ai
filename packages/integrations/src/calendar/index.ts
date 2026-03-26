import { google, type Auth } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

const OAUTH_CALLBACK_PORT = 8091;

export interface CalendarConfig {
  credentialsPath: string;
  tokenPath: string;
}

export class CalendarIntegration extends BaseIntegration {
  readonly name = "calendar";
  readonly description = "Manage Google Calendar events";

  private auth: Auth.OAuth2Client | null = null;

  constructor(private config: CalendarConfig) {
    super();
  }

  async initialize(): Promise<void> {
    if (!fs.existsSync(this.config.credentialsPath)) {
      throw new Error(`Calendar credentials not found at ${this.config.credentialsPath}. Upload your Google OAuth credentials JSON in the web UI (Integrations tab).`);
    }

    const credentials = JSON.parse(fs.readFileSync(this.config.credentialsPath, "utf-8"));
    const { client_id, client_secret } =
      credentials.installed ?? credentials.web ?? {};

    this.auth = new google.auth.OAuth2(client_id, client_secret, `http://localhost:${OAUTH_CALLBACK_PORT}`);

    if (fs.existsSync(this.config.tokenPath)) {
      const token = JSON.parse(fs.readFileSync(this.config.tokenPath, "utf-8"));
      this.auth.setCredentials(token);

      const creds = this.auth.credentials;
      if (creds.expiry_date && creds.expiry_date < Date.now() && creds.refresh_token) {
        try {
          const { credentials: refreshed } = await this.auth.refreshAccessToken();
          this.auth.setCredentials(refreshed);
          this.saveToken(refreshed);
        } catch {
          await this.authorizeWithBrowser();
        }
      }
    } else {
      await this.authorizeWithBrowser();
    }
  }

  private async authorizeWithBrowser(): Promise<void> {
    if (!this.auth) throw new Error("OAuth2 client not initialized");

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: CALENDAR_SCOPES,
      prompt: "consent",
    });

    console.log(`\n  Calendar authorization required.`);
    console.log(`  Opening browser for Google sign-in...\n`);
    console.log(`  If the browser doesn't open, visit:\n  ${authUrl}\n`);

    const { exec } = await import("node:child_process");
    const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    exec(`${openCmd} "${authUrl}"`);

    const code = await new Promise<string>((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "", `http://localhost:${OAUTH_CALLBACK_PORT}`);
        const c = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>");
          server.close();
          reject(new Error(`Google OAuth denied: ${error}`));
          return;
        }
        if (c) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h2>Calendar authorized!</h2><p>You can close this window.</p></body></html>");
          server.close();
          resolve(c);
          return;
        }
        res.writeHead(404);
        res.end();
      });

      server.listen(OAUTH_CALLBACK_PORT);
      setTimeout(() => { server.close(); reject(new Error("Calendar OAuth timed out.")); }, 120_000);
      server.on("error", (err) => reject(new Error(`OAuth callback server error: ${err.message}`)));
    });

    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    this.saveToken(tokens);
    console.log(`  Calendar authorized successfully!\n`);
  }

  private saveToken(token: Auth.Credentials): void {
    const dir = path.dirname(this.config.tokenPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.config.tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
  }

  async shutdown(): Promise<void> {
    this.auth = null;
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: "function",
        function: {
          name: "calendar_list",
          description: "List upcoming calendar events",
          parameters: {
            type: "object",
            properties: {
              maxResults: { type: "number", description: "Max events to return (default 10)" },
              timeMin: { type: "string", description: "Start time (ISO 8601). Defaults to now." },
              timeMax: { type: "string", description: "End time (ISO 8601)" },
              query: { type: "string", description: "Free text search query" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calendar_create",
          description: "Create a new calendar event",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Event title" },
              description: { type: "string", description: "Event description" },
              startTime: { type: "string", description: "Start time (ISO 8601)" },
              endTime: { type: "string", description: "End time (ISO 8601)" },
              location: { type: "string", description: "Event location" },
              attendees: {
                type: "array",
                items: { type: "string" },
                description: "List of attendee email addresses",
              },
            },
            required: ["summary", "startTime", "endTime"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calendar_update",
          description: "Update an existing calendar event",
          parameters: {
            type: "object",
            properties: {
              eventId: { type: "string", description: "Event ID to update" },
              summary: { type: "string", description: "New title" },
              description: { type: "string", description: "New description" },
              startTime: { type: "string", description: "New start time (ISO 8601)" },
              endTime: { type: "string", description: "New end time (ISO 8601)" },
              location: { type: "string", description: "New location" },
            },
            required: ["eventId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "calendar_delete",
          description: "Delete a calendar event",
          parameters: {
            type: "object",
            properties: {
              eventId: { type: "string", description: "Event ID to delete" },
            },
            required: ["eventId"],
          },
        },
      },
    ];
  }

  async execute(action: string, params: Record<string, unknown>): Promise<IntegrationResult> {
    if (!this.auth) {
      return { success: false, error: "Calendar not authenticated. Run setup first." };
    }

    const cal = google.calendar({ version: "v3", auth: this.auth });

    switch (action) {
      case "list":
        return this.listEvents(cal, params);
      case "create":
        return this.createEvent(cal, params);
      case "update":
        return this.updateEvent(cal, params);
      case "delete":
        return this.deleteEvent(cal, params);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async listEvents(cal: ReturnType<typeof google.calendar>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const res = await cal.events.list({
      calendarId: "primary",
      timeMin: (params.timeMin as string) ?? new Date().toISOString(),
      timeMax: params.timeMax as string | undefined,
      maxResults: (params.maxResults as number) ?? 10,
      singleEvents: true,
      orderBy: "startTime",
      q: params.query as string | undefined,
    });

    const events = (res.data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary,
      description: e.description,
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      location: e.location,
      status: e.status,
      attendees: e.attendees?.map((a) => ({ email: a.email, status: a.responseStatus })),
    }));

    return { success: true, data: { events } };
  }

  private async createEvent(cal: ReturnType<typeof google.calendar>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const event: Record<string, unknown> = {
      summary: params.summary,
      description: params.description,
      start: { dateTime: params.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: params.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    if (params.location) event.location = params.location;
    if (params.attendees) {
      event.attendees = (params.attendees as string[]).map((email) => ({ email }));
    }

    const res = await cal.events.insert({
      calendarId: "primary",
      requestBody: event as any,
    });

    return { success: true, data: { eventId: res.data.id, link: res.data.htmlLink } };
  }

  private async updateEvent(cal: ReturnType<typeof google.calendar>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const eventId = params.eventId as string;
    const updates: Record<string, unknown> = {};

    if (params.summary) updates.summary = params.summary;
    if (params.description) updates.description = params.description;
    if (params.location) updates.location = params.location;
    if (params.startTime) {
      updates.start = { dateTime: params.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    }
    if (params.endTime) {
      updates.end = { dateTime: params.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    }

    const res = await cal.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: updates as any,
    });

    return { success: true, data: { eventId: res.data.id } };
  }

  private async deleteEvent(cal: ReturnType<typeof google.calendar>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const eventId = params.eventId as string;
    await cal.events.delete({ calendarId: "primary", eventId });
    return { success: true, data: { deleted: eventId } };
  }
}
