import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { Application, ChatInterface } from "@while-true-ai/core";
import { StatusBar } from "./components/StatusBar.js";
import { Chat } from "./components/Chat.js";
import { Setup } from "./components/Setup.js";
import fs from "node:fs";
import { getConfigDir } from "@while-true-ai/core";
import path from "node:path";

interface Props {
  runSetup?: boolean;
  configPath?: string;
  headless?: boolean;
}

export function App({ runSetup, configPath, headless }: Props) {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [app, setApp] = useState<Application | null>(null);
  const [chatInterface, setChatInterface] = useState<ChatInterface | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if setup is needed
    const configDir = getConfigDir();
    const configExists = fs.existsSync(path.join(configDir, "config.yaml"));

    if (runSetup || !configExists) {
      setNeedsSetup(true);
      return;
    }

    initApp(configPath);
  }, []);

  const initApp = async (cfgPath?: string) => {
    try {
      // Load credentials from credentials.yaml into env
      const configDir = getConfigDir();
      const credPath = path.join(configDir, "credentials.yaml");
      if (fs.existsSync(credPath)) {
        const yaml = await import("js-yaml");
        const creds = yaml.load(
          fs.readFileSync(credPath, "utf-8"),
        ) as Record<string, string>;
        if (creds) {
          for (const [key, value] of Object.entries(creds)) {
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }

      const application = new Application(cfgPath);
      const { registerIntegrations } = await import("@while-true-ai/integrations");
      registerIntegrations(application);
      await application.start();

      const chat = new ChatInterface(
        application.llmRouter,
        application.budget,
        application.integrationManager,
        application.memoryManager,
        { userContext: application.userContext.toPromptString(), userContextStore: application.userContext, metrics: application.metrics },
      );

      setApp(application);
      setChatInterface(chat);

      // Start the agent loop in the background
      if (!headless) {
        application.agentLoop.start().catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`Agent loop error: ${msg}`);
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Friendly error messages for common issues
      if (msg.includes("API key") || msg.includes("apiKey") || msg.includes("401") || msg.includes("authentication")) {
        setError(
          `API key error: ${msg}\n\nRun the setup wizard to configure your API key:\n  while-true-ai --setup\n\nOr set the environment variable directly (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY).`,
        );
      } else if (msg.includes("ENOENT") || msg.includes("no such file")) {
        setError(
          `File not found: ${msg}\n\nYour config may be missing. Run setup:\n  while-true-ai --setup`,
        );
      } else if (msg.includes("EACCES") || msg.includes("permission")) {
        setError(
          `Permission denied: ${msg}\n\nCheck file permissions on ~/.while-true-ai/`,
        );
      } else if (msg.includes("ECONNREFUSED")) {
        setError(
          `Connection refused: ${msg}\n\nIf using Ollama, make sure it's running:\n  ollama serve`,
        );
      } else {
        setError(`Failed to start: ${msg}\n\nTry running setup again:\n  while-true-ai --setup`);
      }
    }
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    setError(null);
    initApp(configPath);
  };

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red" bold>Error</Text>
        <Text>{error}</Text>
      </Box>
    );
  }

  if (needsSetup) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  if (!app || !chatInterface) {
    return (
      <Box padding={1}>
        <Text dimColor>Starting while-true-ai...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      <StatusBar app={app} />
      <Chat app={app} chatInterface={chatInterface} />
    </Box>
  );
}
