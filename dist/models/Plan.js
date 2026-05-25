"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Plan = sequelize.define("Plan", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        name: { type: dataTypes.STRING(120), allowNull: false },
        key: { type: dataTypes.STRING(50), allowNull: false, unique: true },
        priceMonthly: { type: dataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        userLimit: { type: dataTypes.INTEGER, allowNull: true }, // null meaning infinite
        settings: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
        status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" }
    }, {
        tableName: "plans",
        timestamps: true,
        paranoid: true
    });
    Plan.associate = (models) => {
        models.Plan.hasMany(models.Business, { foreignKey: "planId" });
        models.Plan.hasMany(models.PlanModule, { foreignKey: "planId", as: "modules" });
    };
    return Plan;
};
