import { ShortTermMemory } from "./short-term.js";
import { MediumTermMemory } from "./medium-term.js";
import type { MemoryEntry, MemoryEntryType } from "./models.js";

export class MemoryManager {
  constructor(
    private shortTerm: ShortTermMemory,
    private mediumTerm: MediumTermMemory,
  ) {}

  store(
    content: string,
    entryType: MemoryEntryType,
    opts: {
      shortTerm?: boolean;
      mediumTerm?: boolean;
      importance?: number;
      metadata?: Record<string, unknown>;
    } = {},
  ): MemoryEntry | null {
    const { shortTerm = true, mediumTerm = false, importance = 0.5, metadata = {} } = opts;
    let entry: MemoryEntry | null = null;

    if (mediumTerm) {
      entry = this.mediumTerm.store(content, entryType, importance, metadata);
    }

    if (shortTerm && entry) {
      this.shortTerm.add(entry);
    } else if (shortTerm) {
      // Create a transient short-term entry
      entry = {
        id: crypto.randomUUID(),
        tier: "short",
        content,
        entryType,
        importance,
        tokenCount: Math.ceil(content.length / 4),
        metadata,
        createdAt: new Date(),
        expiresAt: null,
      };
      this.shortTerm.add(entry);
    }

    return entry;
  }

  getRecentContext(maxTokens = 4000): string {
    const entries = this.shortTerm.getRecent();
    const parts: string[] = [];
    let tokens = 0;

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (tokens + entry.tokenCount > maxTokens) break;
      parts.unshift(entry.content);
      tokens += entry.tokenCount;
    }

    return parts.join("\n\n");
  }

  search(query: string, limit = 10): MemoryEntry[] {
    return this.mediumTerm.search(query, limit);
  }

  prune(): void {
    this.mediumTerm.prune();
  }
}
