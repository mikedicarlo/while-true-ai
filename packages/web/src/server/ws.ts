import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import type { Application, ChatInterface } from "@while-true-ai/core";
import { ChatInterface as ChatInterfaceClass } from "@while-true-ai/core";
import { executeWebCommand, getCommandNames } from "./commands.js";

export type ClientMessage =
  | { type: "terminal:input"; text: string }
  | { type: "terminal:resize"; cols: number; rows: number }
  | { type: "terminal:cancel" };

export type ServerMessage =
  | { type: "terminal:output"; text: string }
  | { type: "terminal:prompt" }
  | { type: "terminal:busy"; busy: boolean }
  | { type: "terminal:commands"; commands: string[] }
  | { type: "agent:state"; data: Record<string, unknown> }
  | { type: "agent:event"; event: string; data?: Record<string, unknown> };

// ─── Onboarding questions ─────────────────────────────
interface OnboardingQuestion {
  key: string;
  prompt: string;
  example: string;
  optional: boolean;
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  { key: "name", prompt: "What's your name?", example: "Mike", optional: false },
  { key: "location", prompt: "Where are you located?", example: "Austin, TX", optional: true },
  { key: "timezone", prompt: "What timezone are you in?", example: "US/Central", optional: true },
  { key: "occupation", prompt: "What do you do?", example: "Software Engineer", optional: true },
];

