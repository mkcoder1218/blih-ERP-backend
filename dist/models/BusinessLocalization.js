"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const BusinessLocalization = sequelize.define("BusinessLocalization", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
        timezone: { type: dataTypes.STRING(100), defaultValue: "UTC" },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        language: { type: dataTypes.STRING(20), defaultValue: "en" },
        dateFormat: { type: dataTypes.STRING(20), defaultValue: "YYYY-MM-DD" },
        timeFormat: { type: dataTypes.STRING(20), defaultValue: "24h" },
        fiscalYearStartMonth: { type: dataTypes.INTEGER, defaultValue: 1 },
        taxSettings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "business_localizations", timestamps: true, paranoid: true });
    BusinessLocalization.associate = (models) => {
        models.BusinessLocalization.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return BusinessLocalization;
};
