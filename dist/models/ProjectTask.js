"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ProjectTask = sequelize.define("ProjectTask", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        projectId: { type: dataTypes.UUID, allowNull: false },
        milestoneId: { type: dataTypes.UUID, allowNull: true },
        assigneeEmployeeId: { type: dataTypes.UUID, allowNull: true },
        assignedToUserId: { type: dataTypes.UUID, allowNull: true },
        code: { type: dataTypes.STRING(60), allowNull: true },
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        priority: { type: dataTypes.STRING(50), defaultValue: "MEDIUM" },
        status: { type: dataTypes.STRING(50), defaultValue: "TODO" },
        startDate: { type: dataTypes.DATEONLY, allowNull: true },
        dueDate: { type: dataTypes.DATEONLY, allowNull: true },
        weight: { type: dataTypes.FLOAT, defaultValue: 1 },
        estimatedHours: { type: dataTypes.FLOAT, defaultValue: 0 },
        actualHours: { type: dataTypes.FLOAT, defaultValue: 0 },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "project_tasks", timestamps: true, paranoid: true });
    ProjectTask.associate = (models) => {
        models.ProjectTask.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ProjectTask.belongsTo(models.Project, { foreignKey: "projectId" });
        models.ProjectTask.belongsTo(models.ProjectMilestone, { foreignKey: "milestoneId" });
        if (models.EmployeeRecord)
            models.ProjectTask.belongsTo(models.EmployeeRecord, { foreignKey: "assigneeEmployeeId", as: "employeeAssignee" });
        if (models.User)
            models.ProjectTask.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignee" });
        if (models.TaskComment)
            models.ProjectTask.hasMany(models.TaskComment, { foreignKey: "taskId", as: "comments" });
        if (models.ProjectActivityLog)
            models.ProjectTask.hasMany(models.ProjectActivityLog, { foreignKey: "taskId", as: "activityLogs" });
    };
    return ProjectTask;
};
