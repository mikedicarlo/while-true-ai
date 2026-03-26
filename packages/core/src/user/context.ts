import fs from "node:fs";
import path from "node:path";
import { getLogger } from "../observability/logger.js";

const log = getLogger("user:context");

export class UserContext {
  private data: Record<string, string> = {};
  private filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "user_context.json");
    this.load();
  }

  get(key: string): string | undefined {
    return this.data[key];
  }

  set(key: string, value: string): void {
    this.data[key] = value;
    this.save();
    log.debug({ key }, "User context updated");
  }

  remove(key: string): boolean {
    if (!(key in this.data)) return false;
    delete this.data[key];
    this.save();
    return true;
  }

  getAll(): Record<string, string> {
    return { ...this.data };
  }

  /** Build a prompt-friendly string of user context */
  toPromptString(): string {
    const entries = Object.entries(this.data);
    if (entries.length === 0) return "";
    return entries.map(([k, v]) => `- ${k}: ${v}`).join("\n");
  }

  /** Extract facts from a conversation turn and store them */
  learnFromConversation(userMessage: string, assistantResponse: string): void {
    // Simple heuristic extraction — no LLM needed for basic facts
    const lower = userMessage.toLowerCase();

    // Name detection
    const nameMatch = lower.match(
      /(?:my name is|i'm|i am|call me)\s+([a-z]+)/i,
    );
    if (nameMatch && !this.data.name) {
      this.set("name", nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1));
    }

    // Timezone detection
    const tzMatch = lower.match(
      /(?:i'm in|i live in|my timezone is|my time zone is)\s+([a-z/_ ]+)/i,
    );
    if (tzMatch) {
      this.set("timezone", tzMatch[1].trim());
    }

    // Location detection
    const locationMatch = lower.match(
      /(?:i live in|i'm in|i'm from|based in)\s+([a-z, ]+)/i,
    );
    if (locationMatch && !this.data.location) {
      const loc = locationMatch[1].trim();
      // Avoid matching timezone strings
      if (!loc.includes("/") && loc.length < 50) {
        this.set("location", loc);
      }
    }
  }

  get size(): number {
    return Object.keys(this.data).length;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, "utf-8");
        this.data = JSON.parse(content);
        log.debug({ entries: Object.keys(this.data).length }, "User context loaded");
      }
    } catch (error) {
      log.warn({ error }, "Failed to load user context, starting fresh");
      this.data = {};
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      log.error({ error }, "Failed to save user context");
    }
  }
}