export function createWebSocketServer(
  server: Server,
  app: Application,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  // Broadcast agent state to all connected clients
  const broadcastState = () => {
    const state = app.agentLoop.getState();
    const metrics = app.metrics.toJSON();
    const msg: ServerMessage = {
      type: "agent:state",
      data: { ...state, metrics },
    };
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  // Forward agent events to all clients
  app.eventBus.on("*", (payload) => {
    const msg: ServerMessage = {
      type: "agent:event",
      event: payload.event,
      data: payload.data,
    };
    const msgStr = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msgStr);
      }
    }
  });

  // Periodic state broadcast
  const stateInterval = setInterval(broadcastState, 2000);

  wss.on("connection", (ws) => {
    // Send initial state
    broadcastState();

    // Create a chat interface for this connection
    const chat = new ChatInterfaceClass(
      app.llmRouter,
      app.budget,
      app.integrationManager,
      app.memoryManager,
      { userContext: app.userContext.toPromptString(), userContextStore: app.userContext, metrics: app.metrics },
    );

    // Track in-flight request so it can be cancelled
    let currentAbort: AbortController | null = null;
    let isBusy = false;

    // Onboarding state
    let onboardingActive = false;
    let onboardingStep = 0;

    const send = (msg: ServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    };

    const setBusy = (busy: boolean) => {
      isBusy = busy;
      send({ type: "terminal:busy", busy });
    };

    const showPrompt = () => {
      send({ type: "terminal:prompt" });
    };

    const write = (text: string) => {
      send({ type: "terminal:output", text });
    };

    // Send available commands for tab completion
    send({ type: "terminal:commands", commands: getCommandNames() });

    // ─── Onboarding flow ──────────────────────────
    const needsOnboarding = !app.userContext.get("_onboarding_complete") && app.userContext.size === 0;

    if (needsOnboarding) {
      onboardingActive = true;
      write("\x1b[36m╭──────────────────────────────────────────────────╮\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  \x1b[1mWelcome to while-true-ai!\x1b[0m                       \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m                                                  \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  Let me get to know you so I can help better.    \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  Press Enter to skip any question.               \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m╰──────────────────────────────────────────────────╯\x1b[0m\r\n");
      write("\r\n");
      askOnboardingQuestion();
    } else {
      write("Welcome to while-true-ai! Type a message or /help for commands.\r\n");
      showPrompt();
    }

    function askOnboardingQuestion() {
      if (onboardingStep >= ONBOARDING_QUESTIONS.length) {
        finishOnboarding();
        return;
      }
      const q = ONBOARDING_QUESTIONS[onboardingStep];
      write(`\x1b[33m${q.prompt}\x1b[0m \x1b[2m(e.g. ${q.example})\x1b[0m\r\n`);
      showPrompt();
    }

    function handleOnboardingAnswer(input: string) {
      const q = ONBOARDING_QUESTIONS[onboardingStep];
      const answer = input.trim();

      if (answer) {
        app.userContext.set(q.key, answer);
        write(`\x1b[32m✓\x1b[0m ${q.key}: ${answer}\r\n`);
      } else if (!q.optional) {
        write("\x1b[2mSkipped\x1b[0m\r\n");
      } else {
        write("\x1b[2mSkipped\x1b[0m\r\n");
      }

      onboardingStep++;
      write("\r\n");
      askOnboardingQuestion();
    }

    function finishOnboarding() {
      onboardingActive = false;
      app.userContext.set("_onboarding_complete", "true");

      write("\r\n");
      write("\x1b[36m╭──────────────────────────────────────────────────╮\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  \x1b[1m\x1b[32mYou're all set!\x1b[0m                                 \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m                                                  \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  I'll auto-learn more about you as we chat.      \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m                                                  \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m  Useful commands:                                \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m    \x1b[1m/context\x1b[0m              View what I know        \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m    \x1b[1m/context set key val\x1b[0m  Add context manually    \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m    \x1b[1m/context remove key\x1b[0m   Remove a context entry  \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m│\x1b[0m    \x1b[1m/help\x1b[0m                 All available commands  \x1b[36m│\x1b[0m\r\n");
      write("\x1b[36m╰──────────────────────────────────────────────────╯\x1b[0m\r\n");
      write("\r\n");
      showPrompt();
    }

    // ─── Message handler ──────────────────────────
    ws.on("message", async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      // ─── Cancel ─────────────────────────────────
      if (msg.type === "terminal:cancel") {
        if (currentAbort) {
          currentAbort.abort();
          currentAbort = null;
        }
        if (isBusy) {
          write("\r\n\x1b[33m^C cancelled\x1b[0m\r\n");
          setBusy(false);
          showPrompt();
        }
        return;
      }

      if (msg.type === "terminal:input") {
        const input = msg.text.trim();

        // Onboarding mode — capture answers
        if (onboardingActive) {
          handleOnboardingAnswer(msg.text);
          return;
        }

        if (!input) {
          showPrompt();
          return;
        }

        // Ignore new input while busy
        if (isBusy) {
          return;
        }

        // Handle slash commands
        if (input.startsWith("/")) {
          if (input === "/quit" || input === "/exit") {
            write("Use Ctrl+C or the browser to close.\r\n");
            showPrompt();
            return;
          }

          setBusy(true);
          const abort = new AbortController();
          currentAbort = abort;

          try {
            const output = await executeWebCommand(input, app);
            if (abort.signal.aborted) return;
            const formatted = output.replace(/\r?\n/g, "\r\n");
            write(formatted + "\r\n");
          } catch (error) {
            if (abort.signal.aborted) return;
            const errMsg = error instanceof Error ? error.message : String(error);
            const formatted = errMsg.replace(/\r?\n/g, "\r\n");
            write(`\x1b[31mError:\x1b[0m ${formatted}\r\n`);
          } finally {
            currentAbort = null;
            setBusy(false);
            showPrompt();
          }
          return;
        }

        // Chat message
        write(`\x1b[36myou:\x1b[0m ${input}\r\n`);
        setBusy(true);
        const abort = new AbortController();
        currentAbort = abort;

        try {
          const response = await chat.sendMessage(input);
          if (abort.signal.aborted) return;
          const formatted = response.content.replace(/\r?\n/g, "\r\n");
          write(`\x1b[32mai:\x1b[0m ${formatted}\r\n`);
        } catch (error) {
          if (abort.signal.aborted) return;
          const errMsg = error instanceof Error ? error.message : String(error);
          const formatted = errMsg.replace(/\r?\n/g, "\r\n");
          write(`\x1b[31mError:\x1b[0m ${formatted}\r\n`);
        } finally {
          currentAbort = null;
          setBusy(false);
          showPrompt();
        }
      }
    });

    ws.on("close", () => {
      if (currentAbort) {
        currentAbort.abort();
        currentAbort = null;
      }
    });
  });

  wss.on("close", () => {
    clearInterval(stateInterval);
  });

  return wss;
}
