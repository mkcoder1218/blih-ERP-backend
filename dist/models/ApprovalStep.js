"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ApprovalStep = sequelize.define("ApprovalStep", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        workflowId: { type: dataTypes.UUID, allowNull: false },
        stepOrder: { type: dataTypes.INTEGER, allowNull: false },
        approverType: { type: dataTypes.STRING(50), allowNull: false }, // user, role, department
        approverRoleId: { type: dataTypes.UUID, allowNull: true },
        approverUserId: { type: dataTypes.UUID, allowNull: true },
        approverDepartmentId: { type: dataTypes.UUID, allowNull: true },
        actionRequired: { type: dataTypes.STRING(50), defaultValue: "any" }, // any, all
        isFinalStep: { type: dataTypes.BOOLEAN, defaultValue: false },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "approval_steps", timestamps: true, paranoid: true });
    ApprovalStep.associate = (models) => {
        models.ApprovalStep.belongsTo(models.ApprovalWorkflow, { foreignKey: "workflowId", as: "workflow" });
        models.ApprovalStep.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return ApprovalStep;
};
