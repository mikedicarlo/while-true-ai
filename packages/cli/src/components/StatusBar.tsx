import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import type { Application } from "@while-true-ai/core";
import { VERSION } from "@while-true-ai/core";

interface Props {
  app: Application;
}

export function StatusBar({ app }: Props) {
  const [phase, setPhase] = useState("idle");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const handler = (payload: { data?: Record<string, unknown> }) => {
      if (payload.data?.phase) {
        setPhase(payload.data.phase as string);
      }
    };
    app.eventBus.on("agent:state_changed", handler);

    const cycleHandler = (payload: { data?: Record<string, unknown> }) => {
      if (payload.data?.cycle) {
        setCycle(payload.data.cycle as number);
      }
    };
    app.eventBus.on("cycle:completed", cycleHandler);

    return () => {
      app.eventBus.off("agent:state_changed", handler);
      app.eventBus.off("cycle:completed", cycleHandler);
    };
  }, [app]);

  const phaseColors: Record<string, string> = {
    idle: "gray",
    thinking: "cyan",
    deciding: "yellow",
    acting: "green",
    reflecting: "magenta",
    sleeping: "gray",
    stopped: "red",
  };

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">
        while-true-ai
      </Text>
      <Text dimColor> v{VERSION}</Text>
      <Text> | </Text>
      <Text color={phaseColors[phase] ?? "white"}>{phase}</Text>
      <Text> | </Text>
      <Text>cycle {cycle}</Text>
      <Text> | </Text>
      <Text color="green">${app.metrics.totalCostUsd.toFixed(4)}</Text>
    </Box>
  );
}
