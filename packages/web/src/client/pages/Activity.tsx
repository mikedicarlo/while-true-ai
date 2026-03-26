import React from "react";

interface Props {
  events: Array<{ event: string; data?: Record<string, unknown>; time: Date }>;
}

export function Activity({ events }: Props) {
  return (
    <div>
      <div className="card">
        <div className="card-title">Activity Feed ({events.length} events)</div>
        {events.length === 0 ? (
          <div className="empty">No activity yet. Events will appear here as the agent works.</div>
        ) : (
          events.map((e, i) => (
            <div key={i} className="activity-item">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: eventColor(e.event), fontWeight: 500 }}>{e.event}</span>
                <span className="activity-time">{e.time.toLocaleTimeString()}</span>
              </div>
              {e.data && Object.keys(e.data).length > 0 && (
                <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 2 }}>
                  {formatData(e.data)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function eventColor(event: string): string {
  if (event.includes("error") || event.includes("failed")) return "var(--red)";
  if (event.includes("completed")) return "var(--green)";
  if (event.includes("started") || event.includes("created")) return "var(--accent)";
  if (event.includes("sleeping") || event.includes("woke")) return "var(--yellow)";
  return "var(--text-primary)";
}

function formatData(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" | ");
}
