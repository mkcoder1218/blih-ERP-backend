"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const PlanModule = sequelize.define("PlanModule", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        planId: { type: dataTypes.UUID, allowNull: false },
        moduleKey: { type: dataTypes.STRING(120), allowNull: false },
        moduleName: { type: dataTypes.STRING(120), allowNull: false },
        isEnabled: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, {
        tableName: "plan_modules",
        timestamps: true,
        indexes: [{ unique: true, fields: ["planId", "moduleKey"] }]
    });
    PlanModule.associate = (models) => {
        models.PlanModule.belongsTo(models.Plan, { foreignKey: "planId" });
    };
    return PlanModule;
};
