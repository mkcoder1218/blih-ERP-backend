"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const OnboardingTask = sequelize.define("OnboardingTask", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        employeeUserId: { type: dataTypes.UUID, allowNull: false },
        assignedToUserId: { type: dataTypes.UUID, allowNull: true },
        title: { type: dataTypes.STRING(255), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        category: { type: dataTypes.STRING(100), defaultValue: 'general' }, // IT, HR, Training
        dueDate: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: 'pending' }, // pending, in_progress, completed
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "hr_onboarding_tasks", timestamps: true, paranoid: true });
    OnboardingTask.associate = (models) => {
        models.OnboardingTask.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User) {
            models.OnboardingTask.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
            models.OnboardingTask.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignee" });
        }
    };
    return OnboardingTask;
};
