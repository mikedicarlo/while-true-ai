/**
 * Parse natural language schedule expressions into cron expressions or interval seconds.
 *
 * Supported formats:
 *   "every 30 minutes"
 *   "every 2 hours"
 *   "hourly"
 *   "daily at 9am"
 *   "daily at 9:30am"
 *   "every monday at 10am"
 *   "weekdays at 8:30am"
 *   "every monday, wednesday, friday at 9am"
 */

export interface ParsedSchedule {
  type: "cron" | "interval";
  value: string; // cron expression or interval in seconds
  description: string;
}

const DAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function parseTime(timeStr: string): { hour: number; minute: number } | null {
  // "9am", "9:30am", "14:00", "2pm", "2:30pm"
  const match12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2] ?? "0", 10);
    const period = match12[3].toLowerCase();
    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hour: parseInt(match24[1], 10),
      minute: parseInt(match24[2], 10),
    };
  }

  return null;
}

export function parseSchedule(input: string): ParsedSchedule | null {
  const text = input.trim().toLowerCase();

  // "every N minutes"
  const minuteMatch = text.match(/^every\s+(\d+)\s+minutes?$/);
  if (minuteMatch) {
    const minutes = parseInt(minuteMatch[1], 10);
    return {
      type: "cron",
      value: `*/${minutes} * * * *`,
      description: `Every ${minutes} minute${minutes === 1 ? "" : "s"}`,
    };
  }

  // "every N hours"
  const hourMatch = text.match(/^every\s+(\d+)\s+hours?$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return {
      type: "cron",
      value: `0 */${hours} * * *`,
      description: `Every ${hours} hour${hours === 1 ? "" : "s"}`,
    };
  }

  // "hourly"
  if (text === "hourly") {
    return { type: "cron", value: "0 * * * *", description: "Every hour" };
  }

  // "daily at TIME"
  const dailyMatch = text.match(/^daily\s+at\s+(.+)$/);
  if (dailyMatch) {
    const time = parseTime(dailyMatch[1]);
    if (time) {
      return {
        type: "cron",
        value: `${time.minute} ${time.hour} * * *`,
        description: `Daily at ${dailyMatch[1]}`,
      };
    }
  }

  // "weekdays at TIME"
  const weekdayMatch = text.match(/^weekdays\s+at\s+(.+)$/);
  if (weekdayMatch) {
    const time = parseTime(weekdayMatch[1]);
    if (time) {
      return {
        type: "cron",
        value: `${time.minute} ${time.hour} * * 1-5`,
        description: `Weekdays at ${weekdayMatch[1]}`,
      };
    }
  }

  // "every DAY at TIME" or "every DAY, DAY, DAY at TIME"
  const dayMatch = text.match(/^every\s+(.+?)\s+at\s+(.+)$/);
  if (dayMatch) {
    const dayStr = dayMatch[1];
    const time = parseTime(dayMatch[2]);
    if (time) {
      const days = dayStr.split(/[,\s]+and\s+|[,\s]+/).map((d) => d.trim());
      const dayNums = days
        .map((d) => DAY_MAP[d])
        .filter((n) => n !== undefined);

      if (dayNums.length > 0) {
        return {
          type: "cron",
          value: `${time.minute} ${time.hour} * * ${dayNums.join(",")}`,
          description: `Every ${days.join(", ")} at ${dayMatch[2]}`,
        };
      }
    }
  }

  // "every N seconds" (for interval-based)
  const secondMatch = text.match(/^every\s+(\d+)\s+seconds?$/);
  if (secondMatch) {
    const seconds = parseInt(secondMatch[1], 10);
    return {
      type: "interval",
      value: String(seconds),
      description: `Every ${seconds} second${seconds === 1 ? "" : "s"}`,
    };
  }

  return null;
}
