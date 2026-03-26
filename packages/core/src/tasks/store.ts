import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Task, CreateTaskInput, TaskStatus } from "./models.js";
import { TaskPriority } from "./models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("tasks:store");

export class TaskStore {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskInput): Task {
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? TaskPriority.NORMAL,
      status: "pending",
      source: input.source ?? "user",
      parentId: input.parentId ?? null,
      dueAt: input.dueAt ?? null,
      requiresApproval: input.requiresApproval ?? false,
      blockedBy: [],
      metadata: input.metadata ?? {},
      createdAt: new Date(),
      completedAt: null,
    };

    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, title, description, priority, status, source, parent_id, due_at, requires_approval, blocked_by, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      task.title,
      task.description,
      task.priority,
      task.status,
      task.source,
      task.parentId,
      task.dueAt?.toISOString() ?? null,
      task.requiresApproval ? 1 : 0,
      JSON.stringify(task.blockedBy),
      JSON.stringify(task.metadata),
      task.createdAt.toISOString(),
    );

    log.info({ taskId: task.id, title: task.title }, "Task created");
    return task;
  }

  getById(id: string): Task | null {
    const stmt = this.db.prepare("SELECT * FROM tasks WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToTask(row) : null;
  }

  getByStatus(status: TaskStatus): Task[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tasks WHERE status = ? ORDER BY priority ASC, created_at ASC",
    );
    const rows = stmt.all(status) as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  getPending(): Task[] {
    return this.getByStatus("pending");
  }

  updateStatus(id: string, status: TaskStatus): void {
    const completedAt =
      status === "completed" || status === "failed"
        ? new Date().toISOString()
        : null;

    const stmt = this.db.prepare(
      "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
    );
    stmt.run(status, completedAt, id);
    log.debug({ taskId: id, status }, "Task status updated");
  }

  getRecent(limit = 20): Task[] {
    const stmt = this.db.prepare(
      "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?",
    );
    const rows = stmt.all(limit) as Record<string, unknown>[];
    return rows.map((r) => this.rowToTask(r));
  }

  deleteAll(): void {
    this.db.prepare("DELETE FROM tasks").run();
    log.info("All tasks deleted");
  }

  private rowToTask(row: Record<string, unknown>): Task {
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) ?? null,
      priority: (row.priority as TaskPriority) ?? TaskPriority.NORMAL,
      status: (row.status as TaskStatus) ?? "pending",
      source: (row.source as Task["source"]) ?? "user",
      parentId: (row.parent_id as string) ?? null,
      dueAt: row.due_at ? new Date(row.due_at as string) : null,
      requiresApproval: Boolean(row.requires_approval),
      blockedBy: row.blocked_by
        ? (JSON.parse(row.blocked_by as string) as string[])
        : [],
      metadata: row.metadata
        ? (JSON.parse(row.metadata as string) as Record<string, unknown>)
        : {},
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at
        ? new Date(row.completed_at as string)
        : null,
    };
  }
}
