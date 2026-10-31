import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next resolves "server-only" to an empty module on the server; tests run server code too.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    // Full-board UI tests drive many user events; under a parallel run they can pass 5 s.
    testTimeout: 15_000,
  },
});
