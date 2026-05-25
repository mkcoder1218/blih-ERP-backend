"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const SupportAccessLog = sequelize.define("SupportAccessLog", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        platformUserId: { type: dataTypes.UUID, allowNull: false },
        businessId: { type: dataTypes.UUID, allowNull: false },
        reason: { type: dataTypes.TEXT, allowNull: false },
        accessType: { type: dataTypes.STRING(50), defaultValue: "read_only" }, // read_only, write
        startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
        endedAt: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, ended, revoked
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "support_access_logs", timestamps: true });
    SupportAccessLog.associate = (models) => {
        if (models.User)
            SupportAccessLog.belongsTo(models.User, { foreignKey: "platformUserId", as: "platformUser" });
        if (models.Business)
            SupportAccessLog.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return SupportAccessLog;
};
