import React, { useState, useEffect } from "react";
import { useApi, apiPost } from "../hooks/useApi.js";

interface ToolInfo {
  name: string;
  description: string;
}

interface IntegrationConfig {
  enabled: boolean;
  [key: string]: unknown;
}

interface IntegrationsData {
  integrations: string[];
  totalTools: number;
  tools: ToolInfo[];
  config: Record<string, IntegrationConfig>;
}

interface CredentialField {
  key: string;
  label: string;
  type: "text" | "password" | "file";
  placeholder?: string;
}

interface IntegrationMeta {
  label: string;
  icon: string;
  description: string;
  approval: boolean;
  setup: string;
  credentialFields: CredentialField[];
}

const meta: Record<string, IntegrationMeta> = {
  gmail: {
    label: "Gmail",
    icon: "\u2709",
    description: "Read, send, search, and manage email",
    approval: false,
    setup: "Requires a Desktop app OAuth client. In Google Cloud Console: APIs & Services > Credentials > Create OAuth Client ID > select 'Desktop app'. Copy the Client ID and Client Secret below.",
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx" },
    ],
  },
  calendar: {
    label: "Google Calendar",
    icon: "\uD83D\uDCC5",
    description: "List, create, update, and delete events",
    approval: false,
    setup: "Uses the same Desktop app OAuth client as Gmail. If Gmail is already configured, just enable Calendar. Otherwise create a Desktop app client in Google Cloud Console.",
    credentialFields: [
      { key: "client_id", label: "Client ID", type: "text", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "client_secret", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx" },
    ],
  },
  tesla: {
    label: "Tesla",
    icon: "\uD83D\uDE97",
    description: "Vehicle control \u2014 lock, climate, charge, trunk",
    approval: true,
    setup: "Enter your Tesla Fleet API access token and optionally a vehicle ID.",
    credentialFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Tesla Fleet API access token" },
      { key: "refreshToken", label: "Refresh Token", type: "password", placeholder: "Optional refresh token" },
      { key: "vehicleId", label: "Vehicle ID", type: "text", placeholder: "Optional, auto-detected if omitted" },
    ],
  },
  robinhood: {
    label: "Robinhood",
    icon: "\uD83D\uDCC8",
    description: "Trade stocks, crypto, and options",
    approval: true,
    setup: "Enter your Robinhood API access token.",
    credentialFields: [
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Robinhood API access token" },
    ],
  },
  schlage: {
    label: "Schlage",
    icon: "\uD83D\uDD10",
    description: "Smart lock control \u2014 lock, unlock, access codes",
    approval: true,
    setup: "Enter your Schlage Home app account credentials (same email/password you use in the Schlage Home app).",
    credentialFields: [
      { key: "username", label: "Email", type: "text", placeholder: "your@email.com" },
      { key: "password", label: "Password", type: "password", placeholder: "Your Schlage Home password" },
    ],
  },
  rest: {
    label: "REST Client",
    icon: "\uD83C\uDF10",
    description: "Make HTTP requests to any API",
    approval: false,
    setup: "No credentials needed. Enabled by default. Optionally set a default auth header for API calls.",
    credentialFields: [
      { key: "defaultAuthHeader", label: "Default Auth Header", type: "password", placeholder: "Optional: Bearer xxx or Basic xxx" },
    ],
  },
};

