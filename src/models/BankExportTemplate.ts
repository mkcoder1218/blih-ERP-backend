import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BankExportTemplateModel = ModelStatic<any>;

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): BankExportTemplateModel => {
  return sequelize.define(
    "BankExportTemplate",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },
      headerHtml: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      bodyHtml: {
        type: dataTypes.TEXT,
        allowNull: false,
      },
      footerHtml: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      isDefault: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      updatedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "finance_bank_export_templates",
      timestamps: true,
    },
  ) as BankExportTemplateModel;
};
