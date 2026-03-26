import { describe, it, expect } from "vitest";
import {
  isCommand,
  parseCommand,
} from "../src/commands/registry.js";

describe("Command parsing", () => {
  it("should detect slash commands", () => {
    expect(isCommand("/help")).toBe(true);
    expect(isCommand("/add_task something")).toBe(true);
    expect(isCommand("hello")).toBe(false);
    expect(isCommand("")).toBe(false);
  });

  it("should parse command name and args", () => {
    expect(parseCommand("/help")).toEqual({ name: "help", args: "" });
    expect(parseCommand("/add_task Buy groceries")).toEqual({
      name: "add_task",
      args: "Buy groceries",
    });
    expect(parseCommand("/status")).toEqual({ name: "status", args: "" });
  });

  it("should handle extra whitespace", () => {
    expect(parseCommand("  /help  ")).toEqual({ name: "help", args: "" });
    expect(parseCommand("/add_task   lots of space  ")).toEqual({
      name: "add_task",
      args: "lots of space",
    });
  });
});
