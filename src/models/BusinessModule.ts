import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessModuleModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessModuleModel => {
  const BusinessModule = sequelize.define(
    "BusinessModule",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      moduleKey: { type: dataTypes.STRING(120), allowNull: false },
      moduleName: { type: dataTypes.STRING(120), allowNull: false },
      status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" }, // active, inactive
      settings: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
      enabledAt: { type: dataTypes.DATE, allowNull: true },
      disabledAt: { type: dataTypes.DATE, allowNull: true }
    },
    {
      tableName: "business_modules",
      timestamps: true,
      indexes: [{ unique: true, fields: ["businessId", "moduleKey"] }]
    }
  ) as BusinessModuleModel;

  BusinessModule.associate = (models: any) => {
    models.BusinessModule.belongsTo(models.Business, { foreignKey: "businessId" });
  };

  return BusinessModule;
};
