import { EventEmitter } from "node:events";

export type AgentEvent =
  | "cycle:started"
  | "cycle:completed"
  | "cycle:error"
  | "task:created"
  | "task:started"
  | "task:completed"
  | "task:failed"
  | "goal:created"
  | "goal:completed"
  | "goal:failed"
  | "agent:state_changed"
  | "agent:sleeping"
  | "agent:woke"
  | "agent:shutdown";

export interface EventPayload {
  event: AgentEvent;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: AgentEvent, data?: Record<string, unknown>): void {
    const payload: EventPayload = {
      event,
      timestamp: new Date(),
      data,
    };
    this.emitter.emit(event, payload);
    this.emitter.emit("*", payload); // Wildcard listener
  }

  on(
    event: AgentEvent | "*",
    listener: (payload: EventPayload) => void,
  ): void {
    this.emitter.on(event, listener);
  }

  off(
    event: AgentEvent | "*",
    listener: (payload: EventPayload) => void,
  ): void {
    this.emitter.off(event, listener);
  }

  once(
    event: AgentEvent | "*",
    listener: (payload: EventPayload) => void,
  ): void {
    this.emitter.once(event, listener);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
