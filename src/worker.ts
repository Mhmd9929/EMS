/**
 * Background job runner (pg-boss, backed by the same Postgres database).
 * Start with `npm run worker`. Run exactly one or more instances — pg-boss coordinates them.
 */
import PgBoss from "pg-boss";
import { JOBS } from "@/server/jobs";

const timezone = process.env.JOBS_TIMEZONE ?? "Asia/Dubai";

async function main() {
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss" });
  boss.on("error", (error) => console.error("[worker] pg-boss error", error));
  await boss.start();

  for (const job of JOBS) {
    await boss.createQueue(job.name);
    await boss.schedule(job.name, job.cron, {}, { tz: timezone });
    await boss.work(job.name, async () => {
      const started = Date.now();
      const result = await job.handler();
      console.info(`[worker] ${job.name} done in ${Date.now() - started}ms`, result);
    });
    console.info(`[worker] registered ${job.name} (${job.cron} ${timezone}) — ${job.description}`);
  }

  // Run once now with --run-now (handy in development).
  if (process.argv.includes("--run-now")) {
    for (const job of JOBS) await boss.send(job.name, {});
  }

  const shutdown = async () => {
    console.info("[worker] stopping…");
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("[worker] failed to start", error);
  process.exit(1);
});
