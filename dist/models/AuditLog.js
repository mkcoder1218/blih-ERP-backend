"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const AuditLog = sequelize.define("AuditLog", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: true },
        userId: { type: dataTypes.UUID, allowNull: true },
        action: { type: dataTypes.STRING(100), allowNull: false }, // CREATE, UPDATE, DELETE
        entityType: { type: dataTypes.STRING(100), allowNull: false },
        entityId: { type: dataTypes.STRING(100), allowNull: false },
        beforeData: { type: dataTypes.JSONB, allowNull: true },
        afterData: { type: dataTypes.JSONB, allowNull: true },
        ipAddress: { type: dataTypes.STRING(100), allowNull: true },
        userAgent: { type: dataTypes.STRING(255), allowNull: true }
    }, {
        tableName: "audit_logs",
        timestamps: true,
        updatedAt: false // Audit logs only have createdAt
    });
    AuditLog.associate = (models) => {
        models.AuditLog.belongsTo(models.Business, { foreignKey: "businessId" });
        models.AuditLog.belongsTo(models.User, { foreignKey: "userId" });
    };
    return AuditLog;
};
