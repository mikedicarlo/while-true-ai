// Version
export { VERSION } from "./version.js";

// Config
export { AppSettingsSchema, type AppSettings } from "./config/settings.js";
export type {
  ProviderConfig,
  LLMAdapterType,
  LLMPurpose,
  IntegrationSettings,
} from "./config/settings.js";
export { loadConfig, ensureDataDir, getConfigDir } from "./config/loader.js";

// Database
export { createDatabase, initializeSchema } from "./db/client.js";
export type { DrizzleDB } from "./db/client.js";
export * as dbSchema from "./db/schema.js";

// Observability
export { initLogger, getLogger } from "./observability/logger.js";
export { EventBus } from "./observability/events.js";
export type { AgentEvent, EventPayload } from "./observability/events.js";
export { AgentMetrics } from "./observability/metrics.js";
export { AuditTrail } from "./observability/audit.js";

// LLM
export type {
  Message,
  ToolCall,
  ToolDefinition,
  LLMResponse,
  LLMRequestOptions,
} from "./llm/models.js";
export { OpenAIAdapter } from "./llm/adapters/openai.js";
export { AnthropicAdapter } from "./llm/adapters/anthropic.js";
export { LLMRouter } from "./llm/router.js";
export { TokenBudgetManager, BudgetExhaustedError } from "./llm/budget.js";

// Tasks
export { TaskPriority } from "./tasks/models.js";
export type {
  Task,
  CreateTaskInput,
  TaskStatus,
  TaskSource,
} from "./tasks/models.js";
export { TaskStore } from "./tasks/store.js";
export { TaskManager } from "./tasks/manager.js";

// Integrations
export { BaseIntegration } from "./integrations/base.js";
export type { IntegrationResult } from "./integrations/base.js";
export { IntegrationManager } from "./integrations/manager.js";

// Safety
export { Guardrails, ActionDeniedError } from "./safety/guardrails.js";
export { KillSwitch } from "./safety/kill-switch.js";

// Agent
export type { AgentPhase, AgentState } from "./agent/state.js";
export { createInitialState } from "./agent/state.js";
export {
  thinkPhase,
  decidePhase,
  actPhase,
  reflectPhase,
} from "./agent/phases.js";
export type { ThinkContext, ActionPlan, ActionResult } from "./agent/phases.js";
export { AgentLoop } from "./agent/loop.js";
export type { AgentLoopDeps } from "./agent/loop.js";

// Memory
export type { MemoryEntry, MemoryTier, MemoryEntryType } from "./memory/models.js";
export { ShortTermMemory } from "./memory/short-term.js";
export { MediumTermMemory } from "./memory/medium-term.js";
export { MemoryManager } from "./memory/manager.js";

// Chat
export { ChatInterface } from "./chat/interface.js";
export type { ChatResponse } from "./chat/interface.js";

// Scheduler
export { Scheduler } from "./scheduler/scheduler.js";
export type { ScheduleEntry } from "./scheduler/scheduler.js";
export { parseSchedule } from "./scheduler/parser.js";
export type { ParsedSchedule } from "./scheduler/parser.js";

// Goals
export type { Goal, GoalStatus, CreateGoalInput, ProgressEntry } from "./goals/models.js";
export { GoalStore } from "./goals/store.js";
export { GoalManager } from "./goals/manager.js";

// User Context
export { UserContext } from "./user/context.js";

// Application
export { Application } from "./app.js";
