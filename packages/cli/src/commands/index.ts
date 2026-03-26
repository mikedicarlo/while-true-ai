import { registerCommand, getAllCommands } from "./registry.js";
import type { Application } from "@while-true-ai/core";

// /help
registerCommand("help", "Show available commands", () => {
  const cmds = getAllCommands();
  const lines = cmds.map((c) => `  /${c.name.padEnd(18)} ${c.description}`);
  return {
    output: `Available commands:\n${lines.join("\n")}`,
    handled: true,
  };
});

// /status
registerCommand("status", "Show agent status", (_args, app) => {
  const state = app.agentLoop.getState();
  const metrics = app.metrics.toJSON();
  const lines = [
    `Phase:    ${state.phase}`,
    `Cycle:    ${state.cycleNumber}`,
    `Paused:   ${state.isPaused}`,
    `Uptime:   ${metrics.uptimeFormatted}`,
    `Tokens:   ${metrics.totalTokensUsed}`,
    `Cost:     $${(metrics.totalCostUsd as number).toFixed(4)}`,
    `Tasks:    ${metrics.tasksCompleted} completed, ${metrics.tasksFailed} failed`,
    `Errors:   ${metrics.errorCount}`,
  ];
  return { output: lines.join("\n"), handled: true };
});

// /tasks
registerCommand("tasks", "List recent tasks", (_args, app) => {
  const tasks = app.taskManager.getRecent(15);
  if (tasks.length === 0) {
    return { output: "No tasks.", handled: true };
  }
  const lines = tasks.map((t) => {
    const status = t.status.padEnd(11);
    const priority = `P${t.priority}`;
    return `  [${status}] ${priority} ${t.title}`;
  });
  return { output: `Recent tasks:\n${lines.join("\n")}`, handled: true };
});

// /add_task
registerCommand("add_task", "Create a new task", (args, app) => {
  if (!args) {
    return { output: "Usage: /add_task <description>", handled: true };
  }
  const task = app.taskManager.createTask({ title: args });
  app.agentLoop.wake();
  return {
    output: `Task created: ${task.title} (${task.id.slice(0, 8)})`,
    handled: true,
  };
});

// /pause
registerCommand("pause", "Pause the agent loop", (_args, app) => {
  app.agentLoop.pause();
  return { output: "Agent paused.", handled: true };
});

// /resume
registerCommand("resume", "Resume the agent loop", (_args, app) => {
  app.agentLoop.resume();
  return { output: "Agent resumed.", handled: true };
});

// /wake
registerCommand("wake", "Wake agent from sleep", (_args, app) => {
  app.agentLoop.wake();
  return { output: "Agent woken.", handled: true };
});

// /metrics
registerCommand("metrics", "Show agent metrics", (_args, app) => {
  const m = app.metrics.toJSON();
  const lines = [
    `Cycles:          ${m.cycleCount}`,
    `Tokens used:     ${m.totalTokensUsed}`,
    `Total cost:      $${(m.totalCostUsd as number).toFixed(4)}`,
    `Tasks completed: ${m.tasksCompleted}`,
    `Tasks failed:    ${m.tasksFailed}`,
    `Errors:          ${m.errorCount}`,
    `Uptime:          ${m.uptimeFormatted}`,
  ];
  return { output: lines.join("\n"), handled: true };
});

// /integrations
registerCommand("integrations", "List active integrations", (_args, app) => {
  const names = app.integrationManager.registeredIntegrations;
  if (names.length === 0) {
    return { output: "No integrations active.", handled: true };
  }
  const tools = app.integrationManager.getAllToolDefinitions();
  return {
    output: `Active integrations: ${names.join(", ")}\nTotal tools: ${tools.length}`,
    handled: true,
  };
});

// /budget
registerCommand("budget", "Show remaining budget", (_args, app) => {
  const remaining = app.budget.remainingDailyBudget;
  return {
    output: `Remaining daily budget: $${remaining.toFixed(2)}`,
    handled: true,
  };
});

