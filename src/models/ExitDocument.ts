import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExitDocumentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExitDocumentModel => {
  const ExitDocument = sequelize.define("ExitDocument", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    exitProcessId: { type: dataTypes.UUID, allowNull: false },
    documentKey: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    required: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "missing" },
    fileUrl: { type: dataTypes.TEXT, allowNull: true },
    uploadedAt: { type: dataTypes.DATE, allowNull: true },
    uploadedByUserId: { type: dataTypes.UUID, allowNull: true },
    verifiedAt: { type: dataTypes.DATE, allowNull: true },
    verifiedByUserId: { type: dataTypes.UUID, allowNull: true },
    notes: { type: dataTypes.TEXT, allowNull: true }
  }, { tableName: "hr_exit_documents", timestamps: true, paranoid: true }) as ExitDocumentModel;

  ExitDocument.associate = (models: any) => {
    models.ExitDocument.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ExitDocument.belongsTo(models.ExitProcess, { foreignKey: "exitProcessId", as: "exitProcess" });
    if (models.User) {
      models.ExitDocument.belongsTo(models.User, { foreignKey: "uploadedByUserId", as: "uploadedBy" });
      models.ExitDocument.belongsTo(models.User, { foreignKey: "verifiedByUserId", as: "verifiedBy" });
    }
  };

  return ExitDocument;
};
