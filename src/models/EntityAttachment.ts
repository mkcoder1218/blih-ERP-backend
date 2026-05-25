
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EntityAttachmentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EntityAttachmentModel => {
  const EntityAttachment = sequelize.define("EntityAttachment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    fileAssetId: { type: dataTypes.UUID, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    entityId: { type: dataTypes.STRING(120), allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    attachmentType: { type: dataTypes.STRING(100), allowNull: true }
  }, { tableName: "entity_attachments", timestamps: true, paranoid: true }) as EntityAttachmentModel;

  EntityAttachment.associate = (models: any) => {
    models.EntityAttachment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EntityAttachment.belongsTo(models.FileAsset, { foreignKey: "fileAssetId" });
  };
  return EntityAttachment;
};