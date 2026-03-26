import { z } from "zod";

export const TaskPriority = {
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
  BACKGROUND: 5,
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TaskStatus = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
  "blocked",
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskSource = z.enum([
  "user",
  "scheduled",
  "discovered",
  "decomposed",
  "recurring",
  "goal_checkin",
]);
export type TaskSource = z.infer<typeof TaskSource>;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  source: TaskSource;
  parentId: string | null;
  dueAt: Date | null;
  requiresApproval: boolean;
  blockedBy: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  source?: TaskSource;
  parentId?: string;
  dueAt?: Date;
  requiresApproval?: boolean;
  metadata?: Record<string, unknown>;
}
