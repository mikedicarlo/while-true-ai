import React from "react";
import { useApi, apiDelete } from "../hooks/useApi.js";

interface Schedule {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  taskTitle: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
}

export function Schedules() {
  const { data, refetch } = useApi<{ schedules: Schedule[] }>("/api/schedules", 5000);
  const schedules = data?.schedules ?? [];

  const handleRemove = async (id: string) => {
    await apiDelete(`/api/schedules/${id}`);
    refetch();
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">Schedules ({schedules.length})</div>
        {schedules.length === 0 ? (
          <div className="empty">No active schedules. Use the terminal to add one:<br />/add_schedule "Check email" every 30 minutes</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cron</th>
                <th>Task</th>
                <th>Next Run</th>
                <th>Last Run</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td style={{ color: "var(--accent)" }}>{s.cronExpression}</td>
                  <td>{s.taskTitle}</td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : "—"}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString() : "—"}
                  </td>
                  <td>
                    <button className="btn" onClick={() => handleRemove(s.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
