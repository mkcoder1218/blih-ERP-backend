"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const OKRProgressUpdate = sequelize.define("OKRProgressUpdate", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        objectiveId: { type: dataTypes.UUID, allowNull: false },
        keyResultId: { type: dataTypes.UUID, allowNull: true },
        updatedByUserId: { type: dataTypes.UUID, allowNull: false },
        progressValue: { type: dataTypes.FLOAT, allowNull: false },
        progressPercent: { type: dataTypes.FLOAT, defaultValue: 0 },
        comment: { type: dataTypes.TEXT, allowNull: true },
        blockers: { type: dataTypes.JSONB, defaultValue: [] }
    }, { tableName: "okr_progress_updates", timestamps: true });
    OKRProgressUpdate.associate = (models) => {
        models.OKRProgressUpdate.belongsTo(models.Business, { foreignKey: "businessId" });
        models.OKRProgressUpdate.belongsTo(models.Objective, { foreignKey: "objectiveId" });
        models.OKRProgressUpdate.belongsTo(models.KeyResult, { foreignKey: "keyResultId" });
        if (models.User)
            models.OKRProgressUpdate.belongsTo(models.User, { foreignKey: "updatedByUserId", as: "updatedBy" });
    };
    return OKRProgressUpdate;
};
