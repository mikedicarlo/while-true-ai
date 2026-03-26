import { Cron } from "croner";
import { randomUUID } from "node:crypto";
import type { TaskManager } from "../tasks/manager.js";
import type { EventBus } from "../observability/events.js";
import { getLogger } from "../observability/logger.js";
import { parseSchedule } from "./parser.js";

const log = getLogger("scheduler");

export interface ScheduleEntry {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  taskTitle: string;
  taskDescription?: string;
  taskPriority: number;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
}

export class Scheduler {
  private jobs = new Map<string, { cron: Cron; entry: ScheduleEntry }>();
  private wakeCallback: (() => void) | null = null;

  constructor(
    private taskManager: TaskManager,
    private eventBus: EventBus,
  ) {}

  setWakeCallback(cb: () => void): void {
    this.wakeCallback = cb;
  }

  addSchedule(opts: {
    name: string;
    description?: string;
    cronExpression: string;
    taskTitle: string;
    taskDescription?: string;
    taskPriority?: number;
  }): ScheduleEntry {
    const id = randomUUID();
    const entry: ScheduleEntry = {
      id,
      name: opts.name,
      description: opts.description ?? "",
      cronExpression: opts.cronExpression,
      taskTitle: opts.taskTitle,
      taskDescription: opts.taskDescription,
      taskPriority: opts.taskPriority ?? 3,
      enabled: true,
      nextRunAt: null,
      lastRunAt: null,
    };

    const cron = new Cron(opts.cronExpression, () => {
      this.fireSchedule(entry);
    });

    entry.nextRunAt = cron.nextRun() ?? null;
    this.jobs.set(id, { cron, entry });

    log.info({ id, name: opts.name, cron: opts.cronExpression }, "Schedule added");
    return entry;
  }

  addFromNaturalLanguage(
    description: string,
    taskTitle: string,
    taskDescription?: string,
  ): ScheduleEntry | null {
    const parsed = parseSchedule(description);
    if (!parsed || parsed.type !== "cron") {
      return null;
    }

    return this.addSchedule({
      name: parsed.description,
      description: `${parsed.description}: ${taskTitle}`,
      cronExpression: parsed.value,
      taskTitle,
      taskDescription,
    });
  }

  removeSchedule(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    job.cron.stop();
    this.jobs.delete(id);
    log.info({ id, name: job.entry.name }, "Schedule removed");
    return true;
  }

  getSchedules(): ScheduleEntry[] {
    return [...this.jobs.values()].map((j) => ({
      ...j.entry,
      nextRunAt: j.cron.nextRun() ?? null,
    }));
  }

  getSchedule(id: string): ScheduleEntry | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    return { ...job.entry, nextRunAt: job.cron.nextRun() ?? null };
  }

  runNow(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    this.fireSchedule(job.entry);
    return true;
  }

  stopAll(): void {
    for (const job of this.jobs.values()) {
      job.cron.stop();
    }
    this.jobs.clear();
    log.info("All schedules stopped");
  }

  private fireSchedule(entry: ScheduleEntry): void {
    entry.lastRunAt = new Date();

    this.taskManager.createTask({
      title: entry.taskTitle,
      description: entry.taskDescription,
      priority: entry.taskPriority as 1 | 2 | 3 | 4 | 5,
      source: "scheduled",
    });

    log.info({ name: entry.name, task: entry.taskTitle }, "Schedule fired");

    // Wake the agent loop
    if (this.wakeCallback) {
      this.wakeCallback();
    }
  }
}
