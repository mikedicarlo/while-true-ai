import type { Application } from "@while-true-ai/core";

export interface CommandResult {
  output: string;
  handled: boolean;
}

export type CommandHandler = (
  args: string,
  app: Application,
) => CommandResult | Promise<CommandResult>;

const commands = new Map<string, { handler: CommandHandler; description: string }>();

export function registerCommand(
  name: string,
  description: string,
  handler: CommandHandler,
): void {
  commands.set(name, { handler, description });
}

export function getCommand(name: string) {
  return commands.get(name);
}

export function getAllCommands() {
  return [...commands.entries()].map(([name, { description }]) => ({
    name,
    description,
  }));
}

export function isCommand(input: string): boolean {
  return input.startsWith("/");
}

export function parseCommand(input: string): { name: string; args: string } {
  const trimmed = input.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { name: trimmed.slice(1), args: "" };
  }
  return {
    name: trimmed.slice(1, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

export async function executeCommand(
  input: string,
  app: Application,
): Promise<CommandResult> {
  const { name, args } = parseCommand(input);
  const cmd = getCommand(name);

  if (!cmd) {
    return {
      output: `Unknown command: /${name}\nType /help for available commands.`,
      handled: false,
    };
  }

  return cmd.handler(args, app);
}
