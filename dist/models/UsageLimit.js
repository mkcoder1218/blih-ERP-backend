"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const UsageLimit = sequelize.define("UsageLimit", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        planId: { type: dataTypes.UUID, allowNull: true },
        key: { type: dataTypes.STRING(100), allowNull: false }, // users, storage_gb, API_calls
        limitValue: { type: dataTypes.INTEGER, allowNull: false }, // -1 implies unlimited
        currentValue: { type: dataTypes.INTEGER, defaultValue: 0 },
        resetPeriod: { type: dataTypes.STRING(50), defaultValue: "never" }, // monthly, yearly, never
        resetAt: { type: dataTypes.DATE, allowNull: true }
    }, { tableName: "usage_limits", timestamps: true });
    UsageLimit.associate = (models) => {
        models.UsageLimit.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Plan)
            models.UsageLimit.belongsTo(models.Plan, { foreignKey: "planId" });
    };
    return UsageLimit;
};
