import http from "http";
import app from "./app";
import { env } from "./config/env";
import { initDatabase } from "./database";
import { initJobs } from "./jobs/registry";
import { seedPlatformSuperAdminFromEnv } from "./database/platformAdminSeed";

async function start() {
  await initDatabase();
  await seedPlatformSuperAdminFromEnv();
  const server = http.createServer(app);
  
  initJobs();

  server.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Blih ERP backend listening on :${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
