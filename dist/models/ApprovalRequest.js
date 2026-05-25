"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ApprovalRequest = sequelize.define("ApprovalRequest", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        workflowId: { type: dataTypes.UUID, allowNull: false },
        entityType: { type: dataTypes.STRING(120), allowNull: false },
        entityId: { type: dataTypes.STRING(120), allowNull: false },
        requestedByUserId: { type: dataTypes.UUID, allowNull: false },
        currentStepId: { type: dataTypes.UUID, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, returned, cancelled
        submittedData: { type: dataTypes.JSONB, defaultValue: {} },
        finalDecision: { type: dataTypes.STRING(50), allowNull: true },
        completedAt: { type: dataTypes.DATE, allowNull: true }
    }, { tableName: "approval_requests", timestamps: true, paranoid: true });
    ApprovalRequest.associate = (models) => {
        models.ApprovalRequest.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ApprovalRequest.belongsTo(models.ApprovalWorkflow, { foreignKey: "workflowId", as: "workflow" });
        models.ApprovalRequest.belongsTo(models.ApprovalStep, { foreignKey: "currentStepId", as: "currentStep" });
        models.ApprovalRequest.hasMany(models.ApprovalAction, { foreignKey: "approvalRequestId", as: "actions" });
    };
    return ApprovalRequest;
};
