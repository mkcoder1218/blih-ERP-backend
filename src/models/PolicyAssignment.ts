import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyAssignmentModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyAssignmentModel => {
  const PolicyAssignment = sequelize.define(
    "PolicyAssignment",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      policyId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      policyVersionId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      subjectType: {
        type: dataTypes.STRING(40),
        allowNull: false, // COMPANY, DEPARTMENT, POSITION, ROLE, EMPLOYEE
      },
      subjectId: {
        type: dataTypes.STRING(255),
        allowNull: false, // Normalized to 'ALL' for COMPANY
        defaultValue: "ALL",
      },
      assignmentType: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "INCLUDE", // INCLUDE, EXCLUDE
      },
      isRequired: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      requiresAcceptance: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      requiresSignature: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      dueAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      assignedAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
      },
      assignedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "policy_assignments",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId"] },
        { fields: ["policyId"] },
        { fields: ["policyVersionId"] },
        { fields: ["subjectType", "subjectId"] },
      ],
    }
  ) as PolicyAssignmentModel;

  PolicyAssignment.associate = (models: any) => {
    if (models.Business) {
      PolicyAssignment.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.Policy) {
      PolicyAssignment.belongsTo(models.Policy, { foreignKey: "policyId" });
    }
    if (models.PolicyVersion) {
      PolicyAssignment.belongsTo(models.PolicyVersion, { foreignKey: "policyVersionId" });
    }
    if (models.User) {
      PolicyAssignment.belongsTo(models.User, { foreignKey: "assignedByUserId", as: "assignedBy" });
    }
  };

  return PolicyAssignment;
};
