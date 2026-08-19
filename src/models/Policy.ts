import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyModel => {
  const Policy = sequelize.define(
    "Policy",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      categoryId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      policyType: {
        type: dataTypes.STRING(120),
        allowNull: false,
        defaultValue: "GENERAL",
      },
      title: {
        type: dataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },
      summary: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      contentHtml: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      contentJson: {
        type: dataTypes.JSONB,
        allowNull: true,
      },
      contentText: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      version: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      versionLabel: {
        type: dataTypes.STRING(80),
        allowNull: true,
      },
      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "draft",
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
      requiresReacceptanceOnUpdate: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      effectiveFrom: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      effectiveUntil: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      reviewDueAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      publishedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      archivedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      ownerUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      ownerDepartmentId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      createdById: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      updatedById: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      submittedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      reviewedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      approvedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      publishedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      archivedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      submittedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      reviewedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      approvedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      appliesToAllEmployees: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      publicShareEnabled: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      supersededByPolicyId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      supersededByVersionId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      acceptanceCount: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      metadata: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "policies",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId"] },
        { fields: ["categoryId"] },
        { fields: ["policyType", "status"] },
        { fields: ["slug"] },
        { fields: ["status"] },
        { fields: ["visibility"] },
        { fields: ["ownerUserId"] },
        { fields: ["effectiveFrom"] },
        { fields: ["effectiveUntil"] },
        { fields: ["reviewDueAt"] },
        { fields: ["publishedAt"] },
      ],
    }
  ) as PolicyModel;

  Policy.associate = (models: any) => {
    if (models.Business) {
      Policy.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.PolicyCategory) {
      Policy.belongsTo(models.PolicyCategory, { foreignKey: "categoryId", as: "category" });
    }
    if (models.User) {
      Policy.belongsTo(models.User, { foreignKey: "createdById", as: "createdBy" });
      Policy.belongsTo(models.User, { foreignKey: "updatedById", as: "updatedBy" });
      Policy.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
    }
    if (models.Department) {
      Policy.belongsTo(models.Department, { foreignKey: "ownerDepartmentId", as: "ownerDepartment" });
    }
    if (models.PolicyAcceptance) {
      Policy.hasMany(models.PolicyAcceptance, { foreignKey: "policyId", as: "acceptances" });
    }
    if (models.PolicyVersion) {
      Policy.hasMany(models.PolicyVersion, { foreignKey: "policyId", as: "versions" });
    }
    if (models.PolicyAssignment) {
      Policy.hasMany(models.PolicyAssignment, { foreignKey: "policyId", as: "assignments" });
    }
  };

  return Policy;
};
