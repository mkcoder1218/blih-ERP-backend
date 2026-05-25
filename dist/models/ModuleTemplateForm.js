"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ModuleTemplateForm = sequelize.define("ModuleTemplateForm", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
        formKey: { type: dataTypes.STRING(120), allowNull: false },
        formName: { type: dataTypes.STRING(200), allowNull: false },
        formSchema: { type: dataTypes.JSONB, defaultValue: {} },
        defaultFields: { type: dataTypes.JSONB, defaultValue: [] },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "module_template_forms", timestamps: true });
    ModuleTemplateForm.associate = (models) => {
        models.ModuleTemplateForm.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
    };
    return ModuleTemplateForm;
};
