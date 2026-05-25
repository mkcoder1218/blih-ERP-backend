"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const TrainingMaterial = sequelize.define("TrainingMaterial", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        categoryId: { type: dataTypes.UUID, allowNull: true },
        title: { type: dataTypes.STRING(500), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        materialType: { type: dataTypes.STRING(50), defaultValue: "document" }, // document, video, presentation, link
        fileAssetId: { type: dataTypes.UUID, allowNull: true },
        url: { type: dataTypes.STRING(2048), allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "brain_training_materials", timestamps: true, paranoid: true });
    TrainingMaterial.associate = (models) => {
        models.TrainingMaterial.belongsTo(models.Business, { foreignKey: "businessId" });
        models.TrainingMaterial.belongsTo(models.KnowledgeCategory, { foreignKey: "categoryId" });
        if (models.FileAsset)
            models.TrainingMaterial.belongsTo(models.FileAsset, { foreignKey: "fileAssetId" });
    };
    return TrainingMaterial;
};
