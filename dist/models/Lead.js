"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Lead = sequelize.define("Lead", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        assignedToUserId: { type: dataTypes.UUID, allowNull: true },
        companyName: { type: dataTypes.STRING(255), allowNull: true },
        contactName: { type: dataTypes.STRING(255), allowNull: false },
        email: { type: dataTypes.STRING(255), allowNull: false },
        phone: { type: dataTypes.STRING(50), allowNull: true },
        industry: { type: dataTypes.STRING(120), allowNull: true },
        source: { type: dataTypes.STRING(120), allowNull: true },
        serviceInterest: { type: dataTypes.JSONB, defaultValue: {} },
        stage: { type: dataTypes.STRING(50), defaultValue: "new" },
        priority: { type: dataTypes.STRING(50), defaultValue: "normal" },
        status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, converted, lost
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "crm_leads", timestamps: true, paranoid: true });
    Lead.associate = (models) => {
        models.Lead.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.Lead.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignedTo" });
    };
    return Lead;
};
