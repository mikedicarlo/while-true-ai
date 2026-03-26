import type { MemoryEntry } from "./models.js";

export class ShortTermMemory {
  private entries: MemoryEntry[] = [];

  constructor(private maxEntries: number = 50) {}

  add(entry: MemoryEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getRecent(count?: number): MemoryEntry[] {
    const n = count ?? this.entries.length;
    return this.entries.slice(-n);
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}
