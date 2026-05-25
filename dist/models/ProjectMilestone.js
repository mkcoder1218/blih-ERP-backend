"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ProjectMilestone = sequelize.define("ProjectMilestone", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        projectId: { type: dataTypes.UUID, allowNull: false },
        name: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        dueDate: { type: dataTypes.DATEONLY, allowNull: true },
        billingPercent: { type: dataTypes.FLOAT, defaultValue: 0 },
        status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, in_progress, completed
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "project_milestones", timestamps: true, paranoid: true });
    ProjectMilestone.associate = (models) => {
        models.ProjectMilestone.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ProjectMilestone.belongsTo(models.Project, { foreignKey: "projectId" });
    };
    return ProjectMilestone;
};
