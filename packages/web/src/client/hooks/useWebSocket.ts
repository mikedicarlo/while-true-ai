import { useState, useEffect, useRef, useCallback } from "react";

export interface AgentState {
  phase: string;
  cycleNumber: number;
  isPaused: boolean;
  metrics?: Record<string, unknown>;
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [events, setEvents] = useState<Array<{ event: string; data?: Record<string, unknown>; time: Date }>>([]);
  const [terminalBusy, setTerminalBusy] = useState(false);
  const [terminalCommands, setTerminalCommands] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "agent:state") {
        setAgentState(msg.data);
      } else if (msg.type === "agent:event") {
        setEvents((prev) => [
          { event: msg.event, data: msg.data, time: new Date() },
          ...prev.slice(0, 50),
        ]);
      } else if (msg.type === "terminal:output" || msg.type === "terminal:prompt") {
        if (onMessageRef.current) {
          onMessageRef.current(msg.type === "terminal:output" ? msg.text : "");
        }
      } else if (msg.type === "terminal:busy") {
        setTerminalBusy(msg.busy);
      } else if (msg.type === "terminal:commands") {
        setTerminalCommands(msg.commands);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendTerminalInput = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "terminal:input", text }));
    }
  }, []);

  const cancelTerminal = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "terminal:cancel" }));
    }
  }, []);

  const setOnTerminalMessage = useCallback((cb: (text: string) => void) => {
    onMessageRef.current = cb;
  }, []);

  return { connected, agentState, events, sendTerminalInput, cancelTerminal, terminalBusy, terminalCommands, setOnTerminalMessage };
}
