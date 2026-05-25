"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ProjectIssue = sequelize.define("ProjectIssue", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        projectId: { type: dataTypes.UUID, allowNull: false },
        taskId: { type: dataTypes.UUID, allowNull: true },
        reportedByUserId: { type: dataTypes.UUID, allowNull: false },
        assignedToUserId: { type: dataTypes.UUID, allowNull: true },
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        severity: { type: dataTypes.STRING(50), defaultValue: "medium" }, // low, medium, high, critical
        status: { type: dataTypes.STRING(50), defaultValue: "open" }, // open, investigating, resolved, closed
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "project_issues", timestamps: true, paranoid: true });
    ProjectIssue.associate = (models) => {
        models.ProjectIssue.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ProjectIssue.belongsTo(models.Project, { foreignKey: "projectId" });
        models.ProjectIssue.belongsTo(models.ProjectTask, { foreignKey: "taskId" });
        if (models.User) {
            models.ProjectIssue.belongsTo(models.User, { foreignKey: "reportedByUserId", as: "reporter" });
            models.ProjectIssue.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "issueAssignee" });
        }
    };
    return ProjectIssue;
};
