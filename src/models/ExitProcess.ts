
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExitProcessModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExitProcessModel => {
  const ExitProcess = sequelize.define("ExitProcess", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    initiatedByUserId: { type: dataTypes.UUID, allowNull: false },
    exitType: { type: dataTypes.STRING(50), allowNull: false }, // resignation, termination, redundancy
    reason: { type: dataTypes.TEXT, allowNull: true },
    effectiveDate: { type: dataTypes.DATE, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: 'pending' }, // pending, in_progress, completed, cancelled
    clearanceData: { type: dataTypes.JSONB, defaultValue: {} },
    finalPayData: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_exit_processes", timestamps: true, paranoid: true }) as ExitProcessModel;

  ExitProcess.associate = (models: any) => {
    models.ExitProcess.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.ExitProcess.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.ExitProcess.belongsTo(models.User, { foreignKey: "initiatedByUserId", as: "initiator" });
    }
  };
  return ExitProcess;
};
