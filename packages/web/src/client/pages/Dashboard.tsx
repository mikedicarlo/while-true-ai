import React from "react";
import { useApi } from "../hooks/useApi.js";
import type { AgentState } from "../hooks/useWebSocket.js";

function formatTokens(n: number): string {
  if (n === 0) return "0";
  const k = n / 1000;
  if (k < 1) return `${k.toFixed(1)}k`;
  if (k < 1000) return `${k.toFixed(1)}k`.replace(/\.0k$/, "k");
  return `${k.toLocaleString(undefined, { maximumFractionDigits: 0 })}k`;
}

interface StatusData {
  phase: string;
  cycleNumber: number;
  isPaused: boolean;
  metrics: {
    cycleCount: number;
    totalTokensUsed: number;
    totalCostUsd: number;
    tasksCompleted: number;
    tasksFailed: number;
    errorCount: number;
    uptimeFormatted: string;
  };
}

interface Props {
  agentState: AgentState | null;
}

export function Dashboard({ agentState }: Props) {
  const { data: status } = useApi<StatusData>("/api/status", 3000);
  const metrics = status?.metrics ?? agentState?.metrics as StatusData["metrics"] | undefined;

  return (
    <div>
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Phase</div>
          <div className="metric-value accent">{agentState?.phase ?? status?.phase ?? "..."}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cycle</div>
          <div className="metric-value">{agentState?.cycleNumber ?? status?.cycleNumber ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Uptime</div>
          <div className="metric-value">{metrics?.uptimeFormatted ?? "..."}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total Cost</div>
          <div className="metric-value green">${(metrics?.totalCostUsd ?? 0).toFixed(4)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Tokens Used</div>
          <div className="metric-value">{formatTokens(metrics?.totalTokensUsed ?? 0)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Tasks Done</div>
          <div className="metric-value green">{metrics?.tasksCompleted ?? 0}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Failed</div>
          <div className="metric-value" style={{ color: (metrics?.tasksFailed ?? 0) > 0 ? "var(--red)" : "var(--text-dim)" }}>
            {metrics?.tasksFailed ?? 0}
          </div>
        </div>
        <div className="metric">
          <div className="metric-label">Errors</div>
          <div className="metric-value" style={{ color: (metrics?.errorCount ?? 0) > 0 ? "var(--red)" : "var(--text-dim)" }}>
            {metrics?.errorCount ?? 0}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Controls</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={() => fetch("/api/control/pause", { method: "POST" })}>Pause</button>
          <button className="btn" onClick={() => fetch("/api/control/resume", { method: "POST" })}>Resume</button>
          <button className="btn" onClick={() => fetch("/api/control/wake", { method: "POST" })}>Wake</button>
        </div>
      </div>
    </div>
  );
}
