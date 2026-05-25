"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.ENV_FILE || path_1.default.resolve(process.cwd(), ".env") });
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
    rateLimitMaxReqs: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100),
    authRateLimitMaxReqs: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 10),
    jobWorkerEnabled: toBool(process.env.JOB_WORKER_ENABLED, false),
    jobTimezone: process.env.JOB_TIMEZONE || "UTC",
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
    dbSync: toBool(process.env.DB_SYNC, false)
};
if (exports.env.db.dialect !== "postgres") {
    throw new Error(`DB_DIALECT must be 'postgres' (got '${exports.env.db.dialect}')`);
}
