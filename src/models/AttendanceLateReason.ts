import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AttendanceLateReasonModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AttendanceLateReasonModel => {
  const AttendanceLateReason = sequelize.define(
    "AttendanceLateReason",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      name: { type: dataTypes.STRING(160), allowNull: false },
      description: { type: dataTypes.STRING(500), allowNull: true },
      isActive: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      requiresComment: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy: { type: dataTypes.UUID, allowNull: false }
    },
    {
      tableName: "attendance_late_reasons",
      timestamps: true
    }
  ) as AttendanceLateReasonModel;

  AttendanceLateReason.associate = (models: any) => {
    models.AttendanceLateReason.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.AttendanceLateReason.belongsTo(models.User, { foreignKey: "createdBy", as: "creator" });
  };

  return AttendanceLateReason;
};

