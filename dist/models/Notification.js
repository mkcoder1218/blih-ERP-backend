"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Notification = sequelize.define("Notification", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        recipientUserId: { type: dataTypes.UUID, allowNull: false },
        senderUserId: { type: dataTypes.UUID, allowNull: true },
        moduleKey: { type: dataTypes.STRING(120), allowNull: false },
        type: { type: dataTypes.STRING(120), allowNull: false },
        title: { type: dataTypes.STRING(255), allowNull: false },
        message: { type: dataTypes.TEXT, allowNull: false },
        entityType: { type: dataTypes.STRING(120), allowNull: true },
        entityId: { type: dataTypes.STRING(120), allowNull: true },
        priority: { type: dataTypes.STRING(50), defaultValue: "normal" }, // low, normal, high, urgent
        status: { type: dataTypes.STRING(50), defaultValue: "unread" }, // unread, read, archived
        readAt: { type: dataTypes.DATE, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "notifications", timestamps: true, paranoid: true });
    Notification.associate = (models) => {
        models.Notification.belongsTo(models.Business, { foreignKey: "businessId" });
        models.Notification.belongsTo(models.User, { foreignKey: "recipientUserId", as: "recipient" });
        models.Notification.belongsTo(models.User, { foreignKey: "senderUserId", as: "sender" });
    };
    return Notification;
};
