import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { GoalStore } from "../src/goals/store.js";
import { GoalManager } from "../src/goals/manager.js";
import { TaskStore } from "../src/tasks/store.js";
import { TaskManager } from "../src/tasks/manager.js";
import { Scheduler } from "../src/scheduler/scheduler.js";
import { LLMRouter } from "../src/llm/router.js";
import { EventBus } from "../src/observability/events.js";
import { initializeSchema } from "../src/db/client.js";

describe("GoalStore", () => {
  let db: Database.Database;
  let store: GoalStore;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    store = new GoalStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create a goal", () => {
    const goal = store.create({ title: "Learn TypeScript" });
    expect(goal.id).toBeDefined();
    expect(goal.title).toBe("Learn TypeScript");
    expect(goal.status).toBe("pending");
    expect(goal.progressLog).toEqual([]);
    expect(goal.taskIds).toEqual([]);
  });

  it("should retrieve goal by id", () => {
    const created = store.create({ title: "Test goal" });
    const found = store.getById(created.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Test goal");
  });

  it("should list all goals", () => {
    store.create({ title: "Goal 1" });
    store.create({ title: "Goal 2" });
    expect(store.getAll()).toHaveLength(2);
  });

  it("should update status", () => {
    const goal = store.create({ title: "Complete me" });
    store.updateStatus(goal.id, "active");
    expect(store.getById(goal.id)!.status).toBe("active");
  });

  it("should add progress entries", () => {
    const goal = store.create({ title: "Track me" });
    store.addProgressEntry(goal.id, {
      timestamp: new Date().toISOString(),
      step: "Started working",
      status: "active",
    });

    const updated = store.getById(goal.id)!;
    expect(updated.progressLog).toHaveLength(1);
    expect(updated.currentStep).toBe("Started working");
  });

  it("should add task IDs", () => {
    const goal = store.create({ title: "With tasks" });
    store.addTaskId(goal.id, "task-1");
    store.addTaskId(goal.id, "task-2");

    const updated = store.getById(goal.id)!;
    expect(updated.taskIds).toEqual(["task-1", "task-2"]);
  });

  it("should filter by status", () => {
    store.create({ title: "Pending" });
    const active = store.create({ title: "Active" });
    store.updateStatus(active.id, "active");

    expect(store.getByStatus("active")).toHaveLength(1);
    expect(store.getByStatus("pending")).toHaveLength(1);
  });

  it("should store success criteria", () => {
    const goal = store.create({
      title: "With criteria",
      successCriteria: ["Criterion 1", "Criterion 2"],
    });

    const found = store.getById(goal.id)!;
    expect(found.successCriteria).toEqual(["Criterion 1", "Criterion 2"]);
  });
});

describe("GoalManager", () => {
  let db: Database.Database;
  let goalManager: GoalManager;
  let taskManager: TaskManager;
  let scheduler: Scheduler;
  let eventBus: EventBus;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    eventBus = new EventBus();
    taskManager = new TaskManager(new TaskStore(db), eventBus);
    scheduler = new Scheduler(taskManager, eventBus);
    const llmRouter = new LLMRouter([]); // No LLM configured
    goalManager = new GoalManager(
      new GoalStore(db),
      taskManager,
      scheduler,
      llmRouter,
      eventBus,
    );
  });

  afterEach(() => {
    scheduler.stopAll();
    db.close();
  });

  it("should create a goal with tasks and schedule", async () => {
    const events: unknown[] = [];
    eventBus.on("goal:created", (e) => events.push(e));

    const goal = await goalManager.createGoal({
      title: "Inbox zero",
      successCriteria: ["No unread emails"],
    });

    expect(goal.status).toBe("active");
    expect(events).toHaveLength(1);

    // Tasks are created in the DB — check via taskManager
    const tasks = taskManager.getPending();
    expect(tasks.length).toBeGreaterThanOrEqual(1);

    // Should have created a check-in schedule
    const schedules = scheduler.getSchedules();
    expect(schedules.length).toBeGreaterThanOrEqual(1);
  });

  it("should pause and resume a goal", async () => {
    const goal = await goalManager.createGoal({ title: "Pausable" });

    expect(goalManager.pauseGoal(goal.id)).toBe(true);
    expect(goalManager.getGoal(goal.id)!.status).toBe("paused");

    expect(goalManager.resumeGoal(goal.id)).toBe(true);
    expect(goalManager.getGoal(goal.id)!.status).toBe("active");
  });

  it("should cancel a goal", async () => {
    const goal = await goalManager.createGoal({ title: "Cancellable" });

    expect(goalManager.cancelGoal(goal.id)).toBe(true);
    expect(goalManager.getGoal(goal.id)!.status).toBe("cancelled");
  });

  it("should complete a goal and emit event", async () => {
    const events: unknown[] = [];
    eventBus.on("goal:completed", (e) => events.push(e));

    const goal = await goalManager.createGoal({ title: "Completable" });
    goalManager.completeGoal(goal.id);

    expect(goalManager.getGoal(goal.id)!.status).toBe("completed");
    expect(events).toHaveLength(1);
  });

  it("should check in without LLM", async () => {
    const goal = await goalManager.createGoal({ title: "Check-in test" });
    const result = await goalManager.checkIn(goal.id);
    expect(result).toContain("LLM not available");
  });

  it("should list active goals", async () => {
    await goalManager.createGoal({ title: "Active 1" });
    await goalManager.createGoal({ title: "Active 2" });

    const active = goalManager.getActiveGoals();
    expect(active).toHaveLength(2);
  });
});
