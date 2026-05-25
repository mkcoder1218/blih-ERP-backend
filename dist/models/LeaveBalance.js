"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const LeaveBalance = sequelize.define("LeaveBalance", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false },
        leaveType: { type: dataTypes.STRING(50), allowNull: false }, // annual, sick, maternity, unpaid
        totalDays: { type: dataTypes.FLOAT, defaultValue: 0 },
        usedDays: { type: dataTypes.FLOAT, defaultValue: 0 },
        remainingDays: { type: dataTypes.FLOAT, defaultValue: 0 },
        year: { type: dataTypes.INTEGER, allowNull: false }
    }, { tableName: "hr_leave_balances", timestamps: true });
    LeaveBalance.associate = (models) => {
        models.LeaveBalance.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.LeaveBalance.belongsTo(models.User, { foreignKey: "userId" });
    };
    return LeaveBalance;
};
