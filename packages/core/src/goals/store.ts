import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { Goal, CreateGoalInput, GoalStatus, ProgressEntry } from "./models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("goals:store");

export class GoalStore {
  constructor(private db: Database.Database) {}

  create(input: CreateGoalInput): Goal {
    const goal: Goal = {
      id: randomUUID(),
      title: input.title,
      description: input.description ?? null,
      successCriteria: input.successCriteria ?? [],
      status: "pending",
      deadline: input.deadline ?? null,
      checkInIntervalMinutes: input.checkInIntervalMinutes ?? 30,
      checkInCron: input.checkInCron ?? null,
      scheduleId: null,
      progressLog: [],
      currentStep: null,
      taskIds: [],
      createdAt: new Date(),
      completedAt: null,
    };

    const stmt = this.db.prepare(`
      INSERT INTO goals (id, title, description, success_criteria, status, deadline,
        check_in_interval_minutes, check_in_cron, schedule_id, progress_log,
        current_step, task_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      goal.id,
      goal.title,
      goal.description,
      JSON.stringify(goal.successCriteria),
      goal.status,
      goal.deadline?.toISOString() ?? null,
      goal.checkInIntervalMinutes,
      goal.checkInCron,
      goal.scheduleId,
      JSON.stringify(goal.progressLog),
      goal.currentStep,
      JSON.stringify(goal.taskIds),
      goal.createdAt.toISOString(),
    );

    log.info({ goalId: goal.id, title: goal.title }, "Goal created");
    return goal;
  }

  getById(id: string): Goal | null {
    const stmt = this.db.prepare("SELECT * FROM goals WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToGoal(row) : null;
  }

  getAll(): Goal[] {
    const stmt = this.db.prepare(
      "SELECT * FROM goals ORDER BY created_at DESC",
    );
    return (stmt.all() as Record<string, unknown>[]).map((r) => this.rowToGoal(r));
  }

  getByStatus(status: GoalStatus): Goal[] {
    const stmt = this.db.prepare(
      "SELECT * FROM goals WHERE status = ? ORDER BY created_at DESC",
    );
    return (stmt.all(status) as Record<string, unknown>[]).map((r) => this.rowToGoal(r));
  }

  getActive(): Goal[] {
    return this.getByStatus("active");
  }

  updateStatus(id: string, status: GoalStatus): void {
    const completedAt =
      status === "completed" || status === "failed"
        ? new Date().toISOString()
        : null;
    this.db
      .prepare("UPDATE goals SET status = ?, completed_at = ? WHERE id = ?")
      .run(status, completedAt, id);
  }

  updateScheduleId(id: string, scheduleId: string): void {
    this.db
      .prepare("UPDATE goals SET schedule_id = ? WHERE id = ?")
      .run(scheduleId, id);
  }

  addTaskId(id: string, taskId: string): void {
    const goal = this.getById(id);
    if (!goal) return;
    const taskIds = [...goal.taskIds, taskId];
    this.db
      .prepare("UPDATE goals SET task_ids = ? WHERE id = ?")
      .run(JSON.stringify(taskIds), id);
  }

  addProgressEntry(id: string, entry: ProgressEntry): void {
    const goal = this.getById(id);
    if (!goal) return;
    const log = [...goal.progressLog, entry];
    this.db
      .prepare("UPDATE goals SET progress_log = ?, current_step = ? WHERE id = ?")
      .run(JSON.stringify(log), entry.step, id);
  }

  updateCurrentStep(id: string, step: string): void {
    this.db
      .prepare("UPDATE goals SET current_step = ? WHERE id = ?")
      .run(step, id);
  }

  private rowToGoal(row: Record<string, unknown>): Goal {
    return {
      id: row.id as string,
      title: row.title as string,
      description: (row.description as string) ?? null,
      successCriteria: row.success_criteria
        ? JSON.parse(row.success_criteria as string)
        : [],
      status: (row.status as GoalStatus) ?? "pending",
      deadline: row.deadline ? new Date(row.deadline as string) : null,
      checkInIntervalMinutes: (row.check_in_interval_minutes as number) ?? 30,
      checkInCron: (row.check_in_cron as string) ?? null,
      scheduleId: (row.schedule_id as string) ?? null,
      progressLog: row.progress_log
        ? JSON.parse(row.progress_log as string)
        : [],
      currentStep: (row.current_step as string) ?? null,
      taskIds: row.task_ids ? JSON.parse(row.task_ids as string) : [],
      createdAt: new Date(row.created_at as string),
      completedAt: row.completed_at
        ? new Date(row.completed_at as string)
        : null,
    };
  }
}
