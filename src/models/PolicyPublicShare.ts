import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyPublicShareModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyPublicShareModel => {
  const PolicyPublicShare = sequelize.define(
    "PolicyPublicShare",
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
      tokenHash: {
        type: dataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },
      enabled: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      expiresAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      revokedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },
      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "policy_public_shares",
      timestamps: true,
      paranoid: false,
      indexes: [
        { unique: true, fields: ["tokenHash"] },
        { fields: ["businessId"] },
        { fields: ["policyId"] },
        { fields: ["policyVersionId"] },
        { fields: ["enabled"] },
      ],
    }
  ) as PolicyPublicShareModel;

  PolicyPublicShare.associate = (models: any) => {
    if (models.Business) {
      PolicyPublicShare.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.Policy) {
      PolicyPublicShare.belongsTo(models.Policy, { foreignKey: "policyId" });
    }
    if (models.PolicyVersion) {
      PolicyPublicShare.belongsTo(models.PolicyVersion, { foreignKey: "policyVersionId" });
    }
    if (models.User) {
      PolicyPublicShare.belongsTo(models.User, { foreignKey: "createdByUserId", as: "createdBy" });
    }
  };

  return PolicyPublicShare;
};
