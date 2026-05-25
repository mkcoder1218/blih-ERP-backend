
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type JobApplicationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): JobApplicationModel => {
  const JobApplication = sequelize.define("JobApplication", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    jobOpeningId: { type: dataTypes.UUID, allowNull: false },
    fullName: { type: dataTypes.STRING(255), allowNull: false },
    email: { type: dataTypes.STRING(255), allowNull: false },
    phone: { type: dataTypes.STRING(50), allowNull: true },
    source: { type: dataTypes.STRING(100), defaultValue: 'careers_page' },
    stage: { type: dataTypes.STRING(50), defaultValue: 'applied' }, // applied, screened, shortlisted, interviewed, offered, hired, rejected
    score: { type: dataTypes.FLOAT, allowNull: true },
    cvFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_job_applications", timestamps: true, paranoid: true }) as JobApplicationModel;

  JobApplication.associate = (models: any) => {
    models.JobApplication.belongsTo(models.Business, { foreignKey: "businessId" });
    models.JobApplication.belongsTo(models.JobOpening, { foreignKey: "jobOpeningId" });
  };
  return JobApplication;
};
