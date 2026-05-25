
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type DashboardWidgetModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): DashboardWidgetModel => {
  const DashboardWidget = sequelize.define("DashboardWidget", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    ownerUserId: { type: dataTypes.UUID, allowNull: true },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    widgetType: { type: dataTypes.STRING(50), allowNull: false }, // count, chart, table, list, progress, alert
    config: { type: dataTypes.JSONB, defaultValue: {} },
    position: { type: dataTypes.JSONB, defaultValue: {} },
    visibility: { type: dataTypes.STRING(50), defaultValue: "private" }, // private, role, business
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "dashboard_widgets", timestamps: true, paranoid: true }) as DashboardWidgetModel;

  DashboardWidget.associate = (models: any) => {
    models.DashboardWidget.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.DashboardWidget.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
  };
  return DashboardWidget;
};