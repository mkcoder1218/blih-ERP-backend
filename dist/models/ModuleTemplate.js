"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ModuleTemplate = sequelize.define("ModuleTemplate", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        moduleKey: { type: dataTypes.STRING(120), allowNull: false, unique: true },
        name: { type: dataTypes.STRING(200), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        version: { type: dataTypes.STRING(50), defaultValue: "1.0.0" },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "module_templates", timestamps: true, paranoid: true });
    ModuleTemplate.associate = (models) => {
        models.ModuleTemplate.hasMany(models.ModuleTemplateForm, { foreignKey: "moduleTemplateId", as: "forms" });
        models.ModuleTemplate.hasMany(models.ModuleTemplateWorkflow, { foreignKey: "moduleTemplateId", as: "workflows" });
    };
    return ModuleTemplate;
};
