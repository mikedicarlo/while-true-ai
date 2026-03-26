import type { Application } from "@while-true-ai/core";

interface CommandResult {
  output: string;
}

type CommandHandler = (args: string, app: Application) => CommandResult | Promise<CommandResult>;

const commands = new Map<string, CommandHandler>();

function reg(name: string, handler: CommandHandler) {
  commands.set(name, handler);
}

// ─── Register all commands ───────────────────────────────────

reg("help", () => {
  const lines = [
    "  /help               Show this help",
    "  /status             Agent status",
    "  /tasks              List recent tasks",
    "  /add_task <desc>    Create a task",
    "  /goals              List goals",
    "  /add_goal <title>   Create a goal",
    "  /goal show <id>     Show goal details",
    "  /goal pause <id>    Pause a goal",
    "  /goal resume <id>   Resume a goal",
    "  /goal cancel <id>   Cancel a goal",
    "  /schedules          List schedules",
    "  /add_schedule \"task\" <schedule>",
    "  /metrics            Show metrics",
    "  /budget             Show budget",
    "  /integrations       List integrations",
    "  /pause              Pause agent",
    "  /resume             Resume agent",
    "  /wake               Wake agent",
    "  /context            Show user context",
  ];
  return { output: `Commands:\r\n${lines.join("\r\n")}` };
});

reg("status", (_args, app) => {
  const state = app.agentLoop.getState();
  const m = app.metrics.toJSON();
  return {
    output: [
      `Phase:    ${state.phase}`,
      `Cycle:    ${state.cycleNumber}`,
      `Paused:   ${state.isPaused}`,
      `Uptime:   ${m.uptimeFormatted}`,
      `Tokens:   ${m.totalTokensUsed}`,
      `Cost:     $${(m.totalCostUsd as number).toFixed(4)}`,
    ].join("\r\n"),
  };
});

reg("tasks", (_args, app) => {
  const tasks = app.taskManager.getRecent(15);
  if (tasks.length === 0) return { output: "No tasks." };
  const lines = tasks.map((t) => `  [${t.status.padEnd(11)}] P${t.priority} ${t.title}`);
  return { output: `Recent tasks:\r\n${lines.join("\r\n")}` };
});

reg("add_task", (args, app) => {
  if (!args) return { output: "Usage: /add_task <description>" };
  const task = app.taskManager.createTask({ title: args });
  app.agentLoop.wake();
  return { output: `Task created: ${task.title} (${task.id.slice(0, 8)})` };
});

reg("goals", (_args, app) => {
  const goals = app.goalManager.getAllGoals();
  if (goals.length === 0) return { output: "No goals." };
  const lines = goals.map((g) => `  [${g.status.padEnd(10)}] ${g.title}  ${g.id.slice(0, 8)}`);
  return { output: `Goals:\r\n${lines.join("\r\n")}` };
});

reg("add_goal", async (args, app) => {
  if (!args) return { output: 'Usage: /add_goal <title>' };
  const title = args.replace(/^"(.*)"$/, "$1");
  const goal = await app.goalManager.createGoal({ title });
  return { output: `Goal created: ${goal.title} (${goal.id.slice(0, 8)})` };
});

reg("goal", async (args, app) => {
  const parts = args.split(/\s+/);
  const action = parts[0];
  const idPrefix = parts[1];
  if (!action || !idPrefix) return { output: "Usage: /goal <show|pause|resume|cancel> <id>" };

  const goals = app.goalManager.getAllGoals();
  const goal = goals.find((g) => g.id.startsWith(idPrefix));
  if (!goal) return { output: `Goal not found: ${idPrefix}` };

  switch (action) {
    case "show":
      return {
        output: [
          `Title:    ${goal.title}`,
          `Status:   ${goal.status}`,
          `Step:     ${goal.currentStep ?? "N/A"}`,
          `Tasks:    ${goal.taskIds.length}`,
          ...goal.progressLog.map((p) => `  ${p.timestamp}: ${p.step}`),
        ].join("\r\n"),
      };
    case "pause":
      app.goalManager.pauseGoal(goal.id);
      return { output: `Goal paused: ${goal.title}` };
    case "resume":
      app.goalManager.resumeGoal(goal.id);
      return { output: `Goal resumed: ${goal.title}` };
    case "cancel":
      app.goalManager.cancelGoal(goal.id);
      return { output: `Goal cancelled: ${goal.title}` };
    default:
      return { output: `Unknown action: ${action}` };
  }
});

