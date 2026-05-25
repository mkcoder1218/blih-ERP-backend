const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');
const modelsPath = path.join(src, 'models');
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

fs.writeFileSync(path.join(modelsPath, 'Invoice.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InvoiceModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InvoiceModel => {
  const Invoice = sequelize.define("Invoice", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: true },
    projectId: { type: dataTypes.UUID, allowNull: true },
    dealId: { type: dataTypes.UUID, allowNull: true },
    invoiceNumber: { type: dataTypes.STRING(100), allowNull: false },
    issueDate: { type: dataTypes.DATEONLY, allowNull: true },
    dueDate: { type: dataTypes.DATEONLY, allowNull: true },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    subtotal: { type: dataTypes.FLOAT, defaultValue: 0 },
    taxTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
    discountTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
    grandTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, issued, partial, paid, overdue, cancelled
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_invoices", timestamps: true, paranoid: true }) as InvoiceModel;

  Invoice.associate = (models: any) => {
    models.Invoice.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Client) models.Invoice.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.Invoice.belongsTo(models.Project, { foreignKey: "projectId" });
    if(models.Deal) models.Invoice.belongsTo(models.Deal, { foreignKey: "dealId" });
    models.Invoice.hasMany(models.InvoiceItem, { foreignKey: "invoiceId" });
  };
  return Invoice;
};
`);

fs.writeFileSync(path.join(modelsPath, 'InvoiceItem.ts'), `
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
`);

fs.writeFileSync(path.join(modelsPath, 'Payment.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PaymentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PaymentModel => {
  const Payment = sequelize.define("Payment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    invoiceId: { type: dataTypes.UUID, allowNull: true },
    clientId: { type: dataTypes.UUID, allowNull: true },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    paymentDate: { type: dataTypes.DATEONLY, allowNull: true },
    method: { type: dataTypes.STRING(50) }, // bank_transfer, credit_card, cash, etc
    reference: { type: dataTypes.STRING(255) },
    status: { type: dataTypes.STRING(50), defaultValue: "completed" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_payments", timestamps: true, paranoid: true }) as PaymentModel;

  Payment.associate = (models: any) => {
    models.Payment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Payment.belongsTo(models.Invoice, { foreignKey: "invoiceId" });
    if(models.Client) models.Payment.belongsTo(models.Client, { foreignKey: "clientId" });
  };
  return Payment;
};
`);

fs.writeFileSync(path.join(modelsPath, 'Expense.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExpenseModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExpenseModel => {
  const Expense = sequelize.define("Expense", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: true },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    projectId: { type: dataTypes.UUID, allowNull: true },
    vendorId: { type: dataTypes.UUID, allowNull: true },
    category: { type: dataTypes.STRING(100), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    expenseDate: { type: dataTypes.DATEONLY, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "pending_approval" }, // pending_approval, approved, paid, rejected
    receiptFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_expenses", timestamps: true, paranoid: true }) as ExpenseModel;

  Expense.associate = (models: any) => {
    models.Expense.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Expense.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    if(models.Department) models.Expense.belongsTo(models.Department, { foreignKey: "departmentId" });
    if(models.Project) models.Expense.belongsTo(models.Project, { foreignKey: "projectId" });
    if(models.FileAsset) models.Expense.belongsTo(models.FileAsset, { as: 'receipt', foreignKey: "receiptFileId" });
  };
  return Expense;
};
`);

fs.writeFileSync(path.join(modelsPath, 'Budget.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BudgetModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BudgetModel => {
  const Budget = sequelize.define("Budget", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    name: { type: dataTypes.STRING(255), allowNull: false },
    periodType: { type: dataTypes.STRING(50), defaultValue: "annual" },
    periodStart: { type: dataTypes.DATEONLY, allowNull: true },
    periodEnd: { type: dataTypes.DATEONLY, allowNull: true },
    allocatedAmount: { type: dataTypes.FLOAT, defaultValue: 0 },
    usedAmount: { type: dataTypes.FLOAT, defaultValue: 0 },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_budgets", timestamps: true, paranoid: true }) as BudgetModel;

  Budget.associate = (models: any) => {
    models.Budget.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Department) models.Budget.belongsTo(models.Department, { foreignKey: "departmentId" });
  };
  return Budget;
};
`);

fs.writeFileSync(path.join(modelsPath, 'Vendor.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type VendorModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): VendorModel => {
  const Vendor = sequelize.define("Vendor", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    name: { type: dataTypes.STRING(255), allowNull: false },
    email: { type: dataTypes.STRING(255), allowNull: true },
    phone: { type: dataTypes.STRING(50), allowNull: true },
    serviceCategory: { type: dataTypes.STRING(100), allowNull: true },
    taxInfo: { type: dataTypes.JSONB, defaultValue: {} },
    bankInfo: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_vendors", timestamps: true, paranoid: true }) as VendorModel;

  Vendor.associate = (models: any) => {
    models.Vendor.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return Vendor;
};
`);

console.log('Finance Models generated');
