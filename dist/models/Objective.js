"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Objective = sequelize.define("Objective", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        ownerUserId: { type: dataTypes.UUID, allowNull: true },
        departmentId: { type: dataTypes.UUID, allowNull: true },
        level: { type: dataTypes.STRING(50), defaultValue: "personal" }, // company, department, team, personal
        title: { type: dataTypes.STRING(500), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        periodType: { type: dataTypes.STRING(50), defaultValue: "quarterly" }, // annual, quarterly, monthly
        periodStart: { type: dataTypes.DATEONLY, allowNull: true },
        periodEnd: { type: dataTypes.DATEONLY, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, active, closed, archived
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "okr_objectives", timestamps: true, paranoid: true });
    Objective.associate = (models) => {
        models.Objective.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.Objective.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
        if (models.Department)
            models.Objective.belongsTo(models.Department, { foreignKey: "departmentId" });
        models.Objective.hasMany(models.KeyResult, { foreignKey: "objectiveId", as: "keyResults" });
        models.Objective.hasMany(models.OKRProgressUpdate, { foreignKey: "objectiveId", as: "progressUpdates" });
        models.Objective.hasMany(models.OKREvaluation, { foreignKey: "objectiveId", as: "evaluations" });
    };
    return Objective;
};
