import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type LeaveTemplateModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): LeaveTemplateModel => {
  const LeaveTemplate = sequelize.define(
    "LeaveTemplate",
    {
      id:          { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId:  { type: dataTypes.UUID, allowNull: false },
      name:        { type: dataTypes.STRING(100), allowNull: false },
      leaveType:   { type: dataTypes.STRING(50),  allowNull: false }, // annual | sick | maternity | paternity | casual | unpaid | custom
      hasAmount:   { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      totalDays:   { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      description: { type: dataTypes.TEXT, allowNull: true },
      requiresEvidence: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      evidenceInstructions: { type: dataTypes.TEXT, allowNull: true },
      isActive:    { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isVisibleForRequest: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isDeprecated: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy:   { type: dataTypes.UUID, allowNull: true },
    },
    { tableName: "leave_templates", timestamps: true, paranoid: true }
  ) as LeaveTemplateModel;

  LeaveTemplate.associate = (models: any) => {
    models.LeaveTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    models.LeaveTemplate.belongsTo(models.User, { foreignKey: "createdBy", as: "creator" });
    models.LeaveTemplate.hasMany(models.LeaveRequest, { foreignKey: "leaveTemplateId", as: "requests" });
  };

  return LeaveTemplate;
};
