
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TrainingRecordModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TrainingRecordModel => {
  const TrainingRecord = sequelize.define("TrainingRecord", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    trainingType: { type: dataTypes.STRING(100) }, // external, internal, compliance
    provider: { type: dataTypes.STRING(255), allowNull: true },
    startDate: { type: dataTypes.DATE, allowNull: true },
    endDate: { type: dataTypes.DATE, allowNull: true },
    cost: { type: dataTypes.FLOAT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: 'requested' }, // requested, scheduled, completed, cancelled
    resultData: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_training_records", timestamps: true, paranoid: true }) as TrainingRecordModel;

  TrainingRecord.associate = (models: any) => {
    models.TrainingRecord.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.TrainingRecord.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.TrainingRecord.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    }
  };
  return TrainingRecord;
};
