import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PromotionRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PromotionRequestModel => {
  const PromotionRequest = sequelize.define(
    "PromotionRequest",
    {
      id:                { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId:        { type: dataTypes.UUID, allowNull: false },
      employeeUserId:    { type: dataTypes.UUID, allowNull: false },
      requestedByUserId: { type: dataTypes.UUID, allowNull: true },
      currentTitle:      { type: dataTypes.STRING(255), allowNull: false },
      targetTitle:       { type: dataTypes.STRING(255), allowNull: false },
      department:        { type: dataTypes.STRING(255), allowNull: true },
      justification:     { type: dataTypes.TEXT, allowNull: false },
      kpiScore:          { type: dataTypes.FLOAT, allowNull: true },
      yearsInRole:       { type: dataTypes.FLOAT, allowNull: true },
      effectiveDate:     { type: dataTypes.DATEONLY, allowNull: true },
      approvalStage:     {
        type: dataTypes.STRING(50),
        defaultValue: "department_head",  // department_head → admin → approved
      },
      status:            { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, cancelled
      deptHeadComment:   { type: dataTypes.TEXT, allowNull: true },
      adminComment:      { type: dataTypes.TEXT, allowNull: true },
      rejectionReason:   { type: dataTypes.TEXT, allowNull: true },
      metadata:          { type: dataTypes.JSONB, defaultValue: {} },
    },
    { tableName: "hr_promotion_requests", timestamps: true, paranoid: true }
  ) as PromotionRequestModel;

  PromotionRequest.associate = (models: any) => {
    models.PromotionRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) {
      models.PromotionRequest.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
      models.PromotionRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    }
  };

  return PromotionRequest;
};
