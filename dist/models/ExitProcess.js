"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ExitProcess = sequelize.define("ExitProcess", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        employeeUserId: { type: dataTypes.UUID, allowNull: false },
        initiatedByUserId: { type: dataTypes.UUID, allowNull: false },
        exitType: { type: dataTypes.STRING(50), allowNull: false }, // resignation, termination, redundancy
        reason: { type: dataTypes.TEXT, allowNull: true },
        effectiveDate: { type: dataTypes.DATE, allowNull: false },
        status: { type: dataTypes.STRING(50), defaultValue: 'pending' }, // pending, in_progress, completed, cancelled
        reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
        reviewedAt: { type: dataTypes.DATE, allowNull: true },
        approvalNote: { type: dataTypes.TEXT, allowNull: true },
        rejectionReason: { type: dataTypes.TEXT, allowNull: true },
        accountDisabledAt: { type: dataTypes.DATE, allowNull: true },
        accountDisabledByUserId: { type: dataTypes.UUID, allowNull: true },
        clearanceData: { type: dataTypes.JSONB, defaultValue: {} },
        finalPayData: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "hr_exit_processes", timestamps: true, paranoid: true });
    ExitProcess.associate = (models) => {
        models.ExitProcess.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.ExitClearanceStep) {
            models.ExitProcess.hasMany(models.ExitClearanceStep, { foreignKey: "exitProcessId", as: "clearanceSteps" });
        }
        if (models.ExitInterview) {
            models.ExitProcess.hasMany(models.ExitInterview, { foreignKey: "exitProcessId", as: "exitInterviews" });
        }
        if (models.ExitDocument) {
            models.ExitProcess.hasMany(models.ExitDocument, { foreignKey: "exitProcessId", as: "exitDocuments" });
        }
        if (models.User) {
            models.ExitProcess.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
            models.ExitProcess.belongsTo(models.User, { foreignKey: "initiatedByUserId", as: "initiator" });
            models.ExitProcess.belongsTo(models.User, { foreignKey: "reviewedByUserId", as: "reviewer" });
            models.ExitProcess.belongsTo(models.User, { foreignKey: "accountDisabledByUserId", as: "accountDisabledBy" });
        }
    };
    return ExitProcess;
};
