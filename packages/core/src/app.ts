import path from "node:path";
import { VERSION } from "./version.js";
import type { AppSettings } from "./config/settings.js";
import { loadConfig, ensureDataDir } from "./config/loader.js";
import { createDatabase, initializeSchema } from "./db/client.js";
import { initLogger, getLogger } from "./observability/logger.js";
import { EventBus } from "./observability/events.js";
import { AgentMetrics } from "./observability/metrics.js";
import { AuditTrail } from "./observability/audit.js";
import { LLMRouter } from "./llm/router.js";
import { TokenBudgetManager } from "./llm/budget.js";
import { TaskStore } from "./tasks/store.js";
import { TaskManager } from "./tasks/manager.js";
import { IntegrationManager } from "./integrations/manager.js";
import { Guardrails } from "./safety/guardrails.js";
import { KillSwitch } from "./safety/kill-switch.js";
import { AgentLoop } from "./agent/loop.js";
import { Scheduler } from "./scheduler/scheduler.js";
import { ShortTermMemory } from "./memory/short-term.js";
import { MediumTermMemory } from "./memory/medium-term.js";
import { MemoryManager } from "./memory/manager.js";
import { GoalStore } from "./goals/store.js";
import { GoalManager } from "./goals/manager.js";
import { UserContext } from "./user/context.js";
import type Database from "better-sqlite3";

const log = getLogger("app");

export class Application {
  readonly settings: AppSettings;
  readonly eventBus: EventBus;
  readonly metrics: AgentMetrics;
  readonly llmRouter: LLMRouter;
  readonly budget: TokenBudgetManager;
  readonly taskManager: TaskManager;
  readonly integrationManager: IntegrationManager;
  readonly guardrails: Guardrails;
  readonly killSwitch: KillSwitch;
  readonly agentLoop: AgentLoop;
  readonly scheduler: Scheduler;
  readonly memoryManager: MemoryManager;
  readonly goalManager: GoalManager;
  readonly userContext: UserContext;
  readonly auditTrail: AuditTrail;

  private sqlite: Database.Database;

  constructor(configPath?: string) {
    // Load config
    this.settings = loadConfig(configPath);
    ensureDataDir(this.settings.dataDir);

    // Init logger
    initLogger({
      consoleLevel: this.settings.logging.consoleLevel,
      fileLevel: this.settings.logging.fileLevel,
      filePath: path.join(this.settings.dataDir, "logs", "agent.log"),
    });

    log.info({ appName: this.settings.appName }, "Initializing application");

    // Database
    const dbPath = path.join(this.settings.dataDir, "agent.db");
    const { sqlite } = createDatabase(dbPath);
    this.sqlite = sqlite;
    initializeSchema(sqlite);

    // Observability
    this.eventBus = new EventBus();
    this.metrics = new AgentMetrics();
    this.auditTrail = new AuditTrail(sqlite);

    // LLM
    this.llmRouter = new LLMRouter(this.settings.providers);
    this.budget = new TokenBudgetManager(this.settings.budget);

    // Tasks
    const taskStore = new TaskStore(sqlite);
    this.taskManager = new TaskManager(taskStore, this.eventBus);

    // Memory
    const shortTerm = new ShortTermMemory(this.settings.memory.shortTermMaxEntries);
    const mediumTerm = new MediumTermMemory(sqlite, this.settings.memory.mediumTermTtlDays);
    this.memoryManager = new MemoryManager(shortTerm, mediumTerm);

    // User Context
    this.userContext = new UserContext(this.settings.dataDir);

    // Integrations
    this.integrationManager = new IntegrationManager();

    // Safety
    this.guardrails = new Guardrails(this.settings.safety);
    this.killSwitch = new KillSwitch(
      path.join(this.settings.dataDir, ".kill_switch"),
    );

    // Scheduler
    this.scheduler = new Scheduler(this.taskManager, this.eventBus);

    // Goals
    const goalStore = new GoalStore(sqlite);
    this.goalManager = new GoalManager(
      goalStore,
      this.taskManager,
      this.scheduler,
      this.llmRouter,
      this.eventBus,
    );

    // Agent Loop
    this.agentLoop = new AgentLoop({
      taskManager: this.taskManager,
      integrationManager: this.integrationManager,
      llmRouter: this.llmRouter,
      budget: this.budget,
      guardrails: this.guardrails,
      killSwitch: this.killSwitch,
      eventBus: this.eventBus,
      metrics: this.metrics,
      settings: this.settings,
    });

    // Wire scheduler wake to agent loop
    this.scheduler.setWakeCallback(() => this.agentLoop.wake());

    log.info({ version: VERSION }, "Application initialized");
  }

  registerIntegration(integration: import("./integrations/base.js").BaseIntegration): void {
    this.integrationManager.register(integration);
  }

  async start(): Promise<void> {
    await this.integrationManager.initializeAll();
    this.killSwitch.reset();
    log.info("Application started");
  }

  async shutdown(): Promise<void> {
    log.info("Shutting down...");
    this.agentLoop.stop();
    this.scheduler.stopAll();
    await this.integrationManager.shutdownAll();
    this.sqlite.close();
    this.eventBus.removeAllListeners();
    log.info("Shutdown complete");
  }
}
