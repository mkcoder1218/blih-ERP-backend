import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AttendanceEventModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AttendanceEventModel => {
  const AttendanceEvent = sequelize.define(
    "AttendanceEvent",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeId: { type: dataTypes.UUID, allowNull: false }, // User.id
      type: { type: dataTypes.STRING(20), allowNull: false },
      timestampUtc: { type: dataTypes.DATE, allowNull: false },
      latitude: { type: dataTypes.DECIMAL(10, 7), allowNull: false },
      longitude: { type: dataTypes.DECIMAL(10, 7), allowNull: false },
      distanceMeters: { type: dataTypes.DECIMAL(10, 2), allowNull: false },
      withinAllowedRadius: { type: dataTypes.BOOLEAN, allowNull: false }
    },
    {
      tableName: "attendance_events",
      timestamps: true
    }
  ) as AttendanceEventModel;

  AttendanceEvent.associate = (models: any) => {
    models.AttendanceEvent.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.AttendanceEvent.belongsTo(models.User, { foreignKey: "employeeId", as: "employee" });
  };

  return AttendanceEvent;
};

