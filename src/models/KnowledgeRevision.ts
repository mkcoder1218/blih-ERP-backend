
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KnowledgeRevisionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KnowledgeRevisionModel => {
  const KnowledgeRevision = sequelize.define("KnowledgeRevision", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    articleId: { type: dataTypes.UUID, allowNull: false },
    revisedByUserId: { type: dataTypes.UUID, allowNull: false },
    version: { type: dataTypes.INTEGER, allowNull: false },
    changeSummary: { type: dataTypes.TEXT, allowNull: true },
    contentSnapshot: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "brain_revisions", timestamps: true, updatedAt: false }) as KnowledgeRevisionModel;

  KnowledgeRevision.associate = (models: any) => {
    models.KnowledgeRevision.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KnowledgeRevision.belongsTo(models.KnowledgeArticle, { foreignKey: "articleId" });
    if(models.User) models.KnowledgeRevision.belongsTo(models.User, { foreignKey: "revisedByUserId", as: "revisedBy" });
  };
  return KnowledgeRevision;
};
