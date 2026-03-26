import { useState, useEffect, useCallback } from "react";

export function useApi<T>(path: string, pollInterval?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    fetchData();
    if (pollInterval) {
      const id = setInterval(fetchData, pollInterval);
      return () => clearInterval(id);
    }
  }, [fetchData, pollInterval]);

  return { data, error, loading, refetch: fetchData };
}

export async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function apiDelete(path: string): Promise<void> {
  await fetch(path, { method: "DELETE" });
}
