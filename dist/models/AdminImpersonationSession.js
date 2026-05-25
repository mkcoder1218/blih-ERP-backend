"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const AdminImpersonationSession = sequelize.define("AdminImpersonationSession", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        platformUserId: { type: dataTypes.UUID, allowNull: false },
        targetUserId: { type: dataTypes.UUID, allowNull: false },
        businessId: { type: dataTypes.UUID, allowNull: false },
        reason: { type: dataTypes.TEXT, allowNull: false },
        startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
        endedAt: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, ended
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "admin_impersonation_sessions", timestamps: true });
    AdminImpersonationSession.associate = (models) => {
        if (models.User) {
            AdminImpersonationSession.belongsTo(models.User, { foreignKey: "platformUserId", as: "platformUser" });
            AdminImpersonationSession.belongsTo(models.User, { foreignKey: "targetUserId", as: "targetUser" });
        }
        if (models.Business)
            AdminImpersonationSession.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return AdminImpersonationSession;
};
