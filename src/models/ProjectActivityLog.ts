import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectActivityLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectActivityLogModel => {
  const ProjectActivityLog = sequelize.define("ProjectActivityLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    taskId: { type: dataTypes.UUID, allowNull: true },
    actorEmployeeId: { type: dataTypes.UUID, allowNull: true },
    action: { type: dataTypes.STRING(120), allowNull: false },
    entityType: { type: dataTypes.STRING(80), allowNull: false },
    entityId: { type: dataTypes.UUID, allowNull: true },
    before: { type: dataTypes.JSONB, allowNull: true },
    after: { type: dataTypes.JSONB, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_activity_logs", timestamps: true, updatedAt: false }) as ProjectActivityLogModel;

  ProjectActivityLog.associate = (models: any) => {
    models.ProjectActivityLog.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectActivityLog.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ProjectActivityLog.belongsTo(models.ProjectTask, { foreignKey: "taskId" });
    models.ProjectActivityLog.belongsTo(models.EmployeeRecord, { foreignKey: "actorEmployeeId", as: "actor" });
  };

  return ProjectActivityLog;
};
