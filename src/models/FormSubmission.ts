
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormSubmissionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormSubmissionModel => {
  const FormSubmission = sequelize.define("FormSubmission", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    formDefinitionId: { type: dataTypes.UUID, allowNull: false },
    submittedByUserId: { type: dataTypes.UUID, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: true },
    entityId: { type: dataTypes.STRING(120), allowNull: true },
    data: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, submitted, approved, rejected, returned, cancelled
    approvalRequestId: { type: dataTypes.UUID, allowNull: true }
  }, { tableName: "form_submissions", timestamps: true, paranoid: true }) as FormSubmissionModel;

  FormSubmission.associate = (models: any) => {
    models.FormSubmission.belongsTo(models.Business, { foreignKey: "businessId" });
    models.FormSubmission.belongsTo(models.FormDefinition, { foreignKey: "formDefinitionId" });
    models.FormSubmission.belongsTo(models.User, { foreignKey: "submittedByUserId", as: "submittedBy" });
    if (models.ApprovalRequest) models.FormSubmission.belongsTo(models.ApprovalRequest, { foreignKey: "approvalRequestId" });
  };
  return FormSubmission;
};