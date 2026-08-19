import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyNotificationLogModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyNotificationLogModel => {
  const PolicyNotificationLog = sequelize.define(
    "PolicyNotificationLog",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: false
      },
      jobKey: {
        type: dataTypes.STRING(120),
        allowNull: false
      },
      reminderType: {
        type: dataTypes.STRING(80),
        allowNull: false
      },
      reminderWindow: {
        type: dataTypes.STRING(40),
        allowNull: false
      },
      recipientUserId: {
        type: dataTypes.UUID,
        allowNull: false
      },
      resourceId: {
        type: dataTypes.UUID,
        allowNull: false
      },
      policyVersionId: {
        type: dataTypes.UUID,
        allowNull: true
      },
      acceptanceId: {
        type: dataTypes.UUID,
        allowNull: true
      },
      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "delivered"
      },
      errorMessage: {
        type: dataTypes.TEXT,
        allowNull: true
      },
      dedupKey: {
        type: dataTypes.STRING(255),
        allowNull: false,
        unique: true
      },
      sentAt: {
        type: dataTypes.DATE,
        allowNull: false,
        defaultValue: dataTypes.NOW
      }
    },
    {
      tableName: "policy_notification_logs",
      timestamps: true,
      updatedAt: false
    }
  ) as PolicyNotificationLogModel;

  PolicyNotificationLog.associate = (models: any) => {
    if (models.Business) {
      PolicyNotificationLog.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.User) {
      PolicyNotificationLog.belongsTo(models.User, { foreignKey: "recipientUserId" });
    }
  };

  return PolicyNotificationLog;
};
