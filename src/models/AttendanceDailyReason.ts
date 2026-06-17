import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AttendanceDailyReasonModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AttendanceDailyReasonModel => {
  const AttendanceDailyReason = sequelize.define(
    "AttendanceDailyReason",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeId: { type: dataTypes.UUID, allowNull: false },
      dateYmd: { type: dataTypes.STRING(10), allowNull: false },
      reasonType: { type: dataTypes.STRING(30), allowNull: false },
      lateReasonId: { type: dataTypes.UUID, allowNull: true },
      comment: { type: dataTypes.STRING(1000), allowNull: true },
      source: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "erp" },
      attendanceEventId: { type: dataTypes.UUID, allowNull: true }
    },
    {
      tableName: "attendance_daily_reasons",
      timestamps: true
    }
  ) as AttendanceDailyReasonModel;

  AttendanceDailyReason.associate = (models: any) => {
    AttendanceDailyReason.belongsTo(models.Business, { foreignKey: "businessId" });
    AttendanceDailyReason.belongsTo(models.User, { foreignKey: "employeeId", as: "employee" });
    AttendanceDailyReason.belongsTo(models.AttendanceLateReason, { foreignKey: "lateReasonId", as: "lateReason" });
    AttendanceDailyReason.belongsTo(models.AttendanceEvent, { foreignKey: "attendanceEventId", as: "event" });
  };

  return AttendanceDailyReason;
};
