"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Budget = sequelize.define("Budget", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        departmentId: { type: dataTypes.UUID, allowNull: true },
        name: { type: dataTypes.STRING(255), allowNull: false },
        periodType: { type: dataTypes.STRING(50), defaultValue: "annual" },
        periodStart: { type: dataTypes.DATEONLY, allowNull: true },
        periodEnd: { type: dataTypes.DATEONLY, allowNull: true },
        allocatedAmount: { type: dataTypes.FLOAT, defaultValue: 0 },
        usedAmount: { type: dataTypes.FLOAT, defaultValue: 0 },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "finance_budgets", timestamps: true, paranoid: true });
    Budget.associate = (models) => {
        models.Budget.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Department)
            models.Budget.belongsTo(models.Department, { foreignKey: "departmentId" });
    };
    return Budget;
};
