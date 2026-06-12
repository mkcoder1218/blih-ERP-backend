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
      policyType: {
        type: dataTypes.STRING(120),
        allowNull: false,
      },
      title: {
        type: dataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },
      version: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "draft",
      },
      isRequired: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      publishedAt: {
        type: dataTypes.DATE,
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
      createdById: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      updatedById: {
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
        { fields: ["policyType", "status"] },
        { fields: ["slug"] },
      ],
    }
  ) as PolicyModel;

  Policy.associate = (models: any) => {
    if (models.Business) {
      Policy.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.User) {
      Policy.belongsTo(models.User, { foreignKey: "createdById", as: "createdBy" });
      Policy.belongsTo(models.User, { foreignKey: "updatedById", as: "updatedBy" });
    }
    if (models.PolicyAcceptance) {
      Policy.hasMany(models.PolicyAcceptance, { foreignKey: "policyId", as: "acceptances" });
    }
  };

  return Policy;
};
