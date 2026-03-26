import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { UserContext } from "../src/user/context.js";

describe("UserContext", () => {
  let tmpDir: string;
  let ctx: UserContext;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wta-test-"));
    ctx = new UserContext(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should set and get values", () => {
    ctx.set("name", "Mike");
    expect(ctx.get("name")).toBe("Mike");
  });

  it("should persist to disk", () => {
    ctx.set("key", "value");
    // Create new instance from same dir
    const ctx2 = new UserContext(tmpDir);
    expect(ctx2.get("key")).toBe("value");
  });

  it("should remove values", () => {
    ctx.set("temp", "data");
    expect(ctx.remove("temp")).toBe(true);
    expect(ctx.get("temp")).toBeUndefined();
    expect(ctx.remove("nonexistent")).toBe(false);
  });

  it("should get all values", () => {
    ctx.set("a", "1");
    ctx.set("b", "2");
    const all = ctx.getAll();
    expect(all).toEqual({ a: "1", b: "2" });
  });

  it("should generate prompt string", () => {
    ctx.set("name", "Mike");
    ctx.set("timezone", "US/Pacific");
    const prompt = ctx.toPromptString();
    expect(prompt).toContain("name: Mike");
    expect(prompt).toContain("timezone: US/Pacific");
  });

  it("should return empty string for empty context", () => {
    expect(ctx.toPromptString()).toBe("");
  });

  it("should learn name from conversation", () => {
    ctx.learnFromConversation("My name is Alice", "Nice to meet you!");
    expect(ctx.get("name")).toBe("Alice");
  });

  it("should learn timezone from conversation", () => {
    ctx.learnFromConversation(
      "My timezone is US/Eastern",
      "Got it!",
    );
    expect(ctx.get("timezone")?.toLowerCase()).toBe("us/eastern");
  });

  it("should not overwrite existing name", () => {
    ctx.set("name", "Mike");
    ctx.learnFromConversation("My name is Bob", "Hi Bob!");
    expect(ctx.get("name")).toBe("Mike");
  });

  it("should track size", () => {
    expect(ctx.size).toBe(0);
    ctx.set("a", "1");
    ctx.set("b", "2");
    expect(ctx.size).toBe(2);
  });
});
