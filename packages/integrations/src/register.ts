import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { Application } from "@while-true-ai/core";
import { getConfigDir } from "@while-true-ai/core";
import { RestClientIntegration } from "./rest-client/index.js";
import { GmailIntegration } from "./gmail/index.js";
import { CalendarIntegration } from "./calendar/index.js";
import { TeslaIntegration } from "./tesla/index.js";
import { RobinhoodIntegration } from "./robinhood/index.js";
import { SchlageIntegration } from "./schlage/index.js";

const require = createRequire(import.meta.url);

/**
 * Load per-integration credentials from ~/.while-true-ai/credentials.yaml.
 */
function loadIntegrationCredentials(): Record<string, Record<string, string>> {
  try {
    const credPath = path.join(getConfigDir(), "credentials.yaml");
    if (!fs.existsSync(credPath)) return {};

    const yaml = require("js-yaml");
    const raw = yaml.load(fs.readFileSync(credPath, "utf-8")) as Record<string, unknown> | null;
    if (!raw?.integrations) return {};

    return raw.integrations as Record<string, Record<string, string>>;
  } catch {
    return {};
  }
}

/**
 * Register all enabled integrations from the app config.
 * Call this after creating the Application but before app.start().
 */
export function registerIntegrations(app: Application): void {
  const cfg = app.settings.integrations;
  const creds = loadIntegrationCredentials();

  // REST client is always on by default
  if (cfg.rest.enabled) {
    app.registerIntegration(new RestClientIntegration());
  }

  if (cfg.gmail.enabled) {
    app.registerIntegration(
      new GmailIntegration({
        credentialsPath: expandHome(cfg.gmail.credentialsPath),
        tokenPath: expandHome(cfg.gmail.tokenPath),
        maxResults: cfg.gmail.maxResults,
      }),
    );
  }

  if (cfg.calendar.enabled) {
    app.registerIntegration(
      new CalendarIntegration({
        credentialsPath: expandHome(cfg.calendar.credentialsPath),
        tokenPath: expandHome(cfg.calendar.tokenPath),
      }),
    );
  }

  if (cfg.tesla.enabled) {
    app.registerIntegration(
      new TeslaIntegration({
        accessToken: cfg.tesla.accessToken ?? creds.tesla?.accessToken,
        refreshToken: creds.tesla?.refreshToken,
        vehicleId: cfg.tesla.vehicleId ?? creds.tesla?.vehicleId,
      }),
    );
  }

  if (cfg.robinhood.enabled) {
    app.registerIntegration(
      new RobinhoodIntegration({
        accessToken: cfg.robinhood.accessToken ?? creds.robinhood?.accessToken,
      }),
    );
  }

  if (cfg.schlage.enabled) {
    app.registerIntegration(
      new SchlageIntegration({
        username: cfg.schlage.username ?? creds.schlage?.username,
        password: cfg.schlage.password ?? creds.schlage?.password,
        accessToken: cfg.schlage.accessToken ?? creds.schlage?.accessToken,
      }),
    );
  }
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return p.replace("~", process.env.HOME ?? "");
  }
  return p;
}

