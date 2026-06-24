"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const employee_constants_1 = require("../constants/employee.constants");
exports.default = (sequelize, dataTypes) => {
    const EmployeeRecord = sequelize.define("EmployeeRecord", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false, unique: true },
        employeeCode: { type: dataTypes.STRING(50), allowNull: false },
        departmentId: { type: dataTypes.UUID, allowNull: true },
        positionId: { type: dataTypes.UUID, allowNull: true },
        managerUserId: { type: dataTypes.UUID, allowNull: true },
        employmentType: { type: dataTypes.STRING(50), allowNull: true, defaultValue: employee_constants_1.DEFAULT_EMPLOYMENT_TYPE },
        employmentCategory: { type: dataTypes.STRING(50), allowNull: true },
        assignedStartTime: { type: dataTypes.STRING(5), allowNull: false, defaultValue: "09:00" },
        scheduledWorkDays: { type: dataTypes.JSONB, allowNull: false, defaultValue: [1, 2, 3, 4, 5] },
        employmentStatus: { type: dataTypes.STRING(50), allowNull: false, defaultValue: employee_constants_1.DEFAULT_EMPLOYMENT_STATUS },
        hireDate: { type: dataTypes.DATE, allowNull: false },
        contractStartDate: { type: dataTypes.DATE, allowNull: true },
        probationEndDate: { type: dataTypes.DATE, allowNull: true },
        contractEndDate: { type: dataTypes.DATE, allowNull: true },
        salaryInfo: { type: dataTypes.JSONB, defaultValue: {} },
        emergencyContact: { type: dataTypes.JSONB, defaultValue: {} },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "hr_employee_records", timestamps: true, paranoid: true });
    EmployeeRecord.associate = (models) => {
        models.EmployeeRecord.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User) {
            models.EmployeeRecord.belongsTo(models.User, { foreignKey: "userId", as: "user" });
            models.EmployeeRecord.belongsTo(models.User, { foreignKey: "managerUserId", as: "manager" });
        }
        if (models.Department) {
            models.EmployeeRecord.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
        }
        if (models.Position) {
            models.EmployeeRecord.belongsTo(models.Position, { foreignKey: "positionId", as: "position" });
        }
    };
    return EmployeeRecord;
};
