import React, { useState } from "react";
import { useApi, apiPost } from "../hooks/useApi.js";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  status: string;
  deadline: string | null;
  currentStep: string | null;
  taskIds: string[];
  progressLog: Array<{ timestamp: string; step: string; status: string }>;
  createdAt: string;
}

export function Goals() {
  const { data, refetch } = useApi<{ goals: Goal[] }>("/api/goals", 5000);
  const [newGoal, setNewGoal] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newGoal.trim()) return;
    await apiPost("/api/goals", { title: newGoal.trim() });
    setNewGoal("");
    refetch();
  };

  const handleAction = async (id: string, action: string) => {
    await apiPost(`/api/goals/${id}/${action}`, {});
    refetch();
  };

  const goals = data?.goals ?? [];

  return (
    <div>
      <div className="card">
        <div className="card-title">Create Goal</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Goal description..."
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button className="btn btn-primary" onClick={handleCreate}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Goals ({goals.length})</div>
        {goals.length === 0 ? (
          <div className="empty">No goals yet</div>
        ) : (
          goals.map((g) => (
            <div key={g.id} style={{ borderBottom: "1px solid var(--border)", padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <span className={`badge ${g.status}`}>{g.status}</span>
                  {" "}
                  <span
                    style={{ cursor: "pointer" }}
                    onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                  >
                    {g.title}
                  </span>
                  {g.deadline && (
                    <span style={{ color: "var(--text-dim)", marginLeft: 8, fontSize: 12 }}>
                      due: {new Date(g.deadline).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {g.status === "active" && (
                    <button className="btn" onClick={() => handleAction(g.id, "pause")}>Pause</button>
                  )}
                  {g.status === "paused" && (
                    <button className="btn" onClick={() => handleAction(g.id, "resume")}>Resume</button>
                  )}
                  {(g.status === "active" || g.status === "paused") && (
                    <button className="btn" onClick={() => handleAction(g.id, "cancel")}>Cancel</button>
                  )}
                </div>
              </div>

              {expanded === g.id && (
                <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
                  {g.currentStep && (
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ color: "var(--text-secondary)" }}>Current step: </span>
                      {g.currentStep}
                    </div>
                  )}
                  <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    Tasks: {g.taskIds.length} | Created: {new Date(g.createdAt).toLocaleString()}
                  </div>
                  {g.progressLog.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color: "var(--text-secondary)", fontSize: 12, marginBottom: 4 }}>Progress:</div>
                      {g.progressLog.map((p, i) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}>
                          {new Date(p.timestamp).toLocaleTimeString()} — {p.step}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
