import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TaskCommentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TaskCommentModel => {
  const TaskComment = sequelize.define("TaskComment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    taskId: { type: dataTypes.UUID, allowNull: false },
    authorEmployeeId: { type: dataTypes.UUID, allowNull: false },
    body: { type: dataTypes.TEXT, allowNull: false },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_task_comments", timestamps: true, paranoid: true }) as TaskCommentModel;

  TaskComment.associate = (models: any) => {
    models.TaskComment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.TaskComment.belongsTo(models.Project, { foreignKey: "projectId" });
    models.TaskComment.belongsTo(models.ProjectTask, { foreignKey: "taskId" });
    models.TaskComment.belongsTo(models.EmployeeRecord, { foreignKey: "authorEmployeeId", as: "author" });
  };

  return TaskComment;
};
