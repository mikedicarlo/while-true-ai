import { google, type Auth } from "googleapis";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { BaseIntegration } from "@while-true-ai/core";
import type { IntegrationResult, ToolDefinition } from "@while-true-ai/core";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

const OAUTH_CALLBACK_PORT = 8090;

export interface GmailConfig {
  credentialsPath: string;
  tokenPath: string;
  maxResults?: number;
}

export class GmailIntegration extends BaseIntegration {
  readonly name = "gmail";
  readonly description = "Read, search, send, and manage Gmail messages";

  private auth: Auth.OAuth2Client | null = null;

  constructor(private config: GmailConfig) {
    super();
  }

  async initialize(): Promise<void> {
    if (!fs.existsSync(this.config.credentialsPath)) {
      throw new Error(
        `Gmail credentials not found at ${this.config.credentialsPath}. Upload your Google OAuth credentials JSON in the web UI (Integrations tab).`,
      );
    }

    const credentials = JSON.parse(
      fs.readFileSync(this.config.credentialsPath, "utf-8"),
    );
    const { client_id, client_secret } =
      credentials.installed ?? credentials.web ?? {};

    this.auth = new google.auth.OAuth2(
      client_id,
      client_secret,
      `http://localhost:${OAUTH_CALLBACK_PORT}`,
    );

    // Try to load existing token
    if (fs.existsSync(this.config.tokenPath)) {
      const token = JSON.parse(
        fs.readFileSync(this.config.tokenPath, "utf-8"),
      );
      this.auth.setCredentials(token);

      // Check if token needs refresh
      const creds = this.auth.credentials;
      if (creds.expiry_date && creds.expiry_date < Date.now() && creds.refresh_token) {
        try {
          const { credentials: refreshed } = await this.auth.refreshAccessToken();
          this.auth.setCredentials(refreshed);
          this.saveToken(refreshed);
        } catch {
          // Refresh failed — need re-auth
          await this.authorizeWithBrowser();
        }
      }
    } else {
      // No token — run the OAuth flow
      await this.authorizeWithBrowser();
    }
  }

  /**
   * Start a local HTTP server, open the browser for Google OAuth consent,
   * capture the callback code, exchange it for tokens, and save them.
   */
  private async authorizeWithBrowser(): Promise<void> {
    if (!this.auth) throw new Error("OAuth2 client not initialized");

    const authUrl = this.auth.generateAuthUrl({
      access_type: "offline",
      scope: GMAIL_SCOPES,
      prompt: "consent",
    });

    console.log(`\n  Gmail authorization required.`);
    console.log(`  Opening browser for Google sign-in...\n`);
    console.log(`  If the browser doesn't open, visit:\n  ${authUrl}\n`);

    // Open browser
    const { exec } = await import("node:child_process");
    const platform = process.platform;
    const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
    exec(`${openCmd} "${authUrl}"`);

    // Wait for the OAuth callback
    const code = await this.waitForCallback();

    // Exchange code for tokens
    const { tokens } = await this.auth.getToken(code);
    this.auth.setCredentials(tokens);
    this.saveToken(tokens);

    console.log(`  Gmail authorized successfully!\n`);
  }

