import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { Scheduler } from "../src/scheduler/scheduler.js";
import { TaskManager } from "../src/tasks/manager.js";
import { TaskStore } from "../src/tasks/store.js";
import { EventBus } from "../src/observability/events.js";
import { initializeSchema } from "../src/db/client.js";

describe("Scheduler", () => {
  let db: Database.Database;
  let taskManager: TaskManager;
  let eventBus: EventBus;
  let scheduler: Scheduler;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    eventBus = new EventBus();
    taskManager = new TaskManager(new TaskStore(db), eventBus);
    scheduler = new Scheduler(taskManager, eventBus);
  });

  afterEach(() => {
    scheduler.stopAll();
    db.close();
  });

  it("should add a schedule", () => {
    const entry = scheduler.addSchedule({
      name: "Test schedule",
      cronExpression: "*/5 * * * *",
      taskTitle: "Test task",
    });

    expect(entry.id).toBeDefined();
    expect(entry.name).toBe("Test schedule");
    expect(entry.enabled).toBe(true);
    expect(entry.nextRunAt).not.toBeNull();
  });

  it("should list schedules", () => {
    scheduler.addSchedule({
      name: "Schedule 1",
      cronExpression: "0 * * * *",
      taskTitle: "Task 1",
    });
    scheduler.addSchedule({
      name: "Schedule 2",
      cronExpression: "0 9 * * *",
      taskTitle: "Task 2",
    });

    const schedules = scheduler.getSchedules();
    expect(schedules).toHaveLength(2);
  });

  it("should remove a schedule", () => {
    const entry = scheduler.addSchedule({
      name: "Removable",
      cronExpression: "0 * * * *",
      taskTitle: "Task",
    });

    expect(scheduler.removeSchedule(entry.id)).toBe(true);
    expect(scheduler.getSchedules()).toHaveLength(0);
  });

  it("should return false for removing unknown schedule", () => {
    expect(scheduler.removeSchedule("nonexistent")).toBe(false);
  });

  it("should add from natural language", () => {
    const entry = scheduler.addFromNaturalLanguage(
      "every 30 minutes",
      "Check email",
    );

    expect(entry).not.toBeNull();
    expect(entry!.name).toBe("Every 30 minutes");
    expect(entry!.taskTitle).toBe("Check email");
  });

  it("should return null for unparseable natural language", () => {
    const entry = scheduler.addFromNaturalLanguage(
      "sometime tomorrow maybe",
      "Do something",
    );
    expect(entry).toBeNull();
  });

  it("should create a task when run manually", () => {
    const entry = scheduler.addSchedule({
      name: "Manual run",
      cronExpression: "0 0 1 1 *", // Far future
      taskTitle: "Manual task",
    });

    scheduler.runNow(entry.id);
    const tasks = taskManager.getPending();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Manual task");
    expect(tasks[0].source).toBe("scheduled");
  });

  it("should call wake callback when firing", () => {
    const wakeFn = vi.fn();
    scheduler.setWakeCallback(wakeFn);

    const entry = scheduler.addSchedule({
      name: "Wake test",
      cronExpression: "0 0 1 1 *",
      taskTitle: "Wake task",
    });

    scheduler.runNow(entry.id);
    expect(wakeFn).toHaveBeenCalledOnce();
  });

  it("should stop all schedules", () => {
    scheduler.addSchedule({
      name: "S1",
      cronExpression: "0 * * * *",
      taskTitle: "T1",
    });
    scheduler.addSchedule({
      name: "S2",
      cronExpression: "0 * * * *",
      taskTitle: "T2",
    });

    scheduler.stopAll();
    expect(scheduler.getSchedules()).toHaveLength(0);
  });
});
