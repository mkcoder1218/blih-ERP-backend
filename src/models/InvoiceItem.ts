
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InvoiceItemModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InvoiceItemModel => {
  const InvoiceItem = sequelize.define("InvoiceItem", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    invoiceId: { type: dataTypes.UUID, allowNull: false },
    description: { type: dataTypes.STRING(255), allowNull: false },
    quantity: { type: dataTypes.FLOAT, defaultValue: 1 },
    unitPrice: { type: dataTypes.FLOAT, defaultValue: 0 },
    taxRate: { type: dataTypes.FLOAT, defaultValue: 0 },
    lineTotal: { type: dataTypes.FLOAT, defaultValue: 0 }
  }, { tableName: "finance_invoice_items", timestamps: true }) as InvoiceItemModel;

  InvoiceItem.associate = (models: any) => {
    models.InvoiceItem.belongsTo(models.Business, { foreignKey: "businessId" });
    models.InvoiceItem.belongsTo(models.Invoice, { foreignKey: "invoiceId" });
  };
  return InvoiceItem;
};
