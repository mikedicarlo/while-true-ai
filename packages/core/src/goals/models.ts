import { z } from "zod";

export const GoalStatus = z.enum([
  "pending",
  "active",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);
export type GoalStatus = z.infer<typeof GoalStatus>;

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  successCriteria: string[];
  status: GoalStatus;
  deadline: Date | null;
  checkInIntervalMinutes: number;
  checkInCron: string | null;
  scheduleId: string | null;
  progressLog: ProgressEntry[];
  currentStep: string | null;
  taskIds: string[];
  createdAt: Date;
  completedAt: Date | null;
}

export interface ProgressEntry {
  timestamp: string;
  step: string;
  status: string;
  reasoning?: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  successCriteria?: string[];
  deadline?: Date;
  checkInIntervalMinutes?: number;
  checkInCron?: string;
}
