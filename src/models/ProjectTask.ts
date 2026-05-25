
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectTaskModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectTaskModel => {
  const ProjectTask = sequelize.define("ProjectTask", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    milestoneId: { type: dataTypes.UUID, allowNull: true },
    assignedToUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    priority: { type: dataTypes.STRING(50), defaultValue: "normal" }, // low, normal, high, urgent
    status: { type: dataTypes.STRING(50), defaultValue: "todo" }, // todo, in_progress, review, done
    startDate: { type: dataTypes.DATEONLY, allowNull: true },
    dueDate: { type: dataTypes.DATEONLY, allowNull: true },
    estimatedHours: { type: dataTypes.FLOAT, defaultValue: 0 },
    actualHours: { type: dataTypes.FLOAT, defaultValue: 0 },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_tasks", timestamps: true, paranoid: true }) as ProjectTaskModel;

  ProjectTask.associate = (models: any) => {
    models.ProjectTask.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectTask.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ProjectTask.belongsTo(models.ProjectMilestone, { foreignKey: "milestoneId" });
    if(models.User) models.ProjectTask.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignee" });
  };
  return ProjectTask;
};