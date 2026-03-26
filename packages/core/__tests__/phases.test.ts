import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { thinkPhase, decidePhase } from "../src/agent/phases.js";
import { TaskStore } from "../src/tasks/store.js";
import { TaskManager } from "../src/tasks/manager.js";
import { TaskPriority } from "../src/tasks/models.js";
import { IntegrationManager } from "../src/integrations/manager.js";
import { EventBus } from "../src/observability/events.js";
import { LLMRouter } from "../src/llm/router.js";
import { initializeSchema } from "../src/db/client.js";

describe("Think Phase", () => {
  let db: Database.Database;
  let taskManager: TaskManager;
  let integrationManager: IntegrationManager;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    taskManager = new TaskManager(new TaskStore(db), new EventBus());
    integrationManager = new IntegrationManager();
  });

  afterEach(() => {
    db.close();
  });

  it("should report no work when empty", async () => {
    const context = await thinkPhase({ taskManager, integrationManager });
    expect(context.hasWork).toBe(false);
    expect(context.pendingTasks).toHaveLength(0);
  });

  it("should detect pending tasks as work", async () => {
    taskManager.createTask({ title: "Do something" });
    const context = await thinkPhase({ taskManager, integrationManager });
    expect(context.hasWork).toBe(true);
    expect(context.pendingTasks).toHaveLength(1);
  });
});

describe("Decide Phase", () => {
  let db: Database.Database;
  let taskManager: TaskManager;
  let llmRouter: LLMRouter;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    taskManager = new TaskManager(new TaskStore(db), new EventBus());
    llmRouter = new LLMRouter([]);
  });

  afterEach(() => {
    db.close();
  });

  it("should return idle when no work", async () => {
    const plan = await decidePhase(
      { pendingTasks: [], hasWork: false, signals: [] },
      { taskManager, llmRouter },
    );
    expect(plan.isIdle).toBe(true);
    expect(plan.task).toBeNull();
  });

  it("should select highest priority task", async () => {
    taskManager.createTask({
      title: "Low",
      priority: TaskPriority.LOW,
    });
    taskManager.createTask({
      title: "Critical",
      priority: TaskPriority.CRITICAL,
    });

    const pending = taskManager.getPending();
    const plan = await decidePhase(
      { pendingTasks: pending, hasWork: true, signals: [] },
      { taskManager, llmRouter },
    );

    expect(plan.isIdle).toBe(false);
    expect(plan.task!.title).toBe("Critical");
  });
});
