import { env } from "./config/env";
import { initDatabase } from "./database";
import { initJobs } from "./jobs/registry";

async function startWorker() {
  console.log(`[Worker] Starting Blih ERP Dedicated Background Worker (${env.nodeEnv})...`);
  
  // Ensure job worker is enabled for this dedicated process
  env.jobWorkerEnabled = true;

  await initDatabase();

  // Initialize and register all background jobs
  initJobs();

  console.log(`[Worker] Background worker running. Timezone: ${env.jobTimezone}`);

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`[Worker] Received ${signal}. Shutting down worker gracefully...`);
    try {
      const { db } = await import("./models");
      await db.sequelize.close();
      console.log("[Worker] Database connection closed.");
    } catch (err: any) {
      console.error(`[Worker] Error during shutdown: ${err.message}`);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

startWorker().catch((err) => {
  console.error("[Worker] Fatal startup error:", err);
  process.exit(1);
});
