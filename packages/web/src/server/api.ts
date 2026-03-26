import { Router } from "express";
import type { Application } from "@while-true-ai/core";
import { VERSION } from "@while-true-ai/core";

export function createApiRouter(app: Application): Router {
  const router = Router();

  // ─── Status ─────────────────────────────────────────
  router.get("/api/status", (_req, res) => {
    const state = app.agentLoop.getState();
    const metrics = app.metrics.toJSON();
    res.json({
      version: VERSION,
      phase: state.phase,
      cycleNumber: state.cycleNumber,
      isPaused: state.isPaused,
      currentTaskId: state.currentTaskId,
      startedAt: state.startedAt,
      lastCycleAt: state.lastCycleAt,
      metrics,
    });
  });

  // ─── Control ────────────────────────────────────────
  router.post("/api/control/pause", (_req, res) => {
    app.agentLoop.pause();
    res.json({ ok: true, message: "Agent paused" });
  });

  router.post("/api/control/resume", (_req, res) => {
    app.agentLoop.resume();
    res.json({ ok: true, message: "Agent resumed" });
  });

  router.post("/api/control/wake", (_req, res) => {
    app.agentLoop.wake();
    res.json({ ok: true, message: "Agent woken" });
  });

  router.post("/api/control/stop", async (_req, res) => {
    res.json({ ok: true, message: "Shutting down" });
    await app.shutdown();
    process.exit(0);
  });

  // ─── Tasks ──────────────────────────────────────────
  router.get("/api/tasks", (req, res) => {
    const status = req.query.status as string | undefined;
    if (status) {
      const tasks = app.taskManager.getPending();
      res.json({ tasks });
    } else {
      const tasks = app.taskManager.getRecent(50);
      res.json({ tasks });
    }
  });

  router.post("/api/tasks", (req, res) => {
    const { title, description, priority } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const task = app.taskManager.createTask({ title, description, priority });
    app.agentLoop.wake();
    res.status(201).json({ task });
  });

  router.get("/api/tasks/:id", (req, res) => {
    const task = app.taskManager.getById(req.params.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    res.json({ task });
  });

  // ─── Goals ──────────────────────────────────────────
  router.get("/api/goals", (_req, res) => {
    const goals = app.goalManager.getAllGoals();
    res.json({ goals });
  });

  router.post("/api/goals", async (req, res) => {
    const { title, description, successCriteria, deadline, checkInIntervalMinutes } = req.body;
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const goal = await app.goalManager.createGoal({
      title,
      description,
      successCriteria,
      deadline: deadline ? new Date(deadline) : undefined,
      checkInIntervalMinutes,
    });
    res.status(201).json({ goal });
  });

  router.get("/api/goals/:id", (req, res) => {
    const goal = app.goalManager.getGoal(req.params.id);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    res.json({ goal });
  });

  router.post("/api/goals/:id/pause", (req, res) => {
    const ok = app.goalManager.pauseGoal(req.params.id);
    res.json({ ok });
  });

  router.post("/api/goals/:id/resume", (req, res) => {
    const ok = app.goalManager.resumeGoal(req.params.id);
    res.json({ ok });
  });

  router.post("/api/goals/:id/cancel", (req, res) => {
    const ok = app.goalManager.cancelGoal(req.params.id);
    res.json({ ok });
  });

  // ─── Schedules ──────────────────────────────────────
  router.get("/api/schedules", (_req, res) => {
    const schedules = app.scheduler.getSchedules();
    res.json({ schedules });
  });

  router.post("/api/schedules", (req, res) => {
    const { name, cronExpression, taskTitle, taskDescription, taskPriority } = req.body;
    if (!cronExpression || !taskTitle) {
      res.status(400).json({ error: "cronExpression and taskTitle are required" });
      return;
    }
    const entry = app.scheduler.addSchedule({
      name: name ?? taskTitle,
      cronExpression,
      taskTitle,
      taskDescription,
      taskPriority,
    });
    res.status(201).json({ schedule: entry });
  });

  router.delete("/api/schedules/:id", (req, res) => {
    const ok = app.scheduler.removeSchedule(req.params.id);
    res.json({ ok });
  });

  // ─── Metrics ────────────────────────────────────────
  router.get("/api/metrics", (_req, res) => {
    res.json(app.metrics.toJSON());
  });

  // ─── Budget ─────────────────────────────────────────
  router.get("/api/budget", (_req, res) => {
    res.json({
      remainingDailyBudget: app.budget.remainingDailyBudget,
    });
  });

  // ─── Integrations ──────────────────────────────────
  router.get("/api/integrations", (_req, res) => {
    const names = app.integrationManager.registeredIntegrations;
    const tools = app.integrationManager.getAllToolDefinitions();
    res.json({
      integrations: names,
      totalTools: tools.length,
      tools: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
      })),
      config: app.settings.integrations,
    });
  });

  router.post("/api/integrations/:name/toggle", async (req, res) => {
    const name = req.params.name;
    const { enabled } = req.body;
    const cfg = app.settings.integrations as Record<string, Record<string, unknown>>;

    if (!(name in cfg)) {
      res.status(404).json({ error: `Unknown integration: ${name}` });
      return;
    }

    cfg[name].enabled = enabled;

    // Persist to config file
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const yaml = await import("js-yaml");
      const { getConfigDir } = await import("@while-true-ai/core");
      const configPath = path.join(getConfigDir(), "config.yaml");

      let existing: Record<string, unknown> = {};
      if (fs.existsSync(configPath)) {
        existing = yaml.load(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown> ?? {};
      }

      if (!existing.integrations) existing.integrations = {};
      const intCfg = existing.integrations as Record<string, Record<string, unknown>>;
      if (!intCfg[name]) intCfg[name] = {};
      intCfg[name].enabled = enabled;

      fs.writeFileSync(configPath, yaml.dump(existing));
      res.json({ ok: true, message: `${name} ${enabled ? "enabled" : "disabled"}. Restart to apply.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ─── Integration Credentials ──────────────────────
  router.get("/api/integrations/:name/credentials", async (req, res) => {
    const name = req.params.name;
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const yaml = await import("js-yaml");
      const { getConfigDir } = await import("@while-true-ai/core");
      const credPath = path.join(getConfigDir(), "credentials.yaml");

      let creds: Record<string, unknown> = {};
      if (fs.existsSync(credPath)) {
        creds = yaml.load(fs.readFileSync(credPath, "utf-8")) as Record<string, unknown> ?? {};
      }

      const integrationCreds = (creds.integrations as Record<string, Record<string, string>> | undefined)?.[name] ?? {};

      // Return field names with masked values (show if configured, not the actual value)
      const masked: Record<string, boolean> = {};
      for (const key of Object.keys(integrationCreds)) {
        masked[key] = !!integrationCreds[key];
      }

      // For Gmail/Calendar, also check if the credentials JSON file exists on disk
      if (name === "gmail" || name === "calendar") {
        const settings = app.settings.integrations as unknown as Record<string, Record<string, string>>;
        const credFilePath = settings[name]?.credentialsPath ?? `~/.while-true-ai/gmail_credentials.json`;
        const expanded = credFilePath.startsWith("~/")
          ? credFilePath.replace("~", process.env.HOME ?? "")
          : credFilePath;
        if (fs.existsSync(expanded)) {
          // Read the file to extract client_id for display
          try {
            const credFile = JSON.parse(fs.readFileSync(expanded, "utf-8"));
            const installed = credFile.installed ?? credFile.web ?? {};
            if (installed.client_id) masked.client_id = true;
            if (installed.client_secret) masked.client_secret = true;
          } catch {
            // ignore parse errors
          }
        }
      }

      res.json({ credentials: masked });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/api/integrations/:name/credentials", async (req, res) => {
    const name = req.params.name;

    try {
    const fields = req.body as Record<string, string>;

    if (!fields || Object.keys(fields).length === 0) {
      res.status(400).json({ error: "No credential fields provided" });
      return;
    }
      const fs = await import("node:fs");
      const path = await import("node:path");
      const yaml = await import("js-yaml");
      const { getConfigDir } = await import("@while-true-ai/core");
      const configDir = getConfigDir();

      // Handle Google OAuth client_id + client_secret — build Desktop credentials JSON file
      if ((name === "gmail" || name === "calendar") && fields.client_id && fields.client_secret) {
        const credJson = {
          installed: {
            client_id: fields.client_id.trim(),
            client_secret: fields.client_secret.trim(),
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            redirect_uris: ["http://localhost"],
          },
        };

        // Write the credentials JSON file
        const settings = app.settings.integrations as unknown as Record<string, Record<string, string>>;
        const credFilePath = settings[name]?.credentialsPath ?? `~/.while-true-ai/gmail_credentials.json`;
        const expanded = credFilePath.startsWith("~/")
          ? credFilePath.replace("~", process.env.HOME ?? "")
          : credFilePath;

        const dir = path.dirname(expanded);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(expanded, JSON.stringify(credJson, null, 2), { mode: 0o600 });

        // Save to credentials.yaml
        const credPath = path.join(configDir, "credentials.yaml");
        let creds: Record<string, unknown> = {};
        if (fs.existsSync(credPath)) {
          creds = yaml.load(fs.readFileSync(credPath, "utf-8")) as Record<string, unknown> ?? {};
        }
        if (!creds.integrations) creds.integrations = {};
        const intCreds = creds.integrations as Record<string, Record<string, string>>;
        if (!intCreds[name]) intCreds[name] = {};
        intCreds[name].client_id = fields.client_id.trim();
        intCreds[name].client_secret = fields.client_secret.trim();
        fs.writeFileSync(credPath, yaml.dump(creds), { mode: 0o600 });

        // Delete old token so the OAuth flow runs fresh on restart
        const tokenPath = settings[name]?.tokenPath;
        if (tokenPath) {
          const expandedToken = tokenPath.startsWith("~/")
            ? tokenPath.replace("~", process.env.HOME ?? "")
            : tokenPath;
          if (fs.existsSync(expandedToken)) fs.unlinkSync(expandedToken);
        }

        res.json({ ok: true, message: `Google credentials saved for ${name}. Restart to authorize via browser.` });
        return;
      }

      // Standard key-value credentials
      const credPath = path.join(configDir, "credentials.yaml");

      let creds: Record<string, unknown> = {};
      if (fs.existsSync(credPath)) {
        creds = yaml.load(fs.readFileSync(credPath, "utf-8")) as Record<string, unknown> ?? {};
      }

      if (!creds.integrations) creds.integrations = {};
      const intCreds = creds.integrations as Record<string, Record<string, string>>;
      if (!intCreds[name]) intCreds[name] = {};

      for (const [key, value] of Object.entries(fields)) {
        if (value) {
          intCreds[name][key] = value;
        }
      }

      fs.writeFileSync(credPath, yaml.dump(creds), { mode: 0o600 });
      res.json({ ok: true, message: `Credentials saved for ${name}. Restart to apply.` });
    } catch (err) {
      console.error("Credential save error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  });

  // ─── Chat ──────────────────────────────────────────
  router.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const { ChatInterface } = await import("@while-true-ai/core");
    const chat = new ChatInterface(
      app.llmRouter,
      app.budget,
      app.integrationManager,
      app.memoryManager,
      { userContext: app.userContext.toPromptString(), userContextStore: app.userContext, metrics: app.metrics },
    );

    const response = await chat.sendMessage(message);
    res.json({ response });
  });

  return router;
}
