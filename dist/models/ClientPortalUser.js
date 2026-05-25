"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ClientPortalUser = sequelize.define("ClientPortalUser", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        clientId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: true }, // Linked system user if they log in via main auth
        fullName: { type: dataTypes.STRING(255), allowNull: false },
        email: { type: dataTypes.STRING(255), allowNull: false },
        phone: { type: dataTypes.STRING(50), allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive, invited
        lastLoginAt: { type: dataTypes.DATE, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "client_portal_users", timestamps: true, paranoid: true });
    ClientPortalUser.associate = (models) => {
        models.ClientPortalUser.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Client)
            models.ClientPortalUser.belongsTo(models.Client, { foreignKey: "clientId" });
        if (models.User)
            models.ClientPortalUser.belongsTo(models.User, { foreignKey: "userId" });
        models.ClientPortalUser.hasMany(models.ClientPortalAccess, { foreignKey: "clientPortalUserId" });
        models.ClientPortalUser.hasMany(models.ClientRequest, { foreignKey: "submittedByPortalUserId" });
        models.ClientPortalUser.hasMany(models.ClientFeedback, { foreignKey: "submittedByPortalUserId" });
    };
    return ClientPortalUser;
};
