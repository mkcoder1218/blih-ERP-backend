/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Sequelize CLI config (CommonJS).
 *
 * This file is referenced by `.sequelizerc` so that `npm run db:migrate`
 * works in local/dev/prod without needing `sequelize init`.
 */

const dotenv = require("dotenv");

// Load .env if present (CLI does not automatically load TS env config).
dotenv.config();

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const common = {
  dialect: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: num(process.env.DB_PORT, 5432),
  database: process.env.DB_NAME || "blih",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  logging: false,
};

module.exports = {
  development: common,
  test: { ...common, database: process.env.DB_NAME_TEST || common.database },
  production: {
    ...common,
    database: common.database,
  },
};
