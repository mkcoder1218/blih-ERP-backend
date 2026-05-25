
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EmployeeRecordModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EmployeeRecordModel => {
  const EmployeeRecord = sequelize.define("EmployeeRecord", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: false, unique: true },
    employeeCode: { type: dataTypes.STRING(50), allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    positionId: { type: dataTypes.UUID, allowNull: true },
    managerUserId: { type: dataTypes.UUID, allowNull: true },
    employmentType: { type: dataTypes.STRING(50) }, // full_time, part_time, contractor
    employmentStatus: { type: dataTypes.STRING(50), defaultValue: 'active' }, // active, suspended, terminated, resigned
    hireDate: { type: dataTypes.DATE, allowNull: false },
    probationEndDate: { type: dataTypes.DATE, allowNull: true },
    contractEndDate: { type: dataTypes.DATE, allowNull: true },
    salaryInfo: { type: dataTypes.JSONB, defaultValue: {} },
    emergencyContact: { type: dataTypes.JSONB, defaultValue: {} },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_employee_records", timestamps: true, paranoid: true }) as EmployeeRecordModel;

  EmployeeRecord.associate = (models: any) => {
    models.EmployeeRecord.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) {
       models.EmployeeRecord.belongsTo(models.User, { foreignKey: "userId", as: "user" });
       models.EmployeeRecord.belongsTo(models.User, { foreignKey: "managerUserId", as: "manager" });
    }
  };
  return EmployeeRecord;
};
