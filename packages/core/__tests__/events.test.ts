import { describe, it, expect, vi } from "vitest";
import { EventBus } from "../src/observability/events.js";

describe("EventBus", () => {
  it("should emit and receive events", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("task:created", handler);
    bus.emit("task:created", { taskId: "123" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({
      event: "task:created",
      data: { taskId: "123" },
    });
  });

  it("should support wildcard listener", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("*", handler);
    bus.emit("task:created");
    bus.emit("cycle:started");

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("should remove listener with off()", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("task:created", handler);
    bus.off("task:created", handler);
    bus.emit("task:created");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should include timestamp in payload", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("cycle:started", handler);
    bus.emit("cycle:started");

    expect(handler.mock.calls[0][0].timestamp).toBeInstanceOf(Date);
  });

  it("should fire once listener only once", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.once("task:completed", handler);
    bus.emit("task:completed");
    bus.emit("task:completed");

    expect(handler).toHaveBeenCalledOnce();
  });
});
