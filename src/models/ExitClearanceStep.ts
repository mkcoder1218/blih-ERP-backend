import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExitClearanceStepModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExitClearanceStepModel => {
  const ExitClearanceStep = sequelize.define("ExitClearanceStep", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    exitProcessId: { type: dataTypes.UUID, allowNull: false },
    stepKey: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    sortOrder: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    required: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "pending" },
    completedAt: { type: dataTypes.DATE, allowNull: true },
    completedByUserId: { type: dataTypes.UUID, allowNull: true },
    notes: { type: dataTypes.TEXT, allowNull: true },
    blockedReason: { type: dataTypes.TEXT, allowNull: true },
    attachments: { type: dataTypes.JSONB, allowNull: false, defaultValue: [] }
  }, { tableName: "hr_exit_clearance_steps", timestamps: true, paranoid: true }) as ExitClearanceStepModel;

  ExitClearanceStep.associate = (models: any) => {
    models.ExitClearanceStep.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ExitClearanceStep.belongsTo(models.ExitProcess, { foreignKey: "exitProcessId", as: "exitProcess" });
    if (models.User) {
      models.ExitClearanceStep.belongsTo(models.User, { foreignKey: "completedByUserId", as: "completedBy" });
    }
  };

  return ExitClearanceStep;
};
