import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type RecruitmentTemplateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): RecruitmentTemplateModel => {
  const RecruitmentTemplate = sequelize.define("RecruitmentTemplate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    name: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    
    // Step 1: Request Form configuration
    requestConfig: { type: dataTypes.JSONB, defaultValue: {} },
    
    // Step 2: Job Details configuration
    jobDetailsConfig: { type: dataTypes.JSONB, defaultValue: {} },
    
    // Step 3: Application Form configuration (fields, custom, preview)
    applicationFormConfig: { type: dataTypes.JSONB, defaultValue: {} },
    
    createdByUserId: { type: dataTypes.UUID, allowNull: false },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_recruitment_templates", timestamps: true, paranoid: true }) as RecruitmentTemplateModel;

  RecruitmentTemplate.associate = (models: any) => {
    models.RecruitmentTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.RecruitmentTemplate.belongsTo(models.User, { foreignKey: "createdByUserId", as: "creator" });
  };
  return RecruitmentTemplate;
};
