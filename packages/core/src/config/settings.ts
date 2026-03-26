import { z } from "zod";

export const LoopSettingsSchema = z.object({
  minSleepSeconds: z.number().default(1.0),
  maxSleepSeconds: z.number().default(300.0),
  baseIdleSleep: z.number().default(10.0),
  idleGrowthFactor: z.number().default(1.5),
});

export const BudgetSettingsSchema = z.object({
  maxTokensPerCall: z.number().default(150_000),
  maxTokensPerMinute: z.number().default(2_000_000),
  maxTokensPerHour: z.number().default(50_000_000),
  maxTokensPerDay: z.number().default(200_000_000),
  maxCostPerDayUsd: z.number().default(100.0),
  maxCostPerMonthUsd: z.number().default(1000.0),
});

export const MemorySettingsSchema = z.object({
  shortTermMaxEntries: z.number().default(50),
  mediumTermTtlDays: z.number().default(7),
  longTermPersistDir: z.string().default("data/vectra"),
});

export const SafetySettingsSchema = z.object({
  maxActionsPerCycle: z.number().default(25),
  requireApprovalFor: z.array(z.string()).default([]),
  killSwitchFile: z.string().default("data/.kill_switch"),
});

export const LoggingSettingsSchema = z.object({
  consoleLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  fileLevel: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  filePath: z.string().default("data/logs/agent.log"),
});

export const LLMAdapterType = z.enum([
  "openai",
  "anthropic",
  "google",
  "ollama",
]);
export type LLMAdapterType = z.infer<typeof LLMAdapterType>;

export const LLMPurpose = z.enum([
  "thinking",
  "deciding",
  "acting",
  "reflecting",
  "summarizing",
  "chat",
]);
export type LLMPurpose = z.infer<typeof LLMPurpose>;

export const ProviderConfigSchema = z.object({
  modelId: z.string(),
  adapter: LLMAdapterType,
  purpose: LLMPurpose,
  baseUrl: z.string().optional(),
  apiKeyEnv: z.string().optional(),
  maxTokens: z.number().default(4096),
  temperature: z.number().default(0.7),
});
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;

export const IntegrationSettingsSchema = z.object({
  gmail: z.object({
    enabled: z.boolean().default(false),
    credentialsPath: z.string().default("~/.while-true-ai/gmail_credentials.json"),
    tokenPath: z.string().default("~/.while-true-ai/data/gmail_token.json"),
    maxResults: z.number().default(10),
  }).default({}),
  calendar: z.object({
    enabled: z.boolean().default(false),
    credentialsPath: z.string().default("~/.while-true-ai/gmail_credentials.json"),
    tokenPath: z.string().default("~/.while-true-ai/data/calendar_token.json"),
  }).default({}),
  tesla: z.object({
    enabled: z.boolean().default(false),
    accessToken: z.string().optional(),
    vehicleId: z.string().optional(),
  }).default({}),
  robinhood: z.object({
    enabled: z.boolean().default(false),
    accessToken: z.string().optional(),
  }).default({}),
  schlage: z.object({
    enabled: z.boolean().default(false),
    username: z.string().optional(),
    password: z.string().optional(),
    accessToken: z.string().optional(),
  }).default({}),
  rest: z.object({
    enabled: z.boolean().default(true),
  }).default({}),
});
export type IntegrationSettings = z.infer<typeof IntegrationSettingsSchema>;

export const ApiSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  host: z.string().default("127.0.0.1"),
  port: z.number().default(4200),
});

export const AppSettingsSchema = z.object({
  appName: z.string().default("while_true_ai"),
  environment: z.enum(["development", "production"]).default("development"),
  dataDir: z.string().default("~/.while-true-ai/data"),
  logging: LoggingSettingsSchema.default({}),
  loop: LoopSettingsSchema.default({}),
  budget: BudgetSettingsSchema.default({}),
  memory: MemorySettingsSchema.default({}),
  safety: SafetySettingsSchema.default({}),
  providers: z.array(ProviderConfigSchema).default([]),
  integrations: IntegrationSettingsSchema.default({}),
  api: ApiSettingsSchema.default({}),
});
export type AppSettings = z.infer<typeof AppSettingsSchema>;
