"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const FileAsset = sequelize.define("FileAsset", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        uploadedByUserId: { type: dataTypes.UUID, allowNull: false },
        originalName: { type: dataTypes.STRING(500), allowNull: false },
        storedName: { type: dataTypes.STRING(500), allowNull: false },
        mimeType: { type: dataTypes.STRING(100), allowNull: false },
        sizeBytes: { type: dataTypes.BIGINT, allowNull: false },
        storageProvider: { type: dataTypes.STRING(50), defaultValue: "local" },
        storagePath: { type: dataTypes.TEXT, allowNull: false },
        publicUrl: { type: dataTypes.TEXT, allowNull: true },
        checksum: { type: dataTypes.STRING(255), allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, archived, deleted, quarantined
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "file_assets", timestamps: true, paranoid: true });
    FileAsset.associate = (models) => {
        models.FileAsset.belongsTo(models.Business, { foreignKey: "businessId" });
        models.FileAsset.belongsTo(models.User, { foreignKey: "uploadedByUserId", as: "uploadedBy" });
        models.FileAsset.hasMany(models.EntityAttachment, { foreignKey: "fileAssetId" });
    };
    return FileAsset;
};
