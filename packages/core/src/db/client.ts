import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("db");

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

export function createDatabase(dbPath: string): {
  db: DrizzleDB;
  sqlite: Database.Database;
} {
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  log.info({ dbPath }, "Database connected");

  return { db, sqlite };
}

export function initializeSchema(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority INTEGER NOT NULL DEFAULT 3,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'user',
      parent_id TEXT,
      due_at TEXT,
      requires_approval INTEGER DEFAULT 0,
      blocked_by TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      success_criteria TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      deadline TEXT,
      check_in_interval_minutes INTEGER DEFAULT 30,
      check_in_cron TEXT,
      schedule_id TEXT,
      progress_log TEXT,
      current_step TEXT,
      task_ids TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_entries (
      id TEXT PRIMARY KEY,
      tier TEXT NOT NULL,
      content TEXT NOT NULL,
      entry_type TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      token_count INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      cycle_number INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      integration TEXT,
      params TEXT,
      reasoning TEXT,
      outcome TEXT,
      success INTEGER NOT NULL,
      tokens_used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cost_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      model_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL,
      trigger_value TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_description TEXT,
      task_priority INTEGER DEFAULT 3,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
    CREATE INDEX IF NOT EXISTS idx_memory_tier ON memory_entries(tier);
    CREATE INDEX IF NOT EXISTS idx_memory_expires ON memory_entries(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
  `);

  log.info("Database schema initialized");
}
