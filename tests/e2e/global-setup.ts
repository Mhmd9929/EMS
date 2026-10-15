import { execSync } from "node:child_process";

export default function globalSetup() {
  if (process.env.E2E_SKIP_SEED) return;
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
}
