import type { Task, CreateTaskInput, TaskStatus } from "./models.js";
import type { TaskStore } from "./store.js";
import type { EventBus } from "../observability/events.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("tasks:manager");

export class TaskManager {
  constructor(
    private store: TaskStore,
    private eventBus: EventBus,
  ) {}

  createTask(input: CreateTaskInput): Task {
    const task = this.store.create(input);
    this.eventBus.emit("task:created", {
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      source: task.source,
    });
    return task;
  }

  getPending(): Task[] {
    return this.store.getPending();
  }

  getById(id: string): Task | null {
    return this.store.getById(id);
  }

  getRecent(limit?: number): Task[] {
    return this.store.getRecent(limit);
  }

  markInProgress(taskId: string): void {
    this.store.updateStatus(taskId, "in_progress");
    this.eventBus.emit("task:started", { taskId });
  }

  markCompleted(taskId: string, result?: string): void {
    this.store.updateStatus(taskId, "completed");
    this.eventBus.emit("task:completed", { taskId, result });
    log.info({ taskId }, "Task completed");
  }

  markFailed(taskId: string, error?: string): void {
    this.store.updateStatus(taskId, "failed");
    this.eventBus.emit("task:failed", { taskId, error });
    log.warn({ taskId, error }, "Task failed");
  }

  updateStatus(taskId: string, status: TaskStatus): void {
    this.store.updateStatus(taskId, status);
  }

  getNextTask(): Task | null {
    const pending = this.getPending();
    if (pending.length === 0) return null;

    // Already sorted by priority and created_at from store
    // Filter out blocked tasks
    return (
      pending.find((t) => {
        if (t.blockedBy.length === 0) return true;
        // Check if all blocking tasks are completed
        return t.blockedBy.every((blockerId) => {
          const blocker = this.store.getById(blockerId);
          return blocker?.status === "completed";
        });
      }) ?? null
    );
  }

  clearAll(force = false): number {
    if (!force) {
      // Only clear completed/failed/cancelled
      const recent = this.store.getRecent(1000);
      let cleared = 0;
      for (const task of recent) {
        if (["completed", "failed", "cancelled"].includes(task.status)) {
          this.store.updateStatus(task.id, "cancelled");
          cleared++;
        }
      }
      return cleared;
    }
    this.store.deleteAll();
    return -1; // Indicates all deleted
  }
}
