"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ReportDefinition = sequelize.define("ReportDefinition", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        moduleKey: { type: dataTypes.STRING(50), allowNull: false }, // hr, crm, finance, okr, projects
        name: { type: dataTypes.STRING(255), allowNull: false },
        key: { type: dataTypes.STRING(100), allowNull: true },
        description: { type: dataTypes.TEXT, allowNull: true },
        queryConfig: { type: dataTypes.JSONB, defaultValue: {} }, // Safe builder config like { entity: 'Lead', action: 'count', groupBy: 'status' }
        filters: { type: dataTypes.JSONB, defaultValue: {} }, // Default predefined filters
        scheduleConfig: { type: dataTypes.JSONB, defaultValue: {} }, // e.g. { frequency: 'weekly', time: '09:00' }
        visibility: { type: dataTypes.STRING(50), defaultValue: "private" }, // private, department, company
        status: { type: dataTypes.STRING(50), defaultValue: "active" } // active, draft, archived
    }, { tableName: "report_definitions", timestamps: true, paranoid: true });
    ReportDefinition.associate = (models) => {
        models.ReportDefinition.belongsTo(models.Business, { foreignKey: "businessId" });
        models.ReportDefinition.hasMany(models.ReportRun, { foreignKey: "reportDefinitionId" });
    };
    return ReportDefinition;
};
