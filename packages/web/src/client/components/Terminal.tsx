import React, { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface Props {
  sendInput: (text: string) => void;
  onCancel: () => void;
  onMessage: (cb: (text: string) => void) => void;
  commands?: string[];
}

export function Terminal({ sendInput, onCancel, onMessage, commands = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const lineBuffer = useRef("");
  const cursorPos = useRef(0);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const savedLine = useRef("");
  const commandsRef = useRef<string[]>(commands);

  // Keep commands ref in sync
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0a0a1a",
        foreground: "#e0e0e0",
        cursor: "#00d4ff",
        cursorAccent: "#0a0a1a",
        selectionBackground: "#2a2a5a",
        black: "#0a0a1a",
        red: "#ff5252",
        green: "#00e676",
        yellow: "#ffd740",
        blue: "#448aff",
        magenta: "#b388ff",
        cyan: "#00d4ff",
        white: "#e0e0e0",
      },
      fontFamily: "'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace",
      fontSize: 12,
      fontWeight: "300",
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "bar",
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    termRef.current = term;
    fitRef.current = fit;

    // Show prompt
    term.write("\x1b[36m>\x1b[0m ");

    // Redraw the line from cursor position forward
    const redrawFromCursor = () => {
      const tail = lineBuffer.current.slice(cursorPos.current);
      term.write(tail + " ");
      const moveBack = tail.length + 1;
      if (moveBack > 0) term.write(`\x1b[${moveBack}D`);
    };

    // Replace entire line content
    const replaceLine = (newText: string) => {
      if (cursorPos.current > 0) {
        term.write(`\x1b[${cursorPos.current}D`);
      }
      term.write("\x1b[K");
      lineBuffer.current = newText;
      cursorPos.current = newText.length;
      term.write(newText);
    };

    // Handle keyboard input
    term.onData((data) => {
      const code = data.charCodeAt(0);

      if (code === 3) {
        // Ctrl+C
        lineBuffer.current = "";
        cursorPos.current = 0;
        historyIndex.current = -1;
        onCancel();
        return;
      }

      // ─── Tab completion ─────────────────────────
      if (code === 9) {
        const line = lineBuffer.current;
        if (!line.startsWith("/")) return;

        const partial = line.slice(1); // remove leading /
        const matches = commandsRef.current.filter((c) => c.startsWith(partial));

        if (matches.length === 1) {
          // Exact single match — complete it
          const completed = "/" + matches[0] + " ";
          replaceLine(completed);
        } else if (matches.length > 1) {
          // Multiple matches — find common prefix and show options
          const commonPrefix = matches.reduce((prefix, cmd) => {
            let i = 0;
            while (i < prefix.length && i < cmd.length && prefix[i] === cmd[i]) i++;
            return prefix.slice(0, i);
          });

          if (commonPrefix.length > partial.length) {
            // Extend to common prefix
            replaceLine("/" + commonPrefix);
          } else {
            // Show all matches
            term.write("\r\n");
            term.write(
              matches.map((m) => `\x1b[36m/${m}\x1b[0m`).join("  "),
            );
            term.write("\r\n");
            term.write("\x1b[36m>\x1b[0m ");
            term.write(lineBuffer.current);
            // Cursor is at end after rewrite; adjust if needed
            const moveBack = lineBuffer.current.length - cursorPos.current;
            if (moveBack > 0) term.write(`\x1b[${moveBack}D`);
          }
        }
        return;
      }

      // ─── Arrow keys ─────────────────────────────
      if (data === "\x1b[A") {
        // Up arrow — history
        if (history.current.length === 0) return;
        if (historyIndex.current === -1) {
          savedLine.current = lineBuffer.current;
          historyIndex.current = history.current.length - 1;
        } else if (historyIndex.current > 0) {
          historyIndex.current--;
        } else {
          return;
        }
        replaceLine(history.current[historyIndex.current]);
        return;
      }

      if (data === "\x1b[B") {
        // Down arrow — history
        if (historyIndex.current === -1) return;
        if (historyIndex.current < history.current.length - 1) {
          historyIndex.current++;
          replaceLine(history.current[historyIndex.current]);
        } else {
          historyIndex.current = -1;
          replaceLine(savedLine.current);
        }
        return;
      }

      if (data === "\x1b[D") {
        // Left arrow
        if (cursorPos.current > 0) {
          cursorPos.current--;
          term.write("\x1b[D");
        }
        return;
      }

      if (data === "\x1b[C") {
        // Right arrow
        if (cursorPos.current < lineBuffer.current.length) {
          cursorPos.current++;
          term.write("\x1b[C");
        }
        return;
      }

      // Home
      if (code === 1 || data === "\x1b[H") {
        if (cursorPos.current > 0) {
          term.write(`\x1b[${cursorPos.current}D`);
          cursorPos.current = 0;
        }
        return;
      }

      // End
      if (code === 5 || data === "\x1b[F") {
        const move = lineBuffer.current.length - cursorPos.current;
        if (move > 0) {
          term.write(`\x1b[${move}C`);
          cursorPos.current = lineBuffer.current.length;
        }
        return;
      }

      // Ignore other escape sequences
      if (data.startsWith("\x1b")) return;

      if (code === 13) {
        // Enter
        term.write("\r\n");
        const line = lineBuffer.current;
        if (line.trim()) {
          if (history.current.length === 0 || history.current[history.current.length - 1] !== line) {
            history.current.push(line);
            if (history.current.length > 100) history.current.shift();
          }
          sendInput(line);
        }
        lineBuffer.current = "";
        cursorPos.current = 0;
        historyIndex.current = -1;
        savedLine.current = "";
      } else if (code === 127) {
        // Backspace
        if (cursorPos.current > 0) {
          lineBuffer.current =
            lineBuffer.current.slice(0, cursorPos.current - 1) +
            lineBuffer.current.slice(cursorPos.current);
          cursorPos.current--;
          term.write("\x1b[D");
          redrawFromCursor();
        }
      } else if (code >= 32) {
        // Printable
        lineBuffer.current =
          lineBuffer.current.slice(0, cursorPos.current) +
          data +
          lineBuffer.current.slice(cursorPos.current);
        cursorPos.current += data.length;

        if (cursorPos.current === lineBuffer.current.length) {
          term.write(data);
        } else {
          term.write(data);
          redrawFromCursor();
        }
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(containerRef.current);

    // Receive messages from WebSocket
    onMessage((text: string) => {
      if (text) {
        term.write(text);
      }
      term.write("\x1b[36m>\x1b[0m ");
    });

    return () => {
      resizeObserver.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="terminal-body"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
