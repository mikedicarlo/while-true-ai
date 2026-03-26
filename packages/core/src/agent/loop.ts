import type { AgentState } from "./state.js";
import { createInitialState } from "./state.js";
import {
  thinkPhase,
  decidePhase,
  actPhase,
  reflectPhase,
} from "./phases.js";
import type { TaskManager } from "../tasks/manager.js";
import type { IntegrationManager } from "../integrations/manager.js";
import type { LLMRouter } from "../llm/router.js";
import type { TokenBudgetManager } from "../llm/budget.js";
import type { Guardrails } from "../safety/guardrails.js";
import type { KillSwitch } from "../safety/kill-switch.js";
import type { EventBus } from "../observability/events.js";
import type { AgentMetrics } from "../observability/metrics.js";
import type { AppSettings } from "../config/settings.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("agent:loop");

export interface AgentLoopDeps {
  taskManager: TaskManager;
  integrationManager: IntegrationManager;
  llmRouter: LLMRouter;
  budget: TokenBudgetManager;
  guardrails: Guardrails;
  killSwitch: KillSwitch;
  eventBus: EventBus;
  metrics: AgentMetrics;
  settings: AppSettings;
}

export class AgentLoop {
  private state: AgentState;
  private running = false;
  private wakeResolver: (() => void) | null = null;
  private currentSleep = 0;

  constructor(private deps: AgentLoopDeps) {
    this.state = createInitialState();
    this.currentSleep = deps.settings.loop.baseIdleSleep;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.state.phase = "idle";

    log.info("Agent loop started");
    this.deps.eventBus.emit("agent:state_changed", { phase: "idle" });

    while (this.running) {
      // Check kill switch
      if (this.deps.killSwitch.check()) {
        log.info("Kill switch triggered, stopping");
        break;
      }

      // Check if paused
      if (this.state.isPaused) {
        await this.sleep(1000);
        continue;
      }

      try {
        await this.runCycle();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error({ error: msg }, "Cycle error");
        this.deps.metrics.recordError();
        this.deps.eventBus.emit("cycle:error", { error: msg });
        await this.sleep(5000); // Brief pause on error
      }
    }

    this.state.phase = "stopped";
    this.deps.eventBus.emit("agent:shutdown");
    log.info("Agent loop stopped");
  }

  private async runCycle(): Promise<void> {
    this.state.cycleNumber++;
    this.deps.metrics.recordCycle();
    this.deps.guardrails.resetCycle();
    this.deps.eventBus.emit("cycle:started", {
      cycle: this.state.cycleNumber,
    });

    // Think
    this.state.phase = "thinking";
    this.deps.eventBus.emit("agent:state_changed", { phase: "thinking" });
    const context = await thinkPhase({
      taskManager: this.deps.taskManager,
      integrationManager: this.deps.integrationManager,
    });

    // Decide
    this.state.phase = "deciding";
    this.deps.eventBus.emit("agent:state_changed", { phase: "deciding" });
    const plan = await decidePhase(context, {
      taskManager: this.deps.taskManager,
      llmRouter: this.deps.llmRouter,
    });

    // Act
    this.state.phase = "acting";
    this.deps.eventBus.emit("agent:state_changed", { phase: "acting" });
    const result = await actPhase(plan, {
      taskManager: this.deps.taskManager,
      integrationManager: this.deps.integrationManager,
      llmRouter: this.deps.llmRouter,
      budget: this.deps.budget,
      guardrails: this.deps.guardrails,
      metrics: this.deps.metrics,
    });

    // Reflect
    this.state.phase = "reflecting";
    this.deps.eventBus.emit("agent:state_changed", { phase: "reflecting" });
    await reflectPhase(result, {
      eventBus: this.deps.eventBus,
    });

    this.state.lastCycleAt = new Date();
    this.deps.eventBus.emit("cycle:completed", {
      cycle: this.state.cycleNumber,
      hadWork: !plan.isIdle,
    });

    // Adaptive sleep
    if (plan.isIdle) {
      this.state.phase = "sleeping";
      this.deps.eventBus.emit("agent:sleeping", {
        duration: this.currentSleep,
      });
      await this.sleep(this.currentSleep * 1000);
      // Exponential backoff for idle
      this.currentSleep = Math.min(
        this.currentSleep * this.deps.settings.loop.idleGrowthFactor,
        this.deps.settings.loop.maxSleepSeconds,
      );
    } else {
      // Reset sleep after doing work
      this.currentSleep = this.deps.settings.loop.minSleepSeconds;
      await this.sleep(this.deps.settings.loop.minSleepSeconds * 1000);
    }
  }

  stop(): void {
    this.running = false;
    this.wake();
  }

  pause(): void {
    this.state.isPaused = true;
    log.info("Agent paused");
  }

  resume(): void {
    this.state.isPaused = false;
    this.wake();
    log.info("Agent resumed");
  }

  wake(): void {
    if (this.wakeResolver) {
      this.wakeResolver();
      this.wakeResolver = null;
    }
    this.currentSleep = this.deps.settings.loop.minSleepSeconds;
    this.deps.eventBus.emit("agent:woke");
  }

  getState(): Readonly<AgentState> {
    return { ...this.state };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wakeResolver = resolve;
      setTimeout(() => {
        this.wakeResolver = null;
        resolve();
      }, ms);
    });
  }
}
