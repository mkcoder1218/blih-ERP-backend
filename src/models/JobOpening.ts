
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type JobOpeningModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): JobOpeningModel => {
  const JobOpening = sequelize.define("JobOpening", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    positionId: { type: dataTypes.UUID, allowNull: true },
    requestedByUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    employmentType: { type: dataTypes.STRING(50) },
    headcount: { type: dataTypes.INTEGER, defaultValue: 1 },
    salaryRange: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: 'draft' }, // draft, open, paused, closed
    priority: { type: dataTypes.STRING(50), defaultValue: 'medium' },
    description: { type: dataTypes.TEXT, allowNull: false },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_job_openings", timestamps: true, paranoid: true }) as JobOpeningModel;

  JobOpening.associate = (models: any) => {
    models.JobOpening.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.JobOpening.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
  };
  return JobOpening;
};
