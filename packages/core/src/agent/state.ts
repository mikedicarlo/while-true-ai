export type AgentPhase =
  | "idle"
  | "thinking"
  | "deciding"
  | "acting"
  | "reflecting"
  | "sleeping"
  | "stopped";

export interface AgentState {
  phase: AgentPhase;
  cycleNumber: number;
  currentTaskId: string | null;
  currentTaskTitle: string | null;
  isPaused: boolean;
  lastCycleAt: Date | null;
  startedAt: Date;
}

export function createInitialState(): AgentState {
  return {
    phase: "idle",
    cycleNumber: 0,
    currentTaskId: null,
    currentTaskTitle: null,
    isPaused: false,
    lastCycleAt: null,
    startedAt: new Date(),
  };
}
