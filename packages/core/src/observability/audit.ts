import type Database from "better-sqlite3";

export interface AuditEntry {
  timestamp: string;
  cycleNumber: number;
  actionType: string;
  integration: string | null;
  params: string | null;
  reasoning: string | null;
  outcome: string | null;
  success: boolean;
  tokensUsed: number;
}

export class AuditTrail {
  constructor(private db: Database.Database) {}

  log(entry: Omit<AuditEntry, "timestamp">): void {
    const stmt = this.db.prepare(`
      INSERT INTO audit_log (timestamp, cycle_number, action_type, integration, params, reasoning, outcome, success, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      new Date().toISOString(),
      entry.cycleNumber,
      entry.actionType,
      entry.integration,
      entry.params,
      entry.reasoning,
      entry.outcome,
      entry.success ? 1 : 0,
      entry.tokensUsed,
    );
  }

  getRecent(limit = 50): AuditEntry[] {
    const stmt = this.db.prepare(
      `SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?`,
    );
    return stmt.all(limit) as AuditEntry[];
  }
}
