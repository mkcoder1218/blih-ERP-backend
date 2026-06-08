import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type HREventModel = ModelStatic<any> & { associate?: (models: any) => void };

/**
 * HREvent — company calendar events
 * Types: birthday | work_anniversary | promotion | holiday | company_event | other
 * Visibility: all | department | individual
 */
export default (sequelize: Sequelize, dataTypes: typeof DataTypes): HREventModel => {
  const HREvent = sequelize.define(
    "HREvent",
    {
      id:            { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId:    { type: dataTypes.UUID, allowNull: false },
      createdByUserId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId:  { type: dataTypes.UUID, allowNull: true },  // null = company-wide
      departmentId:    { type: dataTypes.UUID, allowNull: true },  // null = all departments
      eventType: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "company_event",
        // birthday | work_anniversary | promotion | holiday | company_event | other
      },
      title:       { type: dataTypes.STRING(255), allowNull: false },
      description: { type: dataTypes.TEXT,        allowNull: true },
      eventDate:   { type: dataTypes.DATEONLY,    allowNull: false },
      endDate:     { type: dataTypes.DATEONLY,    allowNull: true },  // for multi-day events
      isRecurring: { type: dataTypes.BOOLEAN,     defaultValue: false },  // annually recurring
      visibility:  { type: dataTypes.STRING(20),  defaultValue: "all" }, // all | department | individual
      emoji:       { type: dataTypes.STRING(10),  allowNull: true },
      color:       { type: dataTypes.STRING(100),  allowNull: true },  // gradient color key
      metadata:    { type: dataTypes.JSONB,       defaultValue: {} },
    },
    { tableName: "hr_events", timestamps: true, paranoid: true }
  ) as HREventModel;

  HREvent.associate = (models: any) => {
    models.HREvent.belongsTo(models.Business,   { foreignKey: "businessId" });
    if (models.User) {
      models.HREvent.belongsTo(models.User, { foreignKey: "createdByUserId", as: "creator" });
      models.HREvent.belongsTo(models.User, { foreignKey: "employeeUserId",  as: "employee" });
    }
    if (models.Department) {
      models.HREvent.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
    }
  };

  return HREvent;
};
