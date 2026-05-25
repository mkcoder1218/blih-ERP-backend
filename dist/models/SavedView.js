"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const SavedView = sequelize.define("SavedView", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false },
        moduleKey: { type: dataTypes.STRING(120), allowNull: false },
        entityType: { type: dataTypes.STRING(120), allowNull: false },
        name: { type: dataTypes.STRING(255), allowNull: false },
        filters: { type: dataTypes.JSONB, defaultValue: {} },
        columns: { type: dataTypes.JSONB, defaultValue: [] },
        sort: { type: dataTypes.JSONB, defaultValue: {} },
        isDefault: { type: dataTypes.BOOLEAN, defaultValue: false }
    }, { tableName: "saved_views", timestamps: true, paranoid: true });
    SavedView.associate = (models) => {
        models.SavedView.belongsTo(models.Business, { foreignKey: "businessId" });
        models.SavedView.belongsTo(models.User, { foreignKey: "userId" });
    };
    return SavedView;
};
