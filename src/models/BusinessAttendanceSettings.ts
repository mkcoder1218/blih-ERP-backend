import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessAttendanceSettingsModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessAttendanceSettingsModel => {
  const BusinessAttendanceSettings = sequelize.define(
    "BusinessAttendanceSettings",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false, unique: true },

      attendanceEnabled: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },

      locationName: { type: dataTypes.STRING(160), allowNull: true },
      address: { type: dataTypes.STRING(500), allowNull: true },
      latitude: { type: dataTypes.DECIMAL(10, 7), allowNull: true },
      longitude: { type: dataTypes.DECIMAL(10, 7), allowNull: true },
      allowedRadiusMeters: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 100 },

      timezone: { type: dataTypes.STRING(80), allowNull: false, defaultValue: "UTC" },

      expectedDailyMinutes: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 480 },
      defaultStartTime: { type: dataTypes.STRING(5), allowNull: false, defaultValue: "09:00" },
      defaultEndTime: { type: dataTypes.STRING(5), allowNull: false, defaultValue: "17:00" },
      lateGracePeriodMinutes: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lateNoReasonPenaltyGraceMinutes: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 0 },

      lunchBreakEnabled: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      lunchMode: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "FLEXIBLE" },
      fixedLunchStartTime: { type: dataTypes.STRING(5), allowNull: true },
      fixedLunchEndTime: { type: dataTypes.STRING(5), allowNull: true },
      allowMultipleLunchBreaks: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    {
      tableName: "business_attendance_settings",
      timestamps: true
    }
  ) as BusinessAttendanceSettingsModel;

  BusinessAttendanceSettings.associate = (models: any) => {
    models.BusinessAttendanceSettings.belongsTo(models.Business, { foreignKey: "businessId", as: "business" });
  };

  return BusinessAttendanceSettings;
};