// /memory
registerCommand("memory", "Search memory", (args, app) => {
  if (!args) {
    return { output: "Usage: /memory <search query>", handled: true };
  }
  const results = app.memoryManager.search(args);
  if (results.length === 0) {
    return { output: "No memory entries found.", handled: true };
  }
  const lines = results.map(
    (r) => `  [${r.entryType}] ${r.content.slice(0, 100)}...`,
  );
  return { output: `Memory results:\n${lines.join("\n")}`, handled: true };
});

// /clear_tasks
registerCommand("clear_tasks", "Clear completed tasks", (args, app) => {
  const force = args === "--force";
  const count = app.taskManager.clearAll(force);
  return {
    output: force ? "All tasks cleared." : `Cleared ${count} completed tasks.`,
    handled: true,
  };
});

// /schedules
registerCommand("schedules", "List active schedules", (_args, app) => {
  const schedules = app.scheduler.getSchedules();
  if (schedules.length === 0) {
    return { output: "No active schedules.", handled: true };
  }
  const lines = schedules.map((s) => {
    const next = s.nextRunAt ? s.nextRunAt.toLocaleString() : "N/A";
    return `  ${s.id.slice(0, 8)} | ${s.name.padEnd(30)} | next: ${next}`;
  });
  return { output: `Active schedules:\n${lines.join("\n")}`, handled: true };
});

// /add_schedule
registerCommand("add_schedule", "Add a recurring schedule", (args, app) => {
  // Format: /add_schedule "task description" every 30 minutes
  // or:     /add_schedule "Check email" daily at 9am
  const match = args.match(/^"([^"]+)"\s+(.+)$/);
  if (!match) {
    return {
      output: 'Usage: /add_schedule "task title" <schedule>\nExamples:\n  /add_schedule "Check email" every 30 minutes\n  /add_schedule "Morning summary" daily at 9am\n  /add_schedule "Standup prep" weekdays at 8:30am',
      handled: true,
    };
  }

  const [, taskTitle, scheduleExpr] = match;
  const entry = app.scheduler.addFromNaturalLanguage(scheduleExpr, taskTitle);
  if (!entry) {
    return {
      output: `Could not parse schedule: "${scheduleExpr}"\nTry: every N minutes, daily at TIME, weekdays at TIME, every monday at TIME`,
      handled: true,
    };
  }

  return {
    output: `Schedule created: ${entry.name}\n  Task: ${taskTitle}\n  Next run: ${entry.nextRunAt?.toLocaleString() ?? "N/A"}`,
    handled: true,
  };
});

// /remove_schedule
registerCommand("remove_schedule", "Remove a schedule", (args, app) => {
  if (!args) {
    return { output: "Usage: /remove_schedule <id>", handled: true };
  }
  // Allow partial ID matching
  const schedules = app.scheduler.getSchedules();
  const match = schedules.find((s) => s.id.startsWith(args));
  if (!match) {
    return { output: `Schedule not found: ${args}`, handled: true };
  }
  app.scheduler.removeSchedule(match.id);
  return { output: `Removed schedule: ${match.name}`, handled: true };
});

// /run_schedule
registerCommand("run_schedule", "Run a schedule immediately", (args, app) => {
  if (!args) {
    return { output: "Usage: /run_schedule <id>", handled: true };
  }
  const schedules = app.scheduler.getSchedules();
  const match = schedules.find((s) => s.id.startsWith(args));
  if (!match) {
    return { output: `Schedule not found: ${args}`, handled: true };
  }
  app.scheduler.runNow(match.id);
  return { output: `Running schedule: ${match.name}`, handled: true };
});

// /goals
registerCommand("goals", "List all goals", (_args, app) => {
  const goals = app.goalManager.getAllGoals();
  if (goals.length === 0) {
    return { output: "No goals.", handled: true };
  }
  const lines = goals.map((g) => {
    const status = g.status.padEnd(10);
    const deadline = g.deadline ? ` (due: ${g.deadline.toLocaleDateString()})` : "";
    return `  [${status}] ${g.title}${deadline}  ${g.id.slice(0, 8)}`;
  });
  return { output: `Goals:\n${lines.join("\n")}`, handled: true };
});

