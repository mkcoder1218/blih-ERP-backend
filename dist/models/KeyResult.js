"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const KeyResult = sequelize.define("KeyResult", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        objectiveId: { type: dataTypes.UUID, allowNull: false },
        title: { type: dataTypes.STRING(500), allowNull: false },
        metric: { type: dataTypes.STRING(120), allowNull: false }, // count, currency, percentage, boolean
        baselineValue: { type: dataTypes.FLOAT, defaultValue: 0 },
        targetValue: { type: dataTypes.FLOAT, allowNull: false },
        currentValue: { type: dataTypes.FLOAT, defaultValue: 0 },
        weight: { type: dataTypes.FLOAT, defaultValue: 1.0 },
        dataSource: { type: dataTypes.STRING(120), defaultValue: "manual" }, // manual, finance, crm, projects
        status: { type: dataTypes.STRING(50), defaultValue: "on_track" }, // on_track, at_risk, off_track, achieved
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "okr_key_results", timestamps: true, paranoid: true });
    KeyResult.associate = (models) => {
        models.KeyResult.belongsTo(models.Business, { foreignKey: "businessId" });
        models.KeyResult.belongsTo(models.Objective, { foreignKey: "objectiveId" });
        models.KeyResult.hasMany(models.OKRProgressUpdate, { foreignKey: "keyResultId" });
    };
    return KeyResult;
};
