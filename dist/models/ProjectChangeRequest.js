"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ProjectChangeRequest = sequelize.define("ProjectChangeRequest", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        projectId: { type: dataTypes.UUID, allowNull: false },
        requestedByUserId: { type: dataTypes.UUID, allowNull: false },
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: false },
        impactOnCost: { type: dataTypes.FLOAT, defaultValue: 0 },
        impactOnTimeline: { type: dataTypes.INTEGER, defaultValue: 0, comment: 'days' },
        priority: { type: dataTypes.STRING(50), defaultValue: "normal" },
        status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, implemented
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "project_change_requests", timestamps: true, paranoid: true });
    ProjectChangeRequest.associate = (models) => {
        models.ProjectChangeRequest.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ProjectChangeRequest.belongsTo(models.Project, { foreignKey: "projectId" });
        if (models.User) {
            models.ProjectChangeRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
        }
    };
    return ProjectChangeRequest;
};
