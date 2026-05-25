"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const BusinessBranding = sequelize.define("BusinessBranding", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
        logoFileId: { type: dataTypes.UUID, allowNull: true },
        faviconFileId: { type: dataTypes.UUID, allowNull: true },
        primaryColor: { type: dataTypes.STRING(20), defaultValue: "#000000" },
        secondaryColor: { type: dataTypes.STRING(20), defaultValue: "#ffffff" },
        accentColor: { type: dataTypes.STRING(20), defaultValue: "#3b82f6" },
        companyName: { type: dataTypes.STRING(255), allowNull: false },
        tagline: { type: dataTypes.STRING(255), allowNull: true },
        customDomain: { type: dataTypes.STRING(255), allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "business_branding", timestamps: true, paranoid: true });
    BusinessBranding.associate = (models) => {
        models.BusinessBranding.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return BusinessBranding;
};
