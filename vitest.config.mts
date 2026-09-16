import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    // Worktrees hold a full second copy of the suite, and their files resolve
    // "@/" against THIS root — a branch that adds a module reds the suite from
    // outside. Both worktree conventions are excluded.
    exclude: ["**/node_modules/**", "**/.next/**", "**/.worktrees/**", "**/.claude/worktrees/**"],
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
});
