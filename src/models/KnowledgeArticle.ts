
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
    contentText: { type: dataTypes.TEXT, allowNull: true },
    visibility: { type: dataTypes.STRING(50), defaultValue: "company" }, // company, department, private
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, in_review, changes_requested, approved, published, archived
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    submittedAt: { type: dataTypes.DATE, allowNull: true },
    submittedByUserId: { type: dataTypes.UUID, allowNull: true },
    reviewedAt: { type: dataTypes.DATE, allowNull: true },
    reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
    publishedAt: { type: dataTypes.DATE, allowNull: true },
    publishedByUserId: { type: dataTypes.UUID, allowNull: true },
    archivedAt: { type: dataTypes.DATE, allowNull: true },
    archivedByUserId: { type: dataTypes.UUID, allowNull: true },
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
