import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectWorkflowFormModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectWorkflowFormModel => {
  const ProjectWorkflowForm = sequelize.define("ProjectWorkflowForm", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    milestoneId: { type: dataTypes.UUID, allowNull: true },
    taskId: { type: dataTypes.UUID, allowNull: true },
    fileAssetId: { type: dataTypes.UUID, allowNull: true },
    approvalRequestId: { type: dataTypes.UUID, allowNull: true },
    formKey: { type: dataTypes.STRING(120), allowNull: false },
    formName: { type: dataTypes.STRING(255), allowNull: false },
    workflowGroup: { type: dataTypes.STRING(80), allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" },
    submittedByUserId: { type: dataTypes.UUID, allowNull: true },
    reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
    submittedAt: { type: dataTypes.DATE, allowNull: true },
    reviewedAt: { type: dataTypes.DATE, allowNull: true },
    archivedAt: { type: dataTypes.DATE, allowNull: true },
    data: { type: dataTypes.JSONB, defaultValue: {} },
    adapters: { type: dataTypes.JSONB, defaultValue: {} },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_workflow_forms", timestamps: true, paranoid: true }) as ProjectWorkflowFormModel;

  ProjectWorkflowForm.associate = (models: any) => {
    models.ProjectWorkflowForm.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectWorkflowForm.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ProjectWorkflowForm.belongsTo(models.ProjectMilestone, { foreignKey: "milestoneId", as: "milestone" });
    models.ProjectWorkflowForm.belongsTo(models.ProjectTask, { foreignKey: "taskId", as: "task" });
    if (models.FileAsset) models.ProjectWorkflowForm.belongsTo(models.FileAsset, { foreignKey: "fileAssetId", as: "file" });
    if (models.ApprovalRequest) models.ProjectWorkflowForm.belongsTo(models.ApprovalRequest, { foreignKey: "approvalRequestId", as: "approvalRequest" });
    if (models.User) {
      models.ProjectWorkflowForm.belongsTo(models.User, { foreignKey: "submittedByUserId", as: "submitter" });
      models.ProjectWorkflowForm.belongsTo(models.User, { foreignKey: "reviewedByUserId", as: "reviewer" });
    }
  };

  return ProjectWorkflowForm;
};
