import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FinanceBenefitEnrollmentModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FinanceBenefitEnrollmentModel => {
  const FinanceBenefitEnrollment = sequelize.define("FinanceBenefitEnrollment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    benefitId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    value: { type: dataTypes.FLOAT, defaultValue: 0 },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    enrolledAt: { type: dataTypes.DATEONLY, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_benefit_enrollments", timestamps: true, paranoid: true }) as FinanceBenefitEnrollmentModel;

  FinanceBenefitEnrollment.associate = (models: any) => {
    FinanceBenefitEnrollment.belongsTo(models.Business, { foreignKey: "businessId" });
    FinanceBenefitEnrollment.belongsTo(models.FinanceBenefit, { foreignKey: "benefitId", as: "benefit" });
    FinanceBenefitEnrollment.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    if (models.Department) FinanceBenefitEnrollment.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
  };

  return FinanceBenefitEnrollment;
};