reg("schedules", (_args, app) => {
  const schedules = app.scheduler.getSchedules();
  if (schedules.length === 0) return { output: "No active schedules." };
  const lines = schedules.map((s) => {
    const next = s.nextRunAt ? s.nextRunAt.toLocaleString() : "N/A";
    return `  ${s.id.slice(0, 8)} | ${s.name.padEnd(30)} | next: ${next}`;
  });
  return { output: `Schedules:\r\n${lines.join("\r\n")}` };
});

reg("add_schedule", (args, app) => {
  const match = args.match(/^"([^"]+)"\s+(.+)$/);
  if (!match) return { output: 'Usage: /add_schedule "task title" <schedule expression>' };
  const [, taskTitle, scheduleExpr] = match;
  const entry = app.scheduler.addFromNaturalLanguage(scheduleExpr, taskTitle);
  if (!entry) return { output: `Could not parse schedule: "${scheduleExpr}"` };
  return { output: `Schedule created: ${entry.name}\r\n  Task: ${taskTitle}` };
});

reg("metrics", (_args, app) => {
  const m = app.metrics.toJSON();
  return {
    output: [
      `Cycles:          ${m.cycleCount}`,
      `Tokens used:     ${m.totalTokensUsed}`,
      `Total cost:      $${(m.totalCostUsd as number).toFixed(4)}`,
      `Tasks completed: ${m.tasksCompleted}`,
      `Tasks failed:    ${m.tasksFailed}`,
      `Errors:          ${m.errorCount}`,
      `Uptime:          ${m.uptimeFormatted}`,
    ].join("\r\n"),
  };
});

reg("budget", (_args, app) => {
  return { output: `Remaining daily budget: $${app.budget.remainingDailyBudget.toFixed(2)}` };
});

reg("integrations", (_args, app) => {
  const names = app.integrationManager.registeredIntegrations;
  const tools = app.integrationManager.getAllToolDefinitions();
  if (names.length === 0) return { output: "No integrations active." };
  return { output: `Active: ${names.join(", ")}\r\nTools: ${tools.length}` };
});

reg("pause", (_args, app) => {
  app.agentLoop.pause();
  return { output: "Agent paused." };
});

reg("resume", (_args, app) => {
  app.agentLoop.resume();
  return { output: "Agent resumed." };
});

reg("wake", (_args, app) => {
  app.agentLoop.wake();
  return { output: "Agent woken." };
});

reg("context", (args, app) => {
  if (!args) {
    const ctx = app.userContext.getAll();
    const entries = Object.entries(ctx);
    if (entries.length === 0) return { output: "No user context learned yet." };
    return { output: entries.map(([k, v]) => `  ${k}: ${v}`).join("\r\n") };
  }
  const parts = args.split(/\s+/);
  if (parts[0] === "set" && parts[1] && parts[2]) {
    app.userContext.set(parts[1], parts.slice(2).join(" "));
    return { output: `Set ${parts[1]} = ${parts.slice(2).join(" ")}` };
  }
  if (parts[0] === "remove" && parts[1]) {
    app.userContext.remove(parts[1]);
    return { output: `Removed: ${parts[1]}` };
  }
  return { output: "Usage: /context [set <key> <value> | remove <key>]" };
});

export function getCommandNames(): string[] {
  return Array.from(commands.keys());
}

// ─── Execute ─────────────────────────────────────────────────

export async function executeWebCommand(input: string, app: Application): Promise<string> {
  const trimmed = input.trim();
  const spaceIdx = trimmed.indexOf(" ");
  const name = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
  const args = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

  const handler = commands.get(name);
  if (!handler) {
    return `Unknown command: /${name}\r\nType /help for available commands.`;
  }

  const result = await handler(args, app);
  return result.output;
}
