import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyAcceptanceModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyAcceptanceModel => {
  const PolicyAcceptance = sequelize.define(
    "PolicyAcceptance",
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
      userId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      employeeId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      policyVersion: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "pending", // pending, viewed, accepted, signed, overdue, revoked, superseded
      },
      assignedAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
      },
      dueAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      viewedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      acceptedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      signedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      acceptanceMethod: {
        type: dataTypes.STRING(40),
        allowNull: true, // checkbox, typed_name, drawn_signature, system_import
      },
      signatureType: {
        type: dataTypes.STRING(40),
        allowNull: true,
      },
      typedSignatureName: {
        type: dataTypes.STRING(255),
        allowNull: true,
      },
      signatureAttachmentId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      signatureStrokeData: {
        type: dataTypes.JSONB,
        allowNull: true,
      },
      signatureHash: {
        type: dataTypes.STRING(64),
        allowNull: true,
      },
      ipAddress: {
        type: dataTypes.STRING(80),
        allowNull: true,
      },
      userAgent: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      acceptedContentHash: {
        type: dataTypes.STRING(64),
        allowNull: true,
      },
      metadata: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "policy_acceptances",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["policyId"] },
        { fields: ["policyVersionId"] },
        { fields: ["userId"] },
        { fields: ["employeeId"] },
        { fields: ["businessId"] },
        { fields: ["status"] },
        { fields: ["dueAt"] },
      ],
    }
  ) as PolicyAcceptanceModel;

  PolicyAcceptance.associate = (models: any) => {
    if (models.Policy) {
      PolicyAcceptance.belongsTo(models.Policy, { foreignKey: "policyId" });
    }
    if (models.PolicyVersion) {
      PolicyAcceptance.belongsTo(models.PolicyVersion, { foreignKey: "policyVersionId" });
    }
    if (models.User) {
      PolicyAcceptance.belongsTo(models.User, { foreignKey: "userId" });
    }
    if (models.EmployeeRecord) {
      PolicyAcceptance.belongsTo(models.EmployeeRecord, { foreignKey: "employeeId" });
    }
    if (models.Business) {
      PolicyAcceptance.belongsTo(models.Business, { foreignKey: "businessId" });
    }
  };

  return PolicyAcceptance;
};
