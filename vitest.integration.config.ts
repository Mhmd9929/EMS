import { defineConfig } from "vitest/config";
import { sharedConfig } from "./vitest.config";

/** Service-level tests against a seeded database (`npm run db:seed` first). */
export default defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
