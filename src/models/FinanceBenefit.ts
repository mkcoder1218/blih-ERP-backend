import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FinanceBenefitModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FinanceBenefitModel => {
  const FinanceBenefit = sequelize.define("FinanceBenefit", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    name: { type: dataTypes.STRING(160), allowNull: false },
    category: { type: dataTypes.STRING(80), allowNull: false },
    monthlyBudget: { type: dataTypes.FLOAT, defaultValue: 0 },
    annualBudget: { type: dataTypes.FLOAT, defaultValue: 0 },
    employerSharePercent: { type: dataTypes.FLOAT, allowNull: true },
    employeeSharePercent: { type: dataTypes.FLOAT, allowNull: true },
    perEmployeeMax: { type: dataTypes.FLOAT, allowNull: true },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_benefits", timestamps: true, paranoid: true }) as FinanceBenefitModel;

  FinanceBenefit.associate = (models: any) => {
    FinanceBenefit.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.Department) FinanceBenefit.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
    FinanceBenefit.hasMany(models.FinanceBenefitEnrollment, { foreignKey: "benefitId", as: "enrollments" });
  };

  return FinanceBenefit;
};
