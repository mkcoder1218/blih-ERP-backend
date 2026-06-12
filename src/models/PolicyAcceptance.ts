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
      policyId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      userId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      policyVersion: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },
      acceptedAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW,
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
        { fields: ["userId"] },
        { fields: ["businessId"] },
        { unique: true, fields: ["policyId", "userId"] },
      ],
    }
  ) as PolicyAcceptanceModel;

  PolicyAcceptance.associate = (models: any) => {
    if (models.Policy) {
      PolicyAcceptance.belongsTo(models.Policy, { foreignKey: "policyId" });
    }
    if (models.User) {
      PolicyAcceptance.belongsTo(models.User, { foreignKey: "userId" });
    }
    if (models.Business) {
      PolicyAcceptance.belongsTo(models.Business, { foreignKey: "businessId" });
    }
  };

  return PolicyAcceptance;
};
