import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node20",
  external: ["@while-true-ai/core", "express", "ws"],
});
