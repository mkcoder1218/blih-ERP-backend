"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const OKREvaluation = sequelize.define("OKREvaluation", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        objectiveId: { type: dataTypes.UUID, allowNull: false },
        evaluatedByUserId: { type: dataTypes.UUID, allowNull: false },
        score: { type: dataTypes.FLOAT, allowNull: false },
        rating: { type: dataTypes.STRING(50), allowNull: true },
        summary: { type: dataTypes.TEXT, allowNull: true },
        recommendation: { type: dataTypes.TEXT, allowNull: true },
        evaluationData: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "okr_evaluations", timestamps: true, paranoid: true });
    OKREvaluation.associate = (models) => {
        models.OKREvaluation.belongsTo(models.Business, { foreignKey: "businessId" });
        models.OKREvaluation.belongsTo(models.Objective, { foreignKey: "objectiveId" });
        if (models.User)
            models.OKREvaluation.belongsTo(models.User, { foreignKey: "evaluatedByUserId", as: "evaluator" });
    };
    return OKREvaluation;
};