function CredentialForm({ integrationName, fields }: { integrationName: string; fields: CredentialField[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/integrations/${integrationName}/credentials`)
      .then((r) => r.json())
      .then((data) => {
        if (data.credentials) setConfigured(data.credentials);
      })
      .catch(() => {});
  }, [integrationName]);

  const handleSave = async () => {
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.length > 0),
    );
    if (Object.keys(filled).length === 0) return;

    setSaving(true);
    setMessage(null);
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(
        `/api/integrations/${integrationName}/credentials`,
        filled,
      );
      setMessage(result.message);
      setValues({});
      // Refresh configured state
      const res = await fetch(`/api/integrations/${integrationName}/credentials`);
      const data = await res.json();
      if (data.credentials) setConfigured(data.credentials);
    } catch (err) {
      setMessage(`\u274c ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Credentials
      </div>
      {fields.map((field) => (
        <div key={field.key} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", minWidth: 100 }}>
              {field.label}
            </label>
            {configured[field.key] && !values[field.key] && (
              <span style={{ fontSize: 10, color: "var(--green)", background: "#003322", padding: "1px 6px", borderRadius: 3 }}>
                configured
              </span>
            )}
          </div>
          {field.type === "file" ? (
            <textarea
              className="input"
              placeholder={configured[field.key] ? "Credentials file saved. Paste new JSON to replace." : field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              style={{ fontSize: 11, fontFamily: "monospace", minHeight: 80, resize: "vertical" }}
            />
          ) : (
            <input
              className="input"
              type={field.type}
              placeholder={configured[field.key] ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (saved, enter new value to update)" : field.placeholder}
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              style={{ fontSize: 12 }}
            />
          )}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || Object.values(values).every((v) => !v)}
          style={{ fontSize: 11, padding: "4px 12px" }}
        >
          {saving ? "Saving..." : "Save Credentials"}
        </button>
        {message && (
          <span style={{ fontSize: 11, color: message.startsWith("\u274c") ? "var(--red)" : "var(--green)" }}>{message}</span>
        )}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 6, fontStyle: "italic" }}>
        Credentials are stored in ~/.while-true-ai/credentials.yaml (not in the project repo).
      </div>
    </div>
  );
}

export function Integrations() {
  const { data, loading, refetch } = useApi<IntegrationsData>("/api/integrations", 10000);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const integrations = data?.integrations ?? [];
  const tools = data?.tools ?? [];
  const config = data?.config ?? {};

  // Group tools by integration prefix
  const grouped = new Map<string, ToolInfo[]>();
  for (const tool of tools) {
    const prefix = tool.name.split("_")[0];
    if (!grouped.has(prefix)) grouped.set(prefix, []);
    grouped.get(prefix)!.push(tool);
  }

  const allIntegrations = ["gmail", "calendar", "tesla", "robinhood", "schlage", "rest"];

  const handleToggle = async (name: string, enable: boolean) => {
    setPendingToggle(name);
    setMessage(null);
    try {
      const result = await apiPost<{ ok: boolean; message: string }>(
        `/api/integrations/${name}/toggle`,
        { enabled: enable },
      );
      setMessage(result.message);
      refetch();
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingToggle(null);
    }
  };

  const filteredTools = search
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  if (loading) {
    return <div className="empty">Loading integrations...</div>;
  }

  return (
    <div>
      {/* Message banner */}
      {message && (
        <div style={{
          padding: "6px 12px",
          marginBottom: 12,
          borderRadius: 4,
          background: "#1a2a1a",
          border: "1px solid var(--green)",
          color: "var(--green)",
          fontSize: 12,
        }}>
          {message}
        </div>
      )}

      {/* Summary */}
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-label">Active</div>
          <div className="metric-value accent">{integrations.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Available</div>
          <div className="metric-value">{allIntegrations.length}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Total Tools</div>
          <div className="metric-value green">{data?.totalTools ?? 0}</div>
        </div>
      </div>

      {/* Integration cards */}
      <div className="card">
        <div className="card-title">Integrations</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
          {allIntegrations.map((name) => {
            const info = meta[name] ?? { label: name, icon: "\u2699", description: "", approval: false, setup: "", credentialFields: [] };
            const isActive = integrations.includes(name);
            const isEnabled = config[name]?.enabled ?? false;
            const integrationTools = grouped.get(name) ?? [];
            const isExpanded = expanded === name;
            const isToggling = pendingToggle === name;

            return (
              <div
                key={name}
                style={{
                  background: "var(--bg-primary)",
                  border: `1px solid ${isActive ? "var(--accent-dim)" : isEnabled ? "var(--yellow)" : "var(--border)"}`,
                  borderRadius: 6,
                  padding: 12,
                  opacity: isActive ? 1 : isEnabled ? 0.8 : 0.5,
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1 }}
                    onClick={() => setExpanded(isExpanded ? null : name)}
                  >
                    <span style={{ fontSize: 18 }}>{info.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{info.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {info.approval && (
                      <span style={{
                        fontSize: 9, padding: "2px 5px", borderRadius: 3,
                        background: "#332200", color: "var(--yellow)",
                      }}>
                        APPROVAL
                      </span>
                    )}
                    <button
                      className={`btn ${isEnabled ? "" : "btn-primary"}`}
                      style={{ fontSize: 10, padding: "2px 8px" }}
                      disabled={isToggling}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(name, !isEnabled);
                      }}
                    >
                      {isToggling ? "..." : isEnabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                  {info.description}
                </div>

                {/* Status line */}
                <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
                  {isActive ? (
                    <span style={{ color: "var(--green)" }}>{integrationTools.length} tools active</span>
                  ) : isEnabled ? (
                    <span style={{ color: "var(--yellow)" }}>Enabled in config {"\u2014"} restart to activate</span>
                  ) : (
                    <span>Not enabled</span>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                    {/* Setup instructions */}
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 10, fontStyle: "italic" }}>
                      {info.setup}
                    </div>

                    {/* Credential form */}
                    {info.credentialFields.length > 0 && (
                      <CredentialForm integrationName={name} fields={info.credentialFields} />
                    )}

                    {/* Tool list */}
                    {integrationTools.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          Tools
                        </div>
                        <table className="table" style={{ fontSize: 11 }}>
                          <thead>
                            <tr>
                              <th style={{ padding: "3px 8px" }}>Tool</th>
                              <th style={{ padding: "3px 8px" }}>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {integrationTools.map((t) => (
                              <tr key={t.name}>
                                <td style={{ padding: "3px 8px", color: "var(--accent)", whiteSpace: "nowrap" }}>
                                  {t.name}
                                </td>
                                <td style={{ padding: "3px 8px", color: "var(--text-secondary)" }}>
                                  {t.description}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool search */}
      <div className="card">
        <div className="card-title">Tool Search</div>
        <input
          className="input"
          placeholder="Search tools by name or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {search && (
          filteredTools.length === 0 ? (
            <div className="empty">No tools matching &quot;{search}&quot;</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tool</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredTools.map((t) => (
                  <tr key={t.name}>
                    <td style={{ color: "var(--accent)", whiteSpace: "nowrap" }}>{t.name}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
