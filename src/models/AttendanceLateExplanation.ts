import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AttendanceLateExplanationModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AttendanceLateExplanationModel => {
  const AttendanceLateExplanation = sequelize.define(
    "AttendanceLateExplanation",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeId: { type: dataTypes.UUID, allowNull: false },
      attendanceEventId: { type: dataTypes.UUID, allowNull: false, unique: true },
      lateReasonId: { type: dataTypes.UUID, allowNull: true },
      customReason: { type: dataTypes.STRING(800), allowNull: true },
      lateByMinutes: { type: dataTypes.INTEGER, allowNull: false }
    },
    {
      tableName: "attendance_late_explanations",
      timestamps: true
    }
  ) as AttendanceLateExplanationModel;

  AttendanceLateExplanation.associate = (models: any) => {
    models.AttendanceLateExplanation.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.AttendanceLateExplanation.belongsTo(models.User, { foreignKey: "employeeId", as: "employee" });
    if (models.AttendanceEvent) models.AttendanceLateExplanation.belongsTo(models.AttendanceEvent, { foreignKey: "attendanceEventId", as: "event" });
    if (models.AttendanceLateReason) models.AttendanceLateExplanation.belongsTo(models.AttendanceLateReason, { foreignKey: "lateReasonId", as: "reason" });
  };

  return AttendanceLateExplanation;
};

