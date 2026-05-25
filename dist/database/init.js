"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const env_1 = require("../config/env");
const sequelize_1 = require("./sequelize");
const seed_1 = require("./seed");
require("../models"); // ensure models loaded + associations registered on shared sequelize instance
async function tableExists(tableName) {
    try {
        await sequelize_1.sequelize.getQueryInterface().describeTable(tableName);
        return true;
    }
    catch {
        return false;
    }
}
async function initDatabase() {
    try {
        await (0, sequelize_1.authenticateDB)();
        // eslint-disable-next-line no-console
        console.log("DB connected");
        if (env_1.env.nodeEnv === "production" && env_1.env.dbSync) {
            throw new Error("Critical Vulnerability: DB_SYNC strictly prohibited in production context. Migrations exclusively supported.");
        }
        if (env_1.env.nodeEnv === "development" && env_1.env.dbSync) {
            // NOTE: sequelize.sync({ alter: true }) can crash on some Postgres setups when
            // existing index DDL can't be parsed by Sequelize. Keep dev sync non-altering.
            await sequelize_1.sequelize.sync();
            // eslint-disable-next-line no-console
            console.log("DB synced");
        }
        const canSeed = await tableExists("permissions");
        if (canSeed) {
            await (0, seed_1.seedDefaults)();
            // eslint-disable-next-line no-console
            console.log("DB seeded");
        }
        else {
            // eslint-disable-next-line no-console
            console.log("Tables missing. Set DB_SYNC=true in development or run migrations.");
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("DB init failed", err);
        throw err;
    }
}
