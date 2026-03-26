import {
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(3), // 1=critical, 2=high, 3=normal, 4=low, 5=background
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed, cancelled, blocked
  source: text("source").notNull().default("user"), // user, scheduled, discovered, decomposed, recurring, goal_checkin
  parentId: text("parent_id"),
  dueAt: text("due_at"),
  requiresApproval: integer("requires_approval", { mode: "boolean" }).default(
    false,
  ),
  blockedBy: text("blocked_by"), // JSON array of task IDs
  metadata: text("metadata"), // JSON
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  successCriteria: text("success_criteria"), // JSON array of strings
  status: text("status").notNull().default("pending"), // pending, active, paused, completed, failed, cancelled
  deadline: text("deadline"),
  checkInIntervalMinutes: integer("check_in_interval_minutes").default(30),
  checkInCron: text("check_in_cron"),
  scheduleId: text("schedule_id"),
  progressLog: text("progress_log"), // JSON array
  currentStep: text("current_step"),
  taskIds: text("task_ids"), // JSON array
  createdAt: text("created_at").notNull(),
  completedAt: text("completed_at"),
});

export const memoryEntries = sqliteTable("memory_entries", {
  id: text("id").primaryKey(),
  tier: text("tier").notNull(), // short, medium, long
  content: text("content").notNull(),
  entryType: text("entry_type").notNull(), // cycle_result, task_outcome, observation, fact
  importance: real("importance").default(0.5),
  tokenCount: integer("token_count").default(0),
  metadata: text("metadata"), // JSON
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at"),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  cycleNumber: integer("cycle_number").notNull(),
  actionType: text("action_type").notNull(),
  integration: text("integration"),
  params: text("params"),
  reasoning: text("reasoning"),
  outcome: text("outcome"),
  success: integer("success", { mode: "boolean" }).notNull(),
  tokensUsed: integer("tokens_used").default(0),
});

export const costRecords = sqliteTable("cost_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  modelId: text("model_id").notNull(),
  purpose: text("purpose").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
});

export const schedules = sqliteTable("schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // cron, interval
  triggerValue: text("trigger_value").notNull(), // cron expression or interval seconds
  taskTitle: text("task_title").notNull(),
  taskDescription: text("task_description"),
  taskPriority: integer("task_priority").default(3),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  lastRunAt: text("last_run_at"),
  nextRunAt: text("next_run_at"),
  createdAt: text("created_at").notNull(),
});
