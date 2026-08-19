import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProcedureModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProcedureModel => {
  const Procedure = sequelize.define("Procedure", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    categoryId: { type: dataTypes.UUID, allowNull: true },
    authorUserId: { type: dataTypes.UUID, allowNull: false },
    responsibleDepartmentId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(500), allowNull: false },
    slug: { type: dataTypes.STRING(500), allowNull: false },
    purpose: { type: dataTypes.TEXT, allowNull: true },
    scope: { type: dataTypes.TEXT, allowNull: true },
    responsibilities: { type: dataTypes.TEXT, allowNull: true },
    prerequisites: { type: dataTypes.TEXT, allowNull: true },
    steps: { type: dataTypes.JSONB, defaultValue: [] },
    expectedResult: { type: dataTypes.TEXT, allowNull: true },
    visibility: { type: dataTypes.STRING(50), defaultValue: "company" }, // company, department, private
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, in_review, changes_requested, approved, published, archived
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    effectiveDate: { type: dataTypes.DATE, allowNull: true },
    reviewDueDate: { type: dataTypes.DATE, allowNull: true },
    submittedAt: { type: dataTypes.DATE, allowNull: true },
    submittedByUserId: { type: dataTypes.UUID, allowNull: true },
    reviewedAt: { type: dataTypes.DATE, allowNull: true },
    reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
    publishedAt: { type: dataTypes.DATE, allowNull: true },
    publishedByUserId: { type: dataTypes.UUID, allowNull: true },
    archivedAt: { type: dataTypes.DATE, allowNull: true },
    archivedByUserId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "procedures", timestamps: true, paranoid: true }) as ProcedureModel;

  Procedure.associate = (models: any) => {
    models.Procedure.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Procedure.belongsTo(models.KnowledgeCategory, { foreignKey: "categoryId" });
    if (models.User) {
      models.Procedure.belongsTo(models.User, { foreignKey: "authorUserId", as: "author" });
    }
    if (models.Department) {
      models.Procedure.belongsTo(models.Department, { foreignKey: "responsibleDepartmentId", as: "responsibleDepartment" });
    }
    models.Procedure.hasMany(models.ProcedureRevision, { foreignKey: "procedureId", as: "revisions" });
  };
  return Procedure;
};
