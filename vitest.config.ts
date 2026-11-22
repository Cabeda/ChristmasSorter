import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      all: true,
      clean: true,
      include: ["src/**/*.{ts,tsx}", "Shared/**/*.ts", "api/**/*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/css/**",
        "Shared/Interfaces/**",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
