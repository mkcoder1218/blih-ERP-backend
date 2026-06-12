import http from "http";
import app from "./app";
import { env } from "./config/env";
import { initDatabase } from "./database";
import { initJobs } from "./jobs/registry";
import { seedPlatformSuperAdminFromEnv } from "./database/platformAdminSeed";
import { initializeSocket } from "./services/realtime/socket";

async function start() {
  await initDatabase();
  await seedPlatformSuperAdminFromEnv();
  const server = http.createServer(app);

  // Initialize WebSocket service
  initializeSocket(server);
  
  initJobs();

  server.listen(env.port, () => {
    // -disable-next-line no-console
    console.log(`Blih ERP backend listening on :${env.port} (${env.nodeEnv})`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
