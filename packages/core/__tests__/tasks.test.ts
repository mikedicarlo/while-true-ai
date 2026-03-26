import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { TaskStore } from "../src/tasks/store.js";
import { TaskManager } from "../src/tasks/manager.js";
import { TaskPriority } from "../src/tasks/models.js";
import { EventBus } from "../src/observability/events.js";
import { initializeSchema } from "../src/db/client.js";

describe("TaskStore", () => {
  let db: Database.Database;
  let store: TaskStore;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    store = new TaskStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create a task", () => {
    const task = store.create({ title: "Test task" });
    expect(task.id).toBeDefined();
    expect(task.title).toBe("Test task");
    expect(task.status).toBe("pending");
    expect(task.priority).toBe(TaskPriority.NORMAL);
  });

  it("should retrieve task by id", () => {
    const created = store.create({ title: "Find me" });
    const found = store.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Find me");
  });

  it("should return null for unknown id", () => {
    expect(store.getById("nonexistent")).toBeNull();
  });

  it("should list pending tasks sorted by priority", () => {
    store.create({ title: "Low", priority: TaskPriority.LOW });
    store.create({ title: "High", priority: TaskPriority.HIGH });
    store.create({ title: "Critical", priority: TaskPriority.CRITICAL });

    const pending = store.getPending();
    expect(pending).toHaveLength(3);
    expect(pending[0].title).toBe("Critical");
    expect(pending[1].title).toBe("High");
    expect(pending[2].title).toBe("Low");
  });

  it("should update task status", () => {
    const task = store.create({ title: "Complete me" });
    store.updateStatus(task.id, "completed");

    const updated = store.getById(task.id);
    expect(updated!.status).toBe("completed");
    expect(updated!.completedAt).not.toBeNull();
  });

  it("should get recent tasks", () => {
    store.create({ title: "Task 1" });
    store.create({ title: "Task 2" });
    store.create({ title: "Task 3" });

    const recent = store.getRecent(2);
    expect(recent).toHaveLength(2);
  });
});

describe("TaskManager", () => {
  let db: Database.Database;
  let manager: TaskManager;
  let eventBus: EventBus;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    eventBus = new EventBus();
    manager = new TaskManager(new TaskStore(db), eventBus);
  });

  afterEach(() => {
    db.close();
  });

  it("should create task and emit event", () => {
    const events: unknown[] = [];
    eventBus.on("task:created", (e) => events.push(e));

    const task = manager.createTask({ title: "Event task" });
    expect(task.title).toBe("Event task");
    expect(events).toHaveLength(1);
  });

  it("should get next task by priority", () => {
    manager.createTask({
      title: "Low priority",
      priority: TaskPriority.LOW,
    });
    manager.createTask({
      title: "High priority",
      priority: TaskPriority.HIGH,
    });

    const next = manager.getNextTask();
    expect(next!.title).toBe("High priority");
  });

  it("should return null when no pending tasks", () => {
    expect(manager.getNextTask()).toBeNull();
  });

  it("should mark task completed and emit event", () => {
    const events: unknown[] = [];
    eventBus.on("task:completed", (e) => events.push(e));

    const task = manager.createTask({ title: "Complete me" });
    manager.markCompleted(task.id);

    expect(events).toHaveLength(1);
  });

  it("should mark task failed and emit event", () => {
    const events: unknown[] = [];
    eventBus.on("task:failed", (e) => events.push(e));

    const task = manager.createTask({ title: "Fail me" });
    manager.markFailed(task.id, "Something went wrong");

    expect(events).toHaveLength(1);
  });
});
