import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { MemoryEntry, MemoryEntryType } from "./models.js";
import { getLogger } from "../observability/logger.js";

const log = getLogger("memory:medium");

export class MediumTermMemory {
  constructor(
    private db: Database.Database,
    private ttlDays: number = 7,
  ) {}

  store(content: string, entryType: MemoryEntryType, importance = 0.5, metadata: Record<string, unknown> = {}): MemoryEntry {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlDays * 86_400_000);

    const entry: MemoryEntry = {
      id: randomUUID(),
      tier: "medium",
      content,
      entryType,
      importance,
      tokenCount: Math.ceil(content.length / 4), // Rough estimate
      metadata,
      createdAt: now,
      expiresAt,
    };

    const stmt = this.db.prepare(`
      INSERT INTO memory_entries (id, tier, content, entry_type, importance, token_count, metadata, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.tier,
      entry.content,
      entry.entryType,
      entry.importance,
      entry.tokenCount,
      JSON.stringify(entry.metadata),
      entry.createdAt.toISOString(),
      entry.expiresAt?.toISOString() ?? null,
    );

    return entry;
  }

  search(query: string, limit = 10): MemoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_entries
      WHERE tier = 'medium'
        AND (expires_at IS NULL OR expires_at > ?)
        AND content LIKE ?
      ORDER BY importance DESC, created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(
      new Date().toISOString(),
      `%${query}%`,
      limit,
    ) as Record<string, unknown>[];

    return rows.map((r) => this.rowToEntry(r));
  }

  getRecent(limit = 20): MemoryEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memory_entries
      WHERE tier = 'medium'
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
      LIMIT ?
    `);

    const rows = stmt.all(new Date().toISOString(), limit) as Record<string, unknown>[];
    return rows.map((r) => this.rowToEntry(r));
  }

  prune(): number {
    const result = this.db.prepare(`
      DELETE FROM memory_entries
      WHERE tier = 'medium' AND expires_at IS NOT NULL AND expires_at < ?
    `).run(new Date().toISOString());

    if (result.changes > 0) {
      log.info({ pruned: result.changes }, "Pruned expired memory entries");
    }
    return result.changes;
  }

  private rowToEntry(row: Record<string, unknown>): MemoryEntry {
    return {
      id: row.id as string,
      tier: "medium",
      content: row.content as string,
      entryType: row.entry_type as MemoryEntryType,
      importance: (row.importance as number) ?? 0.5,
      tokenCount: (row.token_count as number) ?? 0,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
      createdAt: new Date(row.created_at as string),
      expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    };
  }
}
