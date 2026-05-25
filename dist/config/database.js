"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sequelize = void 0;
exports.testConnection = testConnection;
const sequelize_1 = require("sequelize");
const env_1 = require("./env");
function createSequelize() {
    return new sequelize_1.Sequelize(env_1.config.db.name, env_1.config.db.user, env_1.config.db.password, {
        host: env_1.config.db.host,
        port: env_1.config.db.port,
        dialect: "postgres",
        logging: false,
        dialectOptions: env_1.config.db.ssl
            ? {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
            : undefined
    });
}
exports.sequelize = createSequelize();
async function testConnection() {
    await exports.sequelize.authenticate();
}
