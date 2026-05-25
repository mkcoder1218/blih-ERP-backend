"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ModuleTemplateWorkflow = sequelize.define("ModuleTemplateWorkflow", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
        workflowKey: { type: dataTypes.STRING(120), allowNull: false },
        workflowName: { type: dataTypes.STRING(200), allowNull: false },
        workflowSchema: { type: dataTypes.JSONB, defaultValue: {} },
        defaultSteps: { type: dataTypes.JSONB, defaultValue: [] },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "module_template_workflows", timestamps: true });
    ModuleTemplateWorkflow.associate = (models) => {
        models.ModuleTemplateWorkflow.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
    };
    return ModuleTemplateWorkflow;
};
