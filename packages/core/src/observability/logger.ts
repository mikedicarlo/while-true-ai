import pino from "pino";

let logger: pino.Logger = pino({
  level: "info",
  transport: {
    target: "pino/file",
    options: { destination: 1 }, // stdout
  },
});

export function initLogger(opts: {
  consoleLevel?: string;
  fileLevel?: string;
  filePath?: string;
}): pino.Logger {
  const targets: pino.TransportTargetOptions[] = [
    {
      target: "pino/file",
      options: { destination: 1 },
      level: opts.consoleLevel ?? "info",
    },
  ];

  if (opts.filePath) {
    targets.push({
      target: "pino/file",
      options: { destination: opts.filePath, mkdir: true },
      level: opts.fileLevel ?? "info",
    });
  }

  logger = pino({
    level: "trace", // Set to lowest; transports filter
    transport: { targets },
  });

  return logger;
}

export function getLogger(name?: string): pino.Logger {
  return name ? logger.child({ module: name }) : logger;
}
