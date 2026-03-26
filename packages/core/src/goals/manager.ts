import type { GoalStore } from "./store.js";
import type { Goal, CreateGoalInput, GoalStatus } from "./models.js";
import type { TaskManager } from "../tasks/manager.js";
import type { Scheduler } from "../scheduler/scheduler.js";
import type { LLMRouter } from "../llm/router.js";
import type { EventBus } from "../observability/events.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("goals:manager");

export class GoalManager {
  constructor(
    private store: GoalStore,
    private taskManager: TaskManager,
    private scheduler: Scheduler,
    private llmRouter: LLMRouter,
    private eventBus: EventBus,
  ) {}

  async createGoal(input: CreateGoalInput): Promise<Goal> {
    const goal = this.store.create(input);

    // Activate immediately
    this.store.updateStatus(goal.id, "active");
    goal.status = "active";

    this.eventBus.emit("goal:created", {
      goalId: goal.id,
      title: goal.title,
    });

    // Decompose into initial tasks using LLM
    await this.decomposeGoal(goal);

    // Set up recurring check-in
    const cronExpr =
      goal.checkInCron ?? this.intervalToCron(goal.checkInIntervalMinutes);

    const schedule = this.scheduler.addSchedule({
      name: `Goal check-in: ${goal.title}`,
      description: `Periodic check-in for goal "${goal.title}"`,
      cronExpression: cronExpr,
      taskTitle: `[Goal Check-in] ${goal.title}`,
      taskDescription: `Evaluate progress on goal: ${goal.title}\nGoal ID: ${goal.id}\nSuccess criteria: ${goal.successCriteria.join(", ")}`,
    });

    this.store.updateScheduleId(goal.id, schedule.id);
    goal.scheduleId = schedule.id;

    log.info(
      { goalId: goal.id, scheduleId: schedule.id },
      "Goal created with check-in schedule",
    );

    return goal;
  }

  getGoal(id: string): Goal | null {
    return this.store.getById(id);
  }

  getAllGoals(): Goal[] {
    return this.store.getAll();
  }

  getActiveGoals(): Goal[] {
    return this.store.getActive();
  }

  pauseGoal(id: string): boolean {
    const goal = this.store.getById(id);
    if (!goal || goal.status !== "active") return false;

    this.store.updateStatus(id, "paused");
    if (goal.scheduleId) {
      this.scheduler.removeSchedule(goal.scheduleId);
    }
    log.info({ goalId: id }, "Goal paused");
    return true;
  }

  resumeGoal(id: string): boolean {
    const goal = this.store.getById(id);
    if (!goal || goal.status !== "paused") return false;

    this.store.updateStatus(id, "active");

    // Re-create check-in schedule
    const cronExpr =
      goal.checkInCron ?? this.intervalToCron(goal.checkInIntervalMinutes);
    const schedule = this.scheduler.addSchedule({
      name: `Goal check-in: ${goal.title}`,
      cronExpression: cronExpr,
      taskTitle: `[Goal Check-in] ${goal.title}`,
      taskDescription: `Goal ID: ${goal.id}`,
    });
    this.store.updateScheduleId(id, schedule.id);

    log.info({ goalId: id }, "Goal resumed");
    return true;
  }

  cancelGoal(id: string): boolean {
    const goal = this.store.getById(id);
    if (!goal) return false;

    this.store.updateStatus(id, "cancelled");
    if (goal.scheduleId) {
      this.scheduler.removeSchedule(goal.scheduleId);
    }
    log.info({ goalId: id }, "Goal cancelled");
    return true;
  }

  completeGoal(id: string): boolean {
    const goal = this.store.getById(id);
    if (!goal) return false;

    this.store.updateStatus(id, "completed");
    if (goal.scheduleId) {
      this.scheduler.removeSchedule(goal.scheduleId);
    }
    this.eventBus.emit("goal:completed", { goalId: id, title: goal.title });
    log.info({ goalId: id }, "Goal completed");
    return true;
  }

