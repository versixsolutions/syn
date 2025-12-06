import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const isCI = process.env.CI === "true";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "automatic",
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    coverage: {
      provider: "v8",
      // include json-summary to generate coverage-summary.json for CI gates
      reporter: ["text", "html", "lcov", "json", "json-summary"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.stories.tsx",
        "**/*.config.ts",
        "**/types/",
        "cypress/",
        "scripts/",
        "supabase/",
      ],
      include: ["src/**/*.{ts,tsx}"],
      // In CI, rely on workflow's coverage gate; locally keep strict thresholds
      ...(isCI
        ? {}
        : {
            thresholds: {
              lines: 70,
              functions: 70,
              branches: 70,
              statements: 70,
            },
          }),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
