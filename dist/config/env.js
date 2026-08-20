"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// When running compiled JS from `dist`, `process.cwd()` may not be the project root
// (e.g. when started by a process manager). Resolve `.env` relative to this file
// so dev flags like `DB_SYNC=true` reliably apply.
const defaultEnvPath = path_1.default.resolve(__dirname, "../../.env");
dotenv_1.default.config({ path: process.env.ENV_FILE || defaultEnvPath });
function requireEnv(name) {
    const value = process.env[name];
    if (!value)
        throw new Error(`Missing required env var: ${name}`);
    return value;
}
function toBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === "")
        return defaultValue;
    return String(value).toLowerCase() === "true";
}
exports.env = {
    apiVersion: process.env.API_VERSION || "v1",
    corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173").split(","),
    rateLimitWindowMins: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
    rateLimitMaxReqs: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
    authRateLimitMaxReqs: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
    jobWorkerEnabled: toBool(process.env.JOB_WORKER_ENABLED, false),
    jobTimezone: process.env.JOB_TIMEZONE || "UTC",
    pgDumpPath: process.env.PG_DUMP_PATH || "pg_dump",
    guestApiKey: process.env.GUEST_API_KEY,
    policiesApiBaseUrl: process.env.POLICIES_API_BASE_URL,
    nodeEnv: process.env.NODE_ENV || "development",
    port: Number(process.env.PORT || 4000),
    jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
    jwtRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
    bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS || 12),
    platformAdmin: {
        name: process.env.PLATFORM_ADMIN_NAME,
        email: process.env.PLATFORM_ADMIN_EMAIL,
        password: process.env.PLATFORM_ADMIN_PASSWORD
    },
    db: {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        name: requireEnv("DB_NAME"),
        user: requireEnv("DB_USER"),
        password: process.env.DB_PASSWORD || "",
        dialect: (process.env.DB_DIALECT || "postgres").toLowerCase()
    },
    dbSync: toBool(process.env.DB_SYNC, false),
    smtpTlsRejectUnauthorized: toBool(process.env.SMTP_TLS_REJECT_UNAUTHORIZED, true)
};
if (exports.env.db.dialect !== "postgres") {
    throw new Error(`DB_DIALECT must be 'postgres' (got '${exports.env.db.dialect}')`);
}
