import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { ShortTermMemory } from "../src/memory/short-term.js";
import { MediumTermMemory } from "../src/memory/medium-term.js";
import { MemoryManager } from "../src/memory/manager.js";
import { initializeSchema } from "../src/db/client.js";

describe("ShortTermMemory", () => {
  it("should add and retrieve entries", () => {
    const mem = new ShortTermMemory(5);
    mem.add({
      id: "1",
      tier: "short",
      content: "Hello",
      entryType: "chat",
      importance: 0.5,
      tokenCount: 2,
      metadata: {},
      createdAt: new Date(),
      expiresAt: null,
    });

    expect(mem.size).toBe(1);
    expect(mem.getRecent()[0].content).toBe("Hello");
  });

  it("should evict oldest entries when full", () => {
    const mem = new ShortTermMemory(2);
    for (let i = 0; i < 3; i++) {
      mem.add({
        id: String(i),
        tier: "short",
        content: `Entry ${i}`,
        entryType: "chat",
        importance: 0.5,
        tokenCount: 2,
        metadata: {},
        createdAt: new Date(),
        expiresAt: null,
      });
    }

    expect(mem.size).toBe(2);
    const recent = mem.getRecent();
    expect(recent[0].content).toBe("Entry 1");
    expect(recent[1].content).toBe("Entry 2");
  });

  it("should clear all entries", () => {
    const mem = new ShortTermMemory();
    mem.add({
      id: "1",
      tier: "short",
      content: "test",
      entryType: "chat",
      importance: 0.5,
      tokenCount: 1,
      metadata: {},
      createdAt: new Date(),
      expiresAt: null,
    });
    mem.clear();
    expect(mem.size).toBe(0);
  });
});

describe("MediumTermMemory", () => {
  let db: Database.Database;
  let mem: MediumTermMemory;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    mem = new MediumTermMemory(db, 7);
  });

  afterEach(() => {
    db.close();
  });

  it("should store and retrieve entries", () => {
    mem.store("Test memory content", "observation");
    const results = mem.getRecent(10);
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Test memory content");
    expect(results[0].tier).toBe("medium");
  });

  it("should search entries by content", () => {
    mem.store("The weather is sunny today", "observation");
    mem.store("I need to buy groceries", "observation");

    const results = mem.search("weather");
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("weather");
  });

  it("should set expiry based on TTL", () => {
    const entry = mem.store("Expiring entry", "observation");
    expect(entry.expiresAt).not.toBeNull();
    expect(entry.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("MemoryManager", () => {
  let db: Database.Database;
  let manager: MemoryManager;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSchema(db);
    manager = new MemoryManager(
      new ShortTermMemory(50),
      new MediumTermMemory(db, 7),
    );
  });

  afterEach(() => {
    db.close();
  });

  it("should store to short-term by default", () => {
    manager.store("Short term only", "chat");
    const context = manager.getRecentContext();
    expect(context).toContain("Short term only");
  });

  it("should store to both tiers when requested", () => {
    manager.store("Both tiers", "observation", {
      shortTerm: true,
      mediumTerm: true,
    });
    const context = manager.getRecentContext();
    expect(context).toContain("Both tiers");

    const searched = manager.search("tiers");
    expect(searched).toHaveLength(1);
  });

  it("should respect maxTokens in getRecentContext", () => {
    // Add many entries
    for (let i = 0; i < 20; i++) {
      manager.store(`Entry number ${i} with some content to take up tokens`, "chat");
    }
    const context = manager.getRecentContext(100); // Very small limit
    // Should contain fewer entries than 20
    expect(context.split("\n\n").length).toBeLessThan(20);
  });
});