  async checkIn(goalId: string): Promise<string> {
    const goal = this.store.getById(goalId);
    if (!goal) return "Goal not found";

    if (!this.llmRouter.hasAdapter("reflecting")) {
      // Fallback without LLM
      const entry = {
        timestamp: new Date().toISOString(),
        step: "Check-in (no LLM)",
        status: "active",
      };
      this.store.addProgressEntry(goalId, entry);
      return "Check-in recorded (LLM not available for evaluation)";
    }

    // Ask LLM to evaluate progress
    const response = await this.llmRouter.complete("reflecting", {
      messages: [
        {
          role: "system",
          content: `You are evaluating progress on a goal. Respond with a JSON object:
{
  "status": "active" | "completed" | "failed",
  "reasoning": "brief explanation",
  "nextTasks": ["task 1", "task 2"]
}`,
        },
        {
          role: "user",
          content: `Goal: ${goal.title}
Description: ${goal.description ?? "N/A"}
Success criteria: ${goal.successCriteria.join("; ") || "N/A"}
Current step: ${goal.currentStep ?? "Just started"}
Progress log: ${goal.progressLog.map((p) => `${p.timestamp}: ${p.step} (${p.status})`).join("\n") || "None"}
Deadline: ${goal.deadline?.toISOString() ?? "None"}

Evaluate the current progress and determine if the goal is completed, failed, or needs more work. If more work is needed, suggest 1-2 concrete next tasks.`,
        },
      ],
    });

    let evaluation = {
      status: "active" as string,
      reasoning: response.content ?? "No evaluation",
      nextTasks: [] as string[],
    };

    try {
      if (response.content) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          evaluation = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Use raw response as reasoning
    }

    // Record progress
    this.store.addProgressEntry(goalId, {
      timestamp: new Date().toISOString(),
      step: evaluation.reasoning,
      status: evaluation.status,
      reasoning: evaluation.reasoning,
    });

    // Handle status changes
    if (evaluation.status === "completed") {
      this.completeGoal(goalId);
    } else if (evaluation.status === "failed") {
      this.store.updateStatus(goalId, "failed");
      if (goal.scheduleId) this.scheduler.removeSchedule(goal.scheduleId);
      this.eventBus.emit("goal:failed", { goalId, title: goal.title });
    }

    // Create next tasks
    for (const taskTitle of evaluation.nextTasks) {
      const task = this.taskManager.createTask({
        title: taskTitle,
        source: "decomposed",
        metadata: { goalId },
      });
      this.store.addTaskId(goalId, task.id);
    }

    return evaluation.reasoning;
  }

  private async decomposeGoal(goal: Goal): Promise<void> {
    if (!this.llmRouter.hasAdapter("thinking")) {
      // Create a single generic task without LLM
      const task = this.taskManager.createTask({
        title: `Work on: ${goal.title}`,
        description: goal.description ?? undefined,
        source: "decomposed",
        metadata: { goalId: goal.id },
      });
      this.store.addTaskId(goal.id, task.id);
      return;
    }

    try {
      const response = await this.llmRouter.complete("thinking", {
        messages: [
          {
            role: "system",
            content: `You are planning tasks for a goal. Respond with a JSON array of 1-2 concrete, actionable task titles. Each task should be completable in a single action cycle. Example: ["Check current email inbox for unread messages", "Draft a reply to the most urgent email"]`,
          },
          {
            role: "user",
            content: `Goal: ${goal.title}\nDescription: ${goal.description ?? "N/A"}\nSuccess criteria: ${goal.successCriteria.join("; ") || "N/A"}`,
          },
        ],
      });

      let tasks: string[] = [];
      try {
        if (response.content) {
          const jsonMatch = response.content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            tasks = JSON.parse(jsonMatch[0]);
          }
        }
      } catch {
        tasks = [`Start working on: ${goal.title}`];
      }

      for (const taskTitle of tasks.slice(0, 3)) {
        const task = this.taskManager.createTask({
          title: taskTitle,
          source: "decomposed",
          metadata: { goalId: goal.id },
        });
        this.store.addTaskId(goal.id, task.id);
      }

      this.store.addProgressEntry(goal.id, {
        timestamp: new Date().toISOString(),
        step: `Decomposed into ${tasks.length} initial tasks`,
        status: "active",
      });
    } catch (error) {
      log.error({ goalId: goal.id, error }, "Failed to decompose goal");
      // Fallback task
      const task = this.taskManager.createTask({
        title: `Work on: ${goal.title}`,
        source: "decomposed",
        metadata: { goalId: goal.id },
      });
      this.store.addTaskId(goal.id, task.id);
    }
  }

  private intervalToCron(minutes: number): string {
    if (minutes < 60) return `*/${minutes} * * * *`;
    const hours = Math.floor(minutes / 60);
    return `0 */${hours} * * *`;
  }
}
