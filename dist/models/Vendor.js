"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Vendor = sequelize.define("Vendor", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        name: { type: dataTypes.STRING(255), allowNull: false },
        email: { type: dataTypes.STRING(255), allowNull: true },
        phone: { type: dataTypes.STRING(50), allowNull: true },
        serviceCategory: { type: dataTypes.STRING(100), allowNull: true },
        taxInfo: { type: dataTypes.JSONB, defaultValue: {} },
        bankInfo: { type: dataTypes.JSONB, defaultValue: {} },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "finance_vendors", timestamps: true, paranoid: true });
    Vendor.associate = (models) => {
        models.Vendor.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return Vendor;
};
