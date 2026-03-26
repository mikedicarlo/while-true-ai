export class AgentMetrics {
  cycleCount = 0;
  totalTokensUsed = 0;
  totalCostUsd = 0;
  errorCount = 0;
  tasksCompleted = 0;
  tasksFailed = 0;
  private startTime = Date.now();

  get uptimeMs(): number {
    return Date.now() - this.startTime;
  }

  get uptimeFormatted(): string {
    const seconds = Math.floor(this.uptimeMs / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }

  recordCycle(): void {
    this.cycleCount++;
  }

  recordTokens(tokens: number, costUsd: number): void {
    this.totalTokensUsed += tokens;
    this.totalCostUsd += costUsd;
  }

  recordError(): void {
    this.errorCount++;
  }

  recordTaskCompleted(): void {
    this.tasksCompleted++;
  }

  recordTaskFailed(): void {
    this.tasksFailed++;
  }

  toJSON(): Record<string, unknown> {
    return {
      cycleCount: this.cycleCount,
      totalTokensUsed: this.totalTokensUsed,
      totalCostUsd: this.totalCostUsd,
      errorCount: this.errorCount,
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      uptimeMs: this.uptimeMs,
      uptimeFormatted: this.uptimeFormatted,
    };
  }
}
