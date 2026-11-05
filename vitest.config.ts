import { defineConfig } from "vitest/config";

// NATIVE=1 loads modules with Node's own loader; unset uses Vite's module runner.
const native = process.env.NATIVE === "1";

export default defineConfig({
  test: {
    experimental: { viteModuleRunner: !native },
  },
});