// /add_goal
registerCommand("add_goal", "Create a new goal", async (args, app) => {
  if (!args) {
    return {
      output: 'Usage: /add_goal <title>\nExample: /add_goal "Reduce unread emails to zero by end of week"',
      handled: true,
    };
  }
  const title = args.replace(/^"(.*)"$/, "$1");
  const goal = await app.goalManager.createGoal({ title });
  return {
    output: `Goal created: ${goal.title} (${goal.id.slice(0, 8)})\nStatus: ${goal.status}\nTasks created: ${goal.taskIds.length}`,
    handled: true,
  };
});

// /goal
registerCommand("goal", "Manage a goal (show|pause|resume|cancel)", async (args, app) => {
  const parts = args.split(/\s+/);
  const action = parts[0];
  const idPrefix = parts[1];

  if (!action || !idPrefix) {
    return {
      output: "Usage: /goal <show|pause|resume|cancel> <id>",
      handled: true,
    };
  }

  const goals = app.goalManager.getAllGoals();
  const goal = goals.find((g) => g.id.startsWith(idPrefix));
  if (!goal) {
    return { output: `Goal not found: ${idPrefix}`, handled: true };
  }

  switch (action) {
    case "show": {
      const lines = [
        `Title:    ${goal.title}`,
        `Status:   ${goal.status}`,
        `Created:  ${goal.createdAt.toLocaleString()}`,
        goal.deadline ? `Deadline: ${goal.deadline.toLocaleString()}` : null,
        goal.currentStep ? `Step:     ${goal.currentStep}` : null,
        `Tasks:    ${goal.taskIds.length}`,
        `Check-in: every ${goal.checkInIntervalMinutes} minutes`,
        "",
        "Progress:",
        ...goal.progressLog.map(
          (p) => `  ${p.timestamp}: ${p.step}`,
        ),
      ].filter(Boolean);
      return { output: lines.join("\n"), handled: true };
    }
    case "pause":
      app.goalManager.pauseGoal(goal.id);
      return { output: `Goal paused: ${goal.title}`, handled: true };
    case "resume":
      app.goalManager.resumeGoal(goal.id);
      return { output: `Goal resumed: ${goal.title}`, handled: true };
    case "cancel":
      app.goalManager.cancelGoal(goal.id);
      return { output: `Goal cancelled: ${goal.title}`, handled: true };
    default:
      return { output: `Unknown action: ${action}. Use show, pause, resume, or cancel.`, handled: true };
  }
});

// /context
registerCommand("context", "Manage learned user preferences", (args, app) => {
  const parts = args.split(/\s+/);
  const action = parts[0];

  if (!action) {
    const ctx = app.userContext.getAll();
    const entries = Object.entries(ctx);
    if (entries.length === 0) {
      return { output: "No user context learned yet.", handled: true };
    }
    const lines = entries.map(([k, v]) => `  ${k}: ${v}`);
    return { output: `User context:\n${lines.join("\n")}`, handled: true };
  }

  if (action === "set") {
    const key = parts[1];
    const value = parts.slice(2).join(" ");
    if (!key || !value) {
      return { output: "Usage: /context set <key> <value>", handled: true };
    }
    app.userContext.set(key, value);
    return { output: `Set ${key} = ${value}`, handled: true };
  }

  if (action === "remove") {
    const key = parts[1];
    if (!key) {
      return { output: "Usage: /context remove <key>", handled: true };
    }
    if (app.userContext.remove(key)) {
      return { output: `Removed: ${key}`, handled: true };
    }
    return { output: `Key not found: ${key}`, handled: true };
  }

  return { output: "Usage: /context [set <key> <value> | remove <key>]", handled: true };
});

export { executeCommand, isCommand } from "./registry.js";
