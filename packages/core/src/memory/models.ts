export type MemoryTier = "short" | "medium" | "long";
export type MemoryEntryType = "cycle_result" | "task_outcome" | "observation" | "fact" | "chat";

export interface MemoryEntry {
  id: string;
  tier: MemoryTier;
  content: string;
  entryType: MemoryEntryType;
  importance: number;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date | null;
}