  private waitForCallback(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? "", `http://localhost:${OAUTH_CALLBACK_PORT}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>");
          server.close();
          reject(new Error(`Google OAuth denied: ${error}`));
          return;
        }

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h2>Authorization successful!</h2><p>You can close this window and return to while-true-ai.</p></body></html>");
          server.close();
          resolve(code);
          return;
        }

        res.writeHead(404);
        res.end();
      });

      server.listen(OAUTH_CALLBACK_PORT, () => {
        // Timeout after 2 minutes
        setTimeout(() => {
          server.close();
          reject(new Error("Gmail OAuth timed out. Please try again."));
        }, 120_000);
      });

      server.on("error", (err) => {
        reject(new Error(`Failed to start OAuth callback server on port ${OAUTH_CALLBACK_PORT}: ${err.message}`));
      });
    });
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
          name: "gmail_list",
          description: "List recent Gmail messages",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Gmail search query (e.g. 'is:unread', 'from:user@example.com')" },
              maxResults: { type: "number", description: "Max messages to return (default 10)" },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_read",
          description: "Read a specific email by message ID",
          parameters: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The Gmail message ID" },
            },
            required: ["messageId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_send",
          description: "Send an email",
          parameters: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Email subject" },
              body: { type: "string", description: "Email body (plain text)" },
              cc: { type: "string", description: "CC recipients (comma-separated)" },
            },
            required: ["to", "subject", "body"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_search",
          description: "Search Gmail with a query",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Gmail search query" },
              maxResults: { type: "number", description: "Max results (default 10)" },
            },
            required: ["query"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_archive",
          description: "Archive an email (remove from inbox)",
          parameters: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The Gmail message ID" },
            },
            required: ["messageId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "gmail_mark_read",
          description: "Mark an email as read",
          parameters: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The Gmail message ID" },
            },
            required: ["messageId"],
          },
        },
      },
    ];
  }

  async execute(action: string, params: Record<string, unknown>): Promise<IntegrationResult> {
    if (!this.auth) {
      return { success: false, error: "Gmail not authenticated. Run setup first." };
    }

    const gmail = google.gmail({ version: "v1", auth: this.auth });

    switch (action) {
      case "list":
      case "search":
        return this.listMessages(gmail, params);
      case "read":
        return this.readMessage(gmail, params);
      case "send":
        return this.sendMessage(gmail, params);
      case "archive":
        return this.archiveMessage(gmail, params);
      case "mark_read":
        return this.markRead(gmail, params);
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async listMessages(gmail: ReturnType<typeof google.gmail>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: (params.query as string) ?? undefined,
      maxResults: (params.maxResults as number) ?? this.config.maxResults ?? 10,
    });

    const messages = res.data.messages ?? [];
    const summaries = await Promise.all(
      messages.slice(0, 15).map(async (m) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: m.id!,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const headers = msg.data.payload?.headers ?? [];
        return {
          id: m.id,
          from: headers.find((h) => h.name === "From")?.value,
          subject: headers.find((h) => h.name === "Subject")?.value,
          date: headers.find((h) => h.name === "Date")?.value,
          snippet: msg.data.snippet,
          isUnread: msg.data.labelIds?.includes("UNREAD"),
        };
      }),
    );

    return { success: true, data: { messages: summaries, total: res.data.resultSizeEstimate } };
  }

  private async readMessage(gmail: ReturnType<typeof google.gmail>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const messageId = params.messageId as string;
    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = res.data.payload?.headers ?? [];
    let body = "";

    // Extract plain text body
    const parts = res.data.payload?.parts ?? [];
    if (parts.length > 0) {
      const textPart = parts.find((p) => p.mimeType === "text/plain");
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
      }
    } else if (res.data.payload?.body?.data) {
      body = Buffer.from(res.data.payload.body.data, "base64").toString("utf-8");
    }

    // Truncate very long emails
    if (body.length > 5000) {
      body = body.slice(0, 5000) + "\n...(truncated)";
    }

    return {
      success: true,
      data: {
        id: messageId,
        from: headers.find((h) => h.name === "From")?.value,
        to: headers.find((h) => h.name === "To")?.value,
        subject: headers.find((h) => h.name === "Subject")?.value,
        date: headers.find((h) => h.name === "Date")?.value,
        body,
        labels: res.data.labelIds,
      },
    };
  }

  private async sendMessage(gmail: ReturnType<typeof google.gmail>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const to = params.to as string;
    const subject = params.subject as string;
    const body = params.body as string;
    const cc = params.cc as string | undefined;

    let raw = `To: ${to}\nSubject: ${subject}\nContent-Type: text/plain; charset=utf-8\n`;
    if (cc) raw += `Cc: ${cc}\n`;
    raw += `\n${body}`;

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encoded },
    });

    return { success: true, data: { messageId: res.data.id, threadId: res.data.threadId } };
  }

  private async archiveMessage(gmail: ReturnType<typeof google.gmail>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const messageId = params.messageId as string;
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["INBOX"] },
    });
    return { success: true, data: { archived: messageId } };
  }

  private async markRead(gmail: ReturnType<typeof google.gmail>, params: Record<string, unknown>): Promise<IntegrationResult> {
    const messageId = params.messageId as string;
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: { removeLabelIds: ["UNREAD"] },
    });
    return { success: true, data: { markedRead: messageId } };
  }
}
