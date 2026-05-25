
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectModel => {
  const Project = sequelize.define("Project", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: true },
    dealId: { type: dataTypes.UUID, allowNull: true },
    projectManagerUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    code: { type: dataTypes.STRING(50), allowNull: true },
    type: { type: dataTypes.STRING(100), defaultValue: "standard" },
    description: { type: dataTypes.TEXT, allowNull: true },
    startDate: { type: dataTypes.DATEONLY, allowNull: true },
    endDate: { type: dataTypes.DATEONLY, allowNull: true },
    budget: { type: dataTypes.FLOAT, defaultValue: 0 },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // planning, active, on_hold, completed, cancelled
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "projects", timestamps: true, paranoid: true }) as ProjectModel;

  Project.associate = (models: any) => {
    models.Project.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Project.belongsTo(models.User, { foreignKey: "projectManagerUserId", as: "projectManager" });
    if(models.Client) models.Project.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Deal) models.Project.belongsTo(models.Deal, { foreignKey: "dealId" });
    models.Project.hasMany(models.ProjectMilestone, { foreignKey: "projectId" });
    models.Project.hasMany(models.ProjectTask, { foreignKey: "projectId" });
    models.Project.hasMany(models.ProjectIssue, { foreignKey: "projectId" });
  };
  return Project;
};