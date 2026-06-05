import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AttendanceRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AttendanceRequestModel => {
  const AttendanceRequest = sequelize.define(
    "AttendanceRequest",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId: { type: dataTypes.UUID, allowNull: false },
      requestType: { type: dataTypes.STRING(40), allowNull: false }, // work_from_home | memo_log
      category: { type: dataTypes.STRING(120), allowNull: true },
      title: { type: dataTypes.STRING(255), allowNull: false },
      reason: { type: dataTypes.TEXT, allowNull: false },
      fromAt: { type: dataTypes.DATE, allowNull: true },
      toAt: { type: dataTypes.DATE, allowNull: true },
      durationMinutes: { type: dataTypes.INTEGER, allowNull: true },
      status: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "pending" },
      actionedAt: { type: dataTypes.DATE, allowNull: true },
      actionedByUserId: { type: dataTypes.UUID, allowNull: true },
      actionNote: { type: dataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "attendance_requests",
      timestamps: true,
      paranoid: true,
    }
  ) as AttendanceRequestModel;

  AttendanceRequest.associate = (models: any) => {
    models.AttendanceRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.AttendanceRequest.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    models.AttendanceRequest.belongsTo(models.User, { foreignKey: "actionedByUserId", as: "actionedBy" });
  };

  return AttendanceRequest;
};
