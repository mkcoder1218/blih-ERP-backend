"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const NotificationPreference = sequelize.define("NotificationPreference", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false },
        channel: { type: dataTypes.STRING(50), allowNull: false }, // in_app, email, sms
        moduleKey: { type: dataTypes.STRING(120), allowNull: true },
        type: { type: dataTypes.STRING(120), allowNull: true },
        isEnabled: { type: dataTypes.BOOLEAN, defaultValue: true },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "notification_preferences", timestamps: true });
    NotificationPreference.associate = (models) => {
        models.NotificationPreference.belongsTo(models.Business, { foreignKey: "businessId" });
        models.NotificationPreference.belongsTo(models.User, { foreignKey: "userId" });
    };
    return NotificationPreference;
};
