
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KnowledgeArticleModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KnowledgeArticleModel => {
  const KnowledgeArticle = sequelize.define("KnowledgeArticle", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    categoryId: { type: dataTypes.UUID, allowNull: true },
    authorUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(500), allowNull: false },
    slug: { type: dataTypes.STRING(500), allowNull: false },
    summary: { type: dataTypes.TEXT, allowNull: true },
    content: { type: dataTypes.TEXT, allowNull: true },
    visibility: { type: dataTypes.STRING(50), defaultValue: "internal" }, // internal, department, public
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, in_review, published, archived
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    publishedAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "brain_articles", timestamps: true, paranoid: true }) as KnowledgeArticleModel;

  KnowledgeArticle.associate = (models: any) => {
    models.KnowledgeArticle.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KnowledgeArticle.belongsTo(models.KnowledgeCategory, { foreignKey: "categoryId" });
    if(models.User) models.KnowledgeArticle.belongsTo(models.User, { foreignKey: "authorUserId", as: "author" });
    models.KnowledgeArticle.hasMany(models.KnowledgeRevision, { foreignKey: "articleId", as: "revisions" });
  };
  return KnowledgeArticle;
};
