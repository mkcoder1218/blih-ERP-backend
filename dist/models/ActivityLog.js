"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ActivityLog = sequelize.define("ActivityLog", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: true },
        moduleKey: { type: dataTypes.STRING(120), allowNull: false },
        action: { type: dataTypes.STRING(120), allowNull: false },
        entityType: { type: dataTypes.STRING(120), allowNull: false },
        entityId: { type: dataTypes.STRING(120), allowNull: false },
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "activity_logs", timestamps: true, updatedAt: false });
    ActivityLog.associate = (models) => {
        models.ActivityLog.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.ActivityLog.belongsTo(models.User, { foreignKey: "userId" });
    };
    return ActivityLog;
};
