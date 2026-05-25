
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PerformanceReviewModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PerformanceReviewModel => {
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
  }, { tableName: "hr_performance_reviews", timestamps: true, paranoid: true }) as PerformanceReviewModel;

  PerformanceReview.associate = (models: any) => {
    models.PerformanceReview.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.PerformanceReview.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.PerformanceReview.belongsTo(models.User, { foreignKey: "reviewerUserId", as: "reviewer" });
    }
  };
  return PerformanceReview;
};
