"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const PerformanceReview = sequelize.define("PerformanceReview", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        employeeUserId: { type: dataTypes.UUID, allowNull: false },
        reviewerUserId: { type: dataTypes.UUID, allowNull: false },
        periodType: { type: dataTypes.STRING(50) }, // annual, quarterly, probation
        periodStart: { type: dataTypes.DATE, allowNull: false },
        periodEnd: { type: dataTypes.DATE, allowNull: false },
        score: { type: dataTypes.FLOAT, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: 'draft' }, // draft, reviewed, acknowledged, finalized
        reviewData: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "hr_performance_reviews", timestamps: true, paranoid: true });
    PerformanceReview.associate = (models) => {
        models.PerformanceReview.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User) {
            models.PerformanceReview.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
            models.PerformanceReview.belongsTo(models.User, { foreignKey: "reviewerUserId", as: "reviewer" });
        }
    };
    return PerformanceReview;
};
