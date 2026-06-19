"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const database_1 = require("./database");
const registry_1 = require("./jobs/registry");
const platformAdminSeed_1 = require("./database/platformAdminSeed");
const socket_1 = require("./services/realtime/socket");
async function start() {
    await (0, database_1.initDatabase)();
    await (0, platformAdminSeed_1.seedPlatformSuperAdminFromEnv)();
    const server = http_1.default.createServer(app_1.default);
    // Initialize WebSocket service
    (0, socket_1.initializeSocket)(server);
    (0, registry_1.initJobs)();
    server.listen(env_1.env.port, () => {
        // -disable-next-line no-console
        console.log(`Blih ERP backend listening on :${env_1.env.port} (${env_1.env.nodeEnv})`);
    });
}
start().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Fatal startup error:", err);
    process.exit(1);
});
