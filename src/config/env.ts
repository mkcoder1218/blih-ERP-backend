import path from "path";
import dotenv from "dotenv";

// When running compiled JS from `dist`, `process.cwd()` may not be the project root
// (e.g. when started by a process manager). Resolve `.env` relative to this file
// so dev flags like `DB_SYNC=true` reliably apply.
const defaultEnvPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: process.env.ENV_FILE || defaultEnvPath });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function toBool(value: unknown, defaultValue = false): boolean {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
}

export type Env = {
  apiVersion: string;
  corsOrigins: string[];
  rateLimitWindowMins: number;
  rateLimitMaxReqs: number;
  authRateLimitMaxReqs: number;
  jobWorkerEnabled: boolean;
  jobTimezone: string;
  nodeEnv: string;
  port: number;
  jwtAccessSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  bcryptSaltRounds: number;
  platformAdmin?: {
    name?: string;
    email?: string;
    password?: string;
  };
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    dialect: string;
  };
  dbSync: boolean;
};

export const env: Env = {
  apiVersion: process.env.API_VERSION || "v1",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173").split(","),
  rateLimitWindowMins: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
  rateLimitMaxReqs: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
  authRateLimitMaxReqs: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
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

if (env.db.dialect !== "postgres") {
  throw new Error(`DB_DIALECT must be 'postgres' (got '${env.db.dialect}')`);
}
