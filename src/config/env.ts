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
  policyJobsEnabled: boolean;
  policyPublishScheduledCron: string;
  policyOverdueCron: string;
  policyReminderCron: string;
  policyJobBatchSize: number;
  policyJobMaxRetries: number;
  policyJobTimeoutSeconds: number;
  policyReminderTimezone: string;
  pgDumpPath: string;
  guestApiKey?: string;
  policiesApiBaseUrl?: string;
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
  smtpTlsRejectUnauthorized: boolean;
};

export const env: Env = {
  apiVersion: process.env.API_VERSION || "v1",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173").split(","),
  rateLimitWindowMins: Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15),
  rateLimitMaxReqs: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 500),
  authRateLimitMaxReqs: Number(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || 20),
  jobWorkerEnabled: toBool(process.env.JOB_WORKER_ENABLED, false),
  jobTimezone: process.env.JOB_TIMEZONE || "UTC",
  policyJobsEnabled: toBool(process.env.POLICY_JOBS_ENABLED, true),
  policyPublishScheduledCron: process.env.POLICY_PUBLISH_SCHEDULED_CRON || "*/5 * * * *",
  policyOverdueCron: process.env.POLICY_OVERDUE_CRON || "0 * * * *",
  policyReminderCron: process.env.POLICY_REMINDER_CRON || "0 8 * * *",
  policyJobBatchSize: Math.max(1, Math.min(Number(process.env.POLICY_JOB_BATCH_SIZE || 500), 5000)),
  policyJobMaxRetries: Math.max(1, Number(process.env.POLICY_JOB_MAX_RETRIES || 3)),
  policyJobTimeoutSeconds: Math.max(10, Number(process.env.POLICY_JOB_TIMEOUT_SECONDS || 240)),
  policyReminderTimezone: process.env.POLICY_REMINDER_TIMEZONE || "Africa/Addis_Ababa",
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

if (env.db.dialect !== "postgres") {
  throw new Error(`DB_DIALECT must be 'postgres' (got '${env.db.dialect}')`);
}
