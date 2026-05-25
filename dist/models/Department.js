"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Department = sequelize.define("Department", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        name: { type: dataTypes.STRING(120), allowNull: false },
        key: { type: dataTypes.STRING(120), allowNull: false },
        description: { type: dataTypes.STRING, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        parentDepartmentId: { type: dataTypes.UUID, allowNull: true }
    }, { tableName: "departments", timestamps: true, paranoid: true });
    Department.associate = (models) => {
        models.Department.belongsTo(models.Business, { foreignKey: "businessId" });
        models.Department.hasMany(models.Position, { foreignKey: "departmentId" });
        models.Department.belongsTo(models.Department, { as: "parentDepartment", foreignKey: "parentDepartmentId" });
        models.Department.hasMany(models.BusinessUserProfile, { foreignKey: "departmentId" });
    };
    return Department;
};
