"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Client = sequelize.define("Client", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        accountManagerUserId: { type: dataTypes.UUID, allowNull: true },
        companyName: { type: dataTypes.STRING(255), allowNull: false },
        contactName: { type: dataTypes.STRING(255), allowNull: true },
        email: { type: dataTypes.STRING(255), allowNull: true },
        phone: { type: dataTypes.STRING(50), allowNull: true },
        industry: { type: dataTypes.STRING(120), allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        billingInfo: { type: dataTypes.JSONB, defaultValue: {} },
        kycInfo: { type: dataTypes.JSONB, defaultValue: {} },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "crm_clients", timestamps: true, paranoid: true });
    Client.associate = (models) => {
        models.Client.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.Client.belongsTo(models.User, { foreignKey: "accountManagerUserId", as: "accountManager" });
    };
    return Client;
};
