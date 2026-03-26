import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin/while-true-ai.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node20",
  splitting: true,
  external: ["@while-true-ai/core", "@while-true-ai/web", "@while-true-ai/integrations"],
  banner: {
    js: "// while-true-ai CLI",
  },
});
