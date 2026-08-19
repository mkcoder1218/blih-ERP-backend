import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProcedureRevisionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProcedureRevisionModel => {
  const ProcedureRevision = sequelize.define("ProcedureRevision", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    procedureId: { type: dataTypes.UUID, allowNull: false },
    revisedByUserId: { type: dataTypes.UUID, allowNull: false },
    version: { type: dataTypes.INTEGER, allowNull: false },
    changeSummary: { type: dataTypes.TEXT, allowNull: true },
    contentSnapshot: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "procedure_revisions", timestamps: true, updatedAt: false }) as ProcedureRevisionModel;

  ProcedureRevision.associate = (models: any) => {
    models.ProcedureRevision.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProcedureRevision.belongsTo(models.Procedure, { foreignKey: "procedureId" });
    if (models.User) models.ProcedureRevision.belongsTo(models.User, { foreignKey: "revisedByUserId", as: "revisedBy" });
  };
  return ProcedureRevision;
};
