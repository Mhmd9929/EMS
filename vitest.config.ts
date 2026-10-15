import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export const sharedConfig = {
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "tests/stubs/server-only.ts") },
    ],
  },
  test: {
    environment: "node" as const,
    // next-auth imports "next/server" without an extension; let Vite resolve it.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
  },
};

export default defineConfig({
  ...sharedConfig,
  test: { ...sharedConfig.test, include: ["tests/unit/**/*.test.ts"] },
});
