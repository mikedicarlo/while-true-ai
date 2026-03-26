import React, { useState } from "react";
import { useApi, apiPost } from "../hooks/useApi.js";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  source: string;
  createdAt: string;
  completedAt: string | null;
}

export function Tasks() {
  const { data, refetch } = useApi<{ tasks: Task[] }>("/api/tasks", 5000);
  const [newTask, setNewTask] = useState("");

  const handleCreate = async () => {
    if (!newTask.trim()) return;
    await apiPost("/api/tasks", { title: newTask.trim() });
    setNewTask("");
    refetch();
  };

  const tasks = data?.tasks ?? [];
  const priorityLabel = (p: number) => ["", "CRIT", "HIGH", "NORM", "LOW", "BG"][p] ?? "?";

  return (
    <div>
      <div className="card">
        <div className="card-title">Create Task</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="Task description..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button className="btn btn-primary" onClick={handleCreate}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Tasks ({tasks.length})</div>
        {tasks.length === 0 ? (
          <div className="empty">No tasks yet</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Priority</th>
                <th>Title</th>
                <th>Source</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.id}>
                  <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  <td>{priorityLabel(t.priority)}</td>
                  <td>{t.title}</td>
                  <td style={{ color: "var(--text-dim)" }}>{t.source}</td>
                  <td style={{ color: "var(--text-dim)" }}>{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
