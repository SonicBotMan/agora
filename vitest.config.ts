import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    setupFiles: ["src/test/vitest.setup.ts"],
  },
});
