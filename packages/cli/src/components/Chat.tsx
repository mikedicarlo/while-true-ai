import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";
import TextInput from "ink-text-input";
import type { Application, ChatInterface } from "@while-true-ai/core";
import { isCommand, executeCommand } from "../commands/index.js";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface Props {
  app: Application;
  chatInterface: ChatInterface;
}

export function Chat({ app, chatInterface }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "system",
      content: 'Welcome to while-true-ai! Type a message or /help for commands.',
    },
  ]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { exit } = useApp();

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;

      setInput("");

      // Handle /quit
      if (trimmed === "/quit" || trimmed === "/exit") {
        setMessages((prev) => [
          ...prev,
          { role: "system", content: "Shutting down..." },
        ]);
        await app.shutdown();
        exit();
        return;
      }

      // Handle slash commands
      if (isCommand(trimmed)) {
        const result = await executeCommand(trimmed, app);
        setMessages((prev) => [
          ...prev,
          { role: "user", content: trimmed },
          { role: "system", content: result.output },
        ]);
        return;
      }

      // Chat message
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setIsProcessing(true);

      try {
        const response = await chatInterface.sendMessage(trimmed);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.content },
        ]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setMessages((prev) => [
          ...prev,
          { role: "system", content: `Error: ${msg}` },
        ]);
      } finally {
        setIsProcessing(false);
      }
    },
    [app, chatInterface, exit],
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Message history */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.slice(-20).map((msg, i) => (
          <Box key={i} marginBottom={0}>
            {msg.role === "user" && (
              <Text>
                <Text color="cyan" bold>
                  you:{" "}
                </Text>
                {msg.content}
              </Text>
            )}
            {msg.role === "assistant" && (
              <Text>
                <Text color="green" bold>
                  ai:{" "}
                </Text>
                {msg.content}
              </Text>
            )}
            {msg.role === "system" && (
              <Text color="gray" dimColor>
                {msg.content}
              </Text>
            )}
          </Box>
        ))}
        {isProcessing && (
          <Text color="yellow" dimColor>
            Thinking...
          </Text>
        )}
      </Box>

      {/* Input */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          {">"}{" "}
        </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isProcessing ? "waiting..." : "Type a message or /command..."}
        />
      </Box>
    </Box>
  );
}
