import { describe, it, expect, beforeEach, afterEach } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createApiRouter } from "../src/server/api.js";

// Create a minimal mock Application for API testing
function createMockApp() {
  const tasks: Record<string, unknown>[] = [];
  return {
    agentLoop: {
      getState: () => ({
        phase: "idle",
        cycleNumber: 5,
        isPaused: false,
        currentTaskId: null,
        currentTaskTitle: null,
        startedAt: new Date(),
        lastCycleAt: new Date(),
      }),
      pause: () => {},
      resume: () => {},
      wake: () => {},
      stop: () => {},
    },
    metrics: {
      toJSON: () => ({
        cycleCount: 5,
        totalTokensUsed: 1000,
        totalCostUsd: 0.003,
        errorCount: 0,
        tasksCompleted: 3,
        tasksFailed: 0,
        uptimeMs: 60000,
        uptimeFormatted: "0h 1m 0s",
      }),
    },
    taskManager: {
      getRecent: () => tasks,
      getPending: () => tasks.filter((t) => t.status === "pending"),
      createTask: (input: Record<string, unknown>) => {
        const task = { id: "test-id", status: "pending", ...input };
        tasks.push(task);
        return task;
      },
      getById: (id: string) => tasks.find((t) => t.id === id) ?? null,
    },
    goalManager: {
      getAllGoals: () => [],
      getGoal: () => null,
      createGoal: async (input: Record<string, unknown>) => ({
        id: "goal-id",
        status: "active",
        ...input,
      }),
      pauseGoal: () => true,
      resumeGoal: () => true,
      cancelGoal: () => true,
    },
    scheduler: {
      getSchedules: () => [],
      addSchedule: (opts: Record<string, unknown>) => ({
        id: "sched-id",
        ...opts,
      }),
      removeSchedule: () => true,
    },
    integrationManager: {
      registeredIntegrations: ["rest"],
      getAllToolDefinitions: () => [
        {
          type: "function",
          function: { name: "rest_get", description: "GET request" },
        },
      ],
    },
    budget: {
      remainingDailyBudget: 95.5,
    },
    llmRouter: {},
    memoryManager: {},
    userContext: {
      toPromptString: () => "",
    },
    settings: { api: { host: "127.0.0.1", port: 0 } },
    shutdown: async () => {},
  };
}

describe("API Routes", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = createMockApp();
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use(createApiRouter(app as any));
    server = createServer(expressApp);

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /api/status", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.phase).toBe("idle");
    expect(data.cycleNumber).toBe(5);
    expect(data.metrics.cycleCount).toBe(5);
  });

  it("GET /api/metrics", async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    const data = await res.json();
    expect(data.cycleCount).toBe(5);
    expect(data.uptimeFormatted).toBe("0h 1m 0s");
  });

  it("POST /api/tasks creates a task", async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "API task" }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.task.title).toBe("API task");
  });

  it("POST /api/tasks without title returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/goals", async () => {
    const res = await fetch(`${baseUrl}/api/goals`);
    const data = await res.json();
    expect(data.goals).toEqual([]);
  });

  it("GET /api/schedules", async () => {
    const res = await fetch(`${baseUrl}/api/schedules`);
    const data = await res.json();
    expect(data.schedules).toEqual([]);
  });

  it("GET /api/integrations", async () => {
    const res = await fetch(`${baseUrl}/api/integrations`);
    const data = await res.json();
    expect(data.integrations).toContain("rest");
    expect(data.totalTools).toBe(1);
  });

  it("GET /api/budget", async () => {
    const res = await fetch(`${baseUrl}/api/budget`);
    const data = await res.json();
    expect(data.remainingDailyBudget).toBe(95.5);
  });

  it("POST /api/control/pause", async () => {
    const res = await fetch(`${baseUrl}/api/control/pause`, { method: "POST" });
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("POST /api/control/resume", async () => {
    const res = await fetch(`${baseUrl}/api/control/resume`, { method: "POST" });
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});
