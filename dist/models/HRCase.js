"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const HRCase = sequelize.define("HRCase", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        employeeUserId: { type: dataTypes.UUID, allowNull: false },
        reportedByUserId: { type: dataTypes.UUID, allowNull: false },
        caseType: { type: dataTypes.STRING(50), allowNull: false }, // grievance, performance, disciplinary
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: false },
        status: { type: dataTypes.STRING(50), defaultValue: 'open' }, // open, investigating, resolved, closed
        priority: { type: dataTypes.STRING(50), defaultValue: 'medium' }, // low, medium, high, critical
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "hr_cases", timestamps: true, paranoid: true });
    HRCase.associate = (models) => {
        models.HRCase.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User) {
            models.HRCase.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
            models.HRCase.belongsTo(models.User, { foreignKey: "reportedByUserId", as: "reporter" });
        }
    };
    return HRCase;
};
