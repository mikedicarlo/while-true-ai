import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import yaml from "js-yaml";
import { AppSettingsSchema, type AppSettings } from "./settings.js";

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".while-true-ai");

function expandHome(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

export function ensureDataDir(dataDir: string): void {
  const expanded = expandHome(dataDir);
  const logsDir = path.join(expanded, "logs");
  fs.mkdirSync(logsDir, { recursive: true });
}

export function loadConfig(configPath?: string): AppSettings {
  let rawConfig: Record<string, unknown> = {};

  // Try loading from explicit path
  if (configPath && fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, "utf-8");
    rawConfig = (yaml.load(content) as Record<string, unknown>) ?? {};
  }

  // Try loading from default location
  const defaultPath = path.join(DEFAULT_CONFIG_DIR, "config.yaml");
  if (!configPath && fs.existsSync(defaultPath)) {
    const content = fs.readFileSync(defaultPath, "utf-8");
    const defaultConfig =
      (yaml.load(content) as Record<string, unknown>) ?? {};
    rawConfig = deepMerge(defaultConfig, rawConfig);
  }

  const settings = AppSettingsSchema.parse(rawConfig);
  settings.dataDir = expandHome(settings.dataDir);
  return settings;
}

export function getConfigDir(): string {
  return DEFAULT_CONFIG_DIR;
}
