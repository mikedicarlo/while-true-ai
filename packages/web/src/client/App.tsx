import React, { useState } from "react";
import { useWebSocket } from "./hooks/useWebSocket.js";
import { useApi } from "./hooks/useApi.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Tasks } from "./pages/Tasks.js";
import { Goals } from "./pages/Goals.js";
import { Schedules } from "./pages/Schedules.js";
import { Integrations } from "./pages/Integrations.js";
import { Activity } from "./pages/Activity.js";
import { Terminal } from "./components/Terminal.js";
import "./styles.css";

type Page = "dashboard" | "tasks" | "goals" | "schedules" | "integrations" | "activity";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const { connected, agentState, events, sendTerminalInput, cancelTerminal, terminalBusy, terminalCommands, setOnTerminalMessage } = useWebSocket();
  const { data: statusData } = useApi<{ version?: string }>("/api/status", 30000);

  const phaseClass = agentState?.phase === "acting" ? "acting"
    : agentState?.phase === "thinking" || agentState?.phase === "deciding" ? "thinking"
    : agentState?.phase === "sleeping" || agentState?.phase === "idle" ? "sleeping"
    : "active";

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="header-title">
          while-true-ai
          {statusData?.version && (
            <span style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8, fontWeight: 400 }}>
              v{statusData.version}
            </span>
          )}
        </div>
        <div className="header-status">
          <div className="status-item">
            <div className={`status-dot ${connected ? phaseClass : "error"}`} />
            <span>{connected ? (agentState?.phase ?? "connecting") : "disconnected"}</span>
          </div>
          <div className="status-item">
            cycle {agentState?.cycleNumber ?? 0}
          </div>
          {agentState?.isPaused && (
            <div className="status-item" style={{ color: "var(--yellow)" }}>PAUSED</div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="nav">
        {(["dashboard", "tasks", "goals", "schedules", "integrations", "activity"] as Page[]).map((p) => (
          <button
            key={p}
            className={`nav-tab ${page === p ? "active" : ""}`}
            onClick={() => setPage(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="main">
        <div className="content">
          {page === "dashboard" && <Dashboard agentState={agentState} />}
          {page === "tasks" && <Tasks />}
          {page === "goals" && <Goals />}
          {page === "schedules" && <Schedules />}
          {page === "integrations" && <Integrations />}
          {page === "activity" && <Activity events={events} />}
        </div>
      </div>

      {/* Terminal panel */}
      <div className="terminal-panel" style={{ height: terminalOpen ? "55vh" : 28 }}>
        <div className="terminal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Terminal</span>
            {terminalBusy && (
              <span style={{ fontSize: 10, color: "var(--yellow)", animation: "pulse 1s infinite" }}>
                processing...
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {terminalBusy && (
              <button
                className="terminal-toggle"
                onClick={cancelTerminal}
                style={{ color: "var(--red)", borderColor: "var(--red)" }}
              >
                Stop
              </button>
            )}
            <button className="terminal-toggle" onClick={() => setTerminalOpen(!terminalOpen)}>
              {terminalOpen ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>
        {terminalOpen && (
          <Terminal sendInput={sendTerminalInput} onCancel={cancelTerminal} onMessage={setOnTerminalMessage} commands={terminalCommands} />
        )}
      </div>
    </div>
  );
}
