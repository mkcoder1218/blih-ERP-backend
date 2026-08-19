import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyVersionModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyVersionModel => {
  const PolicyVersion = sequelize.define(
    "PolicyVersion",
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
      version: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      versionLabel: {
        type: dataTypes.STRING(80),
        allowNull: true,
      },
      title: {
        type: dataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },
      policyType: {
        type: dataTypes.STRING(120),
        allowNull: false,
      },
      summary: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      contentHtml: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      contentJson: {
        type: dataTypes.JSONB,
        allowNull: true,
      },
      contentText: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      contentHash: {
        type: dataTypes.STRING(64),
        allowNull: false,
      },
      visibility: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "company",
      },
      confidentialityLevel: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "normal",
      },
      effectiveFrom: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      effectiveUntil: {
        type: dataTypes.DATE,
        allowNull: true,
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
      assignmentSnapshot: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      metadataSnapshot: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      statusAtCreation: {
        type: dataTypes.STRING(40),
        allowNull: false,
      },
      action: {
        type: dataTypes.STRING(60),
        allowNull: false,
      },
      changeSummary: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      reviewComment: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      restoredFromVersionId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      supersedesVersionId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "policy_versions",
      timestamps: true,
      updatedAt: false,
      paranoid: false,
      hooks: {
        beforeUpdate: () => {
          throw new Error("PolicyVersion records are strictly immutable and cannot be updated");
        },
        beforeDestroy: () => {
          throw new Error("PolicyVersion records are strictly immutable and cannot be deleted");
        },
      },
      indexes: [
        { fields: ["businessId"] },
        { fields: ["policyId"] },
        { unique: true, fields: ["policyId", "version"] },
        { fields: ["statusAtCreation"] },
        { fields: ["createdAt"] },
      ],
    }
  ) as PolicyVersionModel;

  PolicyVersion.associate = (models: any) => {
    if (models.Business) {
      PolicyVersion.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.Policy) {
      PolicyVersion.belongsTo(models.Policy, { foreignKey: "policyId" });
    }
    if (models.User) {
      PolicyVersion.belongsTo(models.User, { foreignKey: "createdByUserId", as: "createdBy" });
    }
  };

  return PolicyVersion;
};
