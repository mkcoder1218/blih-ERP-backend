import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type LeaveRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): LeaveRequestModel => {
  const LeaveRequest = sequelize.define(
    "LeaveRequest",
    {
      id:              { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId:      { type: dataTypes.UUID, allowNull: false },
      employeeUserId:  { type: dataTypes.UUID, allowNull: false },
      leaveTemplateId: { type: dataTypes.UUID, allowNull: false },
      leaveType:       { type: dataTypes.STRING(50), allowNull: false },
      startDate:       { type: dataTypes.DATEONLY, allowNull: false },
      endDate:         { type: dataTypes.DATEONLY, allowNull: false },
      totalDays:       { type: dataTypes.FLOAT, allowNull: false, defaultValue: 1 },
      durationType:    { type: dataTypes.STRING(20), allowNull: false, defaultValue: "FULL_DAY" },
      halfDayPeriod:   { type: dataTypes.STRING(20), allowNull: true },
      requestedDays:   { type: dataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 1 },
      reason:          { type: dataTypes.TEXT, allowNull: false },
      evidenceUrl:     { type: dataTypes.TEXT, allowNull: true },
      evidenceNote:    { type: dataTypes.TEXT, allowNull: true },
      /**
       * 2-stage approval: dept_head → admin → approved
       */
      approvalStage: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "dept_head",
        // dept_head | admin | approved | rejected | cancelled
      },
      status: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "pending",
        // pending | approved | rejected | cancelled
      },
      // Dept head stage
      deptHeadApprovedBy: { type: dataTypes.UUID, allowNull: true },
      deptHeadActionAt:   { type: dataTypes.DATE, allowNull: true },
      deptHeadComment:    { type: dataTypes.TEXT, allowNull: true },
      // Business admin first-stage approval
      businessAdminApprovedBy: { type: dataTypes.UUID, allowNull: true },
      businessAdminActionAt:   { type: dataTypes.DATE, allowNull: true },
      businessAdminComment:    { type: dataTypes.TEXT, allowNull: true },
      // Admin stage
      adminApprovedBy:    { type: dataTypes.UUID, allowNull: true },
      adminActionAt:      { type: dataTypes.DATE, allowNull: true },
      adminComment:       { type: dataTypes.TEXT, allowNull: true },
      // Rejection
      rejectedAt:         { type: dataTypes.DATE, allowNull: true },
      rejectedBy:         { type: dataTypes.UUID, allowNull: true },
      rejectionReason:    { type: dataTypes.TEXT, allowNull: true },
    },
    { tableName: "leave_requests", timestamps: true, paranoid: true }
  ) as LeaveRequestModel;

  LeaveRequest.associate = (models: any) => {
    models.LeaveRequest.belongsTo(models.Business,      { foreignKey: "businessId" });
    models.LeaveRequest.belongsTo(models.User,          { foreignKey: "employeeUserId", as: "employee" });
    models.LeaveRequest.belongsTo(models.LeaveTemplate, { foreignKey: "leaveTemplateId", as: "template" });
    models.LeaveRequest.belongsTo(models.User, { foreignKey: "deptHeadApprovedBy", as: "deptHeadApprover" });
    models.LeaveRequest.belongsTo(models.User, { foreignKey: "businessAdminApprovedBy", as: "businessAdminApprover" });
    models.LeaveRequest.belongsTo(models.User, { foreignKey: "adminApprovedBy",    as: "adminApprover"    });
    models.LeaveRequest.belongsTo(models.User, { foreignKey: "rejectedBy",         as: "rejector"         });
  };

  return LeaveRequest;
};
