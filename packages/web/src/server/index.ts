import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Application } from "@while-true-ai/core";
import { VERSION } from "@while-true-ai/core";
import { createApiRouter } from "./api.js";
import { createWebSocketServer } from "./ws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface WebServerOptions {
  host?: string;
  port?: number;
}

export async function startWebServer(
  app: Application,
  opts: WebServerOptions = {},
): Promise<void> {
  const host = opts.host ?? app.settings.api.host;
  const port = opts.port ?? app.settings.api.port;

  const expressApp = express();
  expressApp.use(express.json());

  // API routes
  expressApp.use(createApiRouter(app));

  // Serve static client assets (built by Vite in Phase 5)
  const clientDir = path.join(__dirname, "client");
  expressApp.use(express.static(clientDir));

  // SPA fallback — serve index.html for all non-API routes
  expressApp.get("/{*path}", (_req, res) => {
    const indexPath = path.join(clientDir, "index.html");
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send(`
          <!DOCTYPE html>
          <html>
          <head><title>while-true-ai</title></head>
          <body style="background:#1a1a2e;color:#e0e0e0;font-family:monospace;padding:40px;text-align:center">
            <h1 style="color:#00d4ff">while-true-ai</h1>
            <p>Web dashboard is running. Frontend will be available after Phase 5 build.</p>
            <p>API is active at <a href="/api/status" style="color:#00d4ff">/api/status</a></p>
            <p style="margin-top:20px">WebSocket terminal available at ws://${host}:${port}/ws</p>
          </body>
          </html>
        `);
      }
    });
  });

  const server = createServer(expressApp);

  // WebSocket server
  createWebSocketServer(server, app);

  // Start agent loop in background
  app.agentLoop.start().catch((err) => {
    console.error("Agent loop error:", err);
  });

  server.listen(port, host, () => {
    const url = `http://${host === "127.0.0.1" ? "localhost" : host}:${port}`;
    console.log("");
    console.log("  \x1b[1m\x1b[36m┌──────────────────────────────────────────────────────────┐\x1b[0m");
    console.log("  \x1b[1m\x1b[36m│\x1b[0m                                                          \x1b[1m\x1b[36m│\x1b[0m");
    console.log(`  \x1b[1m\x1b[36m│\x1b[0m   \x1b[32m✓\x1b[0m  \x1b[1mwhile-true-ai v${VERSION}\x1b[0m                              \x1b[1m\x1b[36m│\x1b[0m`);
    console.log("  \x1b[1m\x1b[36m│\x1b[0m                                                          \x1b[1m\x1b[36m│\x1b[0m");
    console.log(`  \x1b[1m\x1b[36m│\x1b[0m   \x1b[1m→  ${url}\x1b[0m${" ".repeat(Math.max(0, 42 - url.length))}\x1b[1m\x1b[36m│\x1b[0m`);
    console.log("  \x1b[1m\x1b[36m│\x1b[0m                                                          \x1b[1m\x1b[36m│\x1b[0m");
    console.log(`  \x1b[1m\x1b[36m│\x1b[0m   \x1b[2mAPI:       ${url}/api/status\x1b[0m${" ".repeat(Math.max(0, 31 - url.length))}\x1b[1m\x1b[36m│\x1b[0m`);
    console.log(`  \x1b[1m\x1b[36m│\x1b[0m   \x1b[2mWebSocket: ws://${host === "127.0.0.1" ? "localhost" : host}:${port}/ws\x1b[0m${" ".repeat(Math.max(0, 28 - url.length))}\x1b[1m\x1b[36m│\x1b[0m`);
    console.log("  \x1b[1m\x1b[36m│\x1b[0m                                                          \x1b[1m\x1b[36m│\x1b[0m");
    console.log("  \x1b[1m\x1b[36m│\x1b[0m   \x1b[2mPress Ctrl+C to stop.\x1b[0m                                  \x1b[1m\x1b[36m│\x1b[0m");
    console.log("  \x1b[1m\x1b[36m│\x1b[0m                                                          \x1b[1m\x1b[36m│\x1b[0m");
    console.log("  \x1b[1m\x1b[36m└──────────────────────────────────────────────────────────┘\x1b[0m");
    console.log("");
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    server.close();
    await app.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep process alive
  await new Promise(() => {}); // Never resolves
}

export { createApiRouter } from "./api.js";
export { createWebSocketServer } from "./ws.js";
