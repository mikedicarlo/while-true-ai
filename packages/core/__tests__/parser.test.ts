import { describe, it, expect } from "vitest";
import { parseSchedule } from "../src/scheduler/parser.js";

describe("Schedule Parser", () => {
  it("should parse 'every N minutes'", () => {
    const result = parseSchedule("every 30 minutes");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("cron");
    expect(result!.value).toBe("*/30 * * * *");
  });

  it("should parse 'every 1 minute'", () => {
    const result = parseSchedule("every 1 minute");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("*/1 * * * *");
  });

  it("should parse 'every N hours'", () => {
    const result = parseSchedule("every 2 hours");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 */2 * * *");
  });

  it("should parse 'hourly'", () => {
    const result = parseSchedule("hourly");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 * * * *");
  });

  it("should parse 'daily at 9am'", () => {
    const result = parseSchedule("daily at 9am");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 9 * * *");
  });

  it("should parse 'daily at 9:30am'", () => {
    const result = parseSchedule("daily at 9:30am");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("30 9 * * *");
  });

  it("should parse 'daily at 2pm'", () => {
    const result = parseSchedule("daily at 2pm");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 14 * * *");
  });

  it("should parse 'weekdays at 8:30am'", () => {
    const result = parseSchedule("weekdays at 8:30am");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("30 8 * * 1-5");
  });

  it("should parse 'every monday at 10am'", () => {
    const result = parseSchedule("every monday at 10am");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 10 * * 1");
  });

  it("should parse 'every monday, wednesday, friday at 9am'", () => {
    const result = parseSchedule("every monday, wednesday, friday at 9am");
    expect(result).not.toBeNull();
    expect(result!.value).toBe("0 9 * * 1,3,5");
  });

  it("should parse 'every N seconds'", () => {
    const result = parseSchedule("every 30 seconds");
    expect(result).not.toBeNull();
    expect(result!.type).toBe("interval");
    expect(result!.value).toBe("30");
  });

  it("should return null for unparseable input", () => {
    expect(parseSchedule("sometime next week")).toBeNull();
    expect(parseSchedule("")).toBeNull();
    expect(parseSchedule("gibberish")).toBeNull();
  });
});
