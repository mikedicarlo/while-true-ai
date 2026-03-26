import { Command } from "commander";
import React from "react";
import { render } from "ink";
import fs from "node:fs";
import path from "node:path";
import { App } from "./app.js";
import { VERSION } from "@while-true-ai/core";

const program = new Command();

program
  .name("while-true-ai")
  .description("An autonomous AI agent that runs on your local machine")
  .version(VERSION, "-v, --version")
  .allowExcessArguments(true)
  .allowUnknownOption(true)
  .option("--setup", "Run the setup wizard")
  .option("--config <path>", "Path to config file")
  .option("--headless", "Run without terminal UI (loop only)")
  .option("--web", "Start the web dashboard")
  .option("--host <host>", "Web server host (default: 127.0.0.1)")
  .option("--port <port>", "Web server port (default: 4200)")
  .action(async (options) => {
    const { getConfigDir } = await import("@while-true-ai/core");

    // Load credentials into env for all modes
    const configDir = getConfigDir();
    const credPath = path.join(configDir, "credentials.yaml");
    if (fs.existsSync(credPath)) {
      const yaml = await import("js-yaml");
      const creds = yaml.load(
        fs.readFileSync(credPath, "utf-8"),
      ) as Record<string, string> | null;
      if (creds) {
        for (const [key, value] of Object.entries(creds)) {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }

    // Check if first run (no config exists) — redirect to setup for non-interactive modes
    const configExists = fs.existsSync(path.join(configDir, "config.yaml"));

    if (options.web) {
      if (!configExists) {
        console.error(
          "\n  No configuration found. Run setup first:\n\n    while-true-ai --setup\n",
        );
        process.exit(1);
      }

      try {
        const { Application } = await import("@while-true-ai/core");
        const { startWebServer } = await import("@while-true-ai/web");
        const { registerIntegrations } = await import("@while-true-ai/integrations");
        const app = new Application(options.config);
        registerIntegrations(app);
        await app.start();
        await startWebServer(app, {
          host: options.host,
          port: options.port ? parseInt(options.port) : undefined,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  Failed to start web server: ${msg}\n`);
        if (msg.includes("EADDRINUSE")) {
          console.error(
            `  Port ${options.port ?? 8080} is already in use. Try a different port:\n    while-true-ai --web --port 3000\n`,
          );
        }
        process.exit(1);
      }
      return;
    }

    if (options.headless) {
      if (!configExists) {
        console.error(
          "\n  No configuration found. Run setup first:\n\n    while-true-ai --setup\n",
        );
        process.exit(1);
      }

      try {
        const { Application } = await import("@while-true-ai/core");
        const { registerIntegrations } = await import("@while-true-ai/integrations");
        const app = new Application(options.config);
        registerIntegrations(app);
        await app.start();

        console.log(`  while-true-ai v${VERSION} running in headless mode. Press Ctrl+C to stop.\n`);

        process.on("SIGINT", async () => {
          console.log("\n  Shutting down...");
          await app.shutdown();
          process.exit(0);
        });
        process.on("SIGTERM", async () => {
          await app.shutdown();
          process.exit(0);
        });

        await app.agentLoop.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n  Failed to start: ${msg}\n`);
        process.exit(1);
      }
      return;
    }

    // Interactive terminal mode (handles first-run setup automatically)
    const { waitUntilExit } = render(
      React.createElement(App, {
        runSetup: options.setup,
        configPath: options.config,
        headless: false,
      }),
    );

    await waitUntilExit();
  });

program.parse();
