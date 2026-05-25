const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// FINANCE MODELS
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
    issueDate: { type: dataTypes.DATEONLY, allowNull: false },
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
    models.Invoice.hasMany(models.InvoiceItem, { foreignKey: "invoiceId", as: "items" });
    models.Invoice.hasMany(models.Payment, { foreignKey: "invoiceId", as: "payments" });
  };
  return Invoice;
};`);

fs.writeFileSync(path.join(modelsPath, 'InvoiceItem.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InvoiceItemModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InvoiceItemModel => {
  const InvoiceItem = sequelize.define("InvoiceItem", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    invoiceId: { type: dataTypes.UUID, allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
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
};`);

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
    paymentDate: { type: dataTypes.DATEONLY, allowNull: false },
    method: { type: dataTypes.STRING(50), defaultValue: "transfer" }, // transfer, card, cash, check
    reference: { type: dataTypes.STRING(255), allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "completed" }, // pending, completed, failed, refunded
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_payments", timestamps: true, paranoid: true }) as PaymentModel;

  Payment.associate = (models: any) => {
    models.Payment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Payment.belongsTo(models.Invoice, { foreignKey: "invoiceId" });
    if(models.Client) models.Payment.belongsTo(models.Client, { foreignKey: "clientId" });
  };
  return Payment;
};`);

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
    category: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    expenseDate: { type: dataTypes.DATEONLY, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, paid, rejected
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_expenses", timestamps: true, paranoid: true }) as ExpenseModel;

  Expense.associate = (models: any) => {
    models.Expense.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Expense.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requestor" });
    if(models.Department) models.Expense.belongsTo(models.Department, { foreignKey: "departmentId" });
    if(models.Project) models.Expense.belongsTo(models.Project, { foreignKey: "projectId" });
  };
  return Expense;
};`);

fs.writeFileSync(path.join(modelsPath, 'Budget.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BudgetModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BudgetModel => {
  const Budget = sequelize.define("Budget", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    name: { type: dataTypes.STRING(255), allowNull: false },
    periodType: { type: dataTypes.STRING(50), defaultValue: "annual" }, // monthly, quarterly, annual
    periodStart: { type: dataTypes.DATEONLY, allowNull: false },
    periodEnd: { type: dataTypes.DATEONLY, allowNull: false },
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
};`);


// FINANCE MODULE & CONTROLLERS
ensureDir(path.join(src, 'modules', 'finance'));

fs.writeFileSync(path.join(src, 'modules', 'finance', 'finance.service.ts'), `
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class FinanceService {

  // INVOICES
  async createInvoice(businessId: string, data: any, items: any[] = []) {
    const inv = await db.Invoice.create({ ...data, businessId });
    if (items && items.length > 0) {
      for (const item of items) {
        await db.InvoiceItem.create({ ...item, invoiceId: inv.id, businessId });
      }
    }
    await this.recalculateInvoiceTotal(businessId, inv.id);
    return db.Invoice.findOne({ where: { id: inv.id, businessId }, include: ['items'] });
  }

  async generateInvoiceFromMilestone(businessId: string, projectId: string, milestoneId: string) {
    const project = await db.Project.findOne({ where: { id: projectId, businessId } });
    const milestone = await db.ProjectMilestone.findOne({ where: { id: milestoneId, businessId } });
    if (!project || !milestone) throw new Error("Project or Milestone not found");

    const calculatedAmt = (project.budget * milestone.billingPercent) / 100;
    const inv = await db.Invoice.create({
      businessId,
      clientId: project.clientId,
      projectId: project.id,
      invoiceNumber: \`INV-MS-\${Math.floor(Math.random()*10000)}\`,
      issueDate: new Date(),
      currency: project.currency,
      status: 'draft',
      metadata: { source: 'project_milestone', milestoneId }
    });

    await db.InvoiceItem.create({
      businessId, invoiceId: inv.id,
      description: \`Milestone: \${milestone.name}\`,
      quantity: 1, unitPrice: calculatedAmt, lineTotal: calculatedAmt
    });

    return this.recalculateInvoiceTotal(businessId, inv.id);
  }

  async recalculateInvoiceTotal(businessId: string, invoiceId: string) {
    const inv = await db.Invoice.findOne({ where: { id: invoiceId, businessId }, include: ['items', 'payments'] });
    if(!inv) return null;
    let sub = 0;
    inv.items.forEach((i: any) => sub += Number(i.lineTotal));
    // Simplification for explicit recalculation limits
    await inv.update({ subtotal: sub, grandTotal: sub - inv.discountTotal + inv.taxTotal });

    // recalculate status
    let paidAmt = 0;
    if(inv.payments) inv.payments.filter((p: any) => p.status === 'completed').forEach((p: any) => paidAmt += Number(p.amount));
    if (paidAmt >= inv.grandTotal && inv.grandTotal > 0) await inv.update({ status: 'paid' });
    else if (paidAmt > 0 && paidAmt < inv.grandTotal) await inv.update({ status: 'partial' });

    return inv;
  }

  async getInvoices(businessId: string, page: number, size: number) {
    return db.Invoice.findAndCountAll({ where: { businessId }, offset: (page-1)*size, limit: size, include: ['items'] });
  }

  // PAYMENTS
  async logPayment(businessId: string, data: any) {
    const p = await db.Payment.create({ ...data, businessId });
    if (p.invoiceId && p.status === 'completed') {
      await this.recalculateInvoiceTotal(businessId, p.invoiceId);
    }
    await this.notifyFinanceEvent(businessId, 'Payment Recorded', \`A payment of \${p.amount} \${p.currency} was recorded.\`);
    return p;
  }

  // EXPENSES AND BUDGETS
  async submitExpense(businessId: string, userId: string, data: any) {
    const ex = await db.Expense.create({ ...data, businessId, requestedByUserId: userId });
    
    // Natively apply to Budget bounds if explicitly locked to a running budget limit constraint logically
    if (ex.departmentId) {
      const budget = await db.Budget.findOne({ where: { businessId, departmentId: ex.departmentId, status: 'active' } });
      if (budget) {
        await budget.update({ usedAmount: Number(budget.usedAmount) + Number(ex.amount) });
      }
    }

    await this.notifyFinanceEvent(businessId, 'Expense Submitted', \`A new expense has been submitted for \${ex.amount} \${ex.currency}.\`);
    return ex;
  }

  async getExpenses(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) where.requestedByUserId = userId; // Non-finance only see own
    return db.Expense.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  async createBudget(businessId: string, data: any) {
    return db.Budget.create({ ...data, businessId });
  }
  
  async getBudgets(businessId: string, page: number, size: number) {
    return db.Budget.findAndCountAll({ where: { businessId }, offset: (page-1)*size, limit: size });
  }

  private async notifyFinanceEvent(businessId: string, title: string, message: string) {
    try {
      // Typically we'd lookup users by role 'FINANCE_MANAGER', for MVP broadcast logic:
       const managers = await db.UserRole.findAll({ 
         include: [{ model: db.Role, where: { key: 'FINANCE_MANAGER', businessId: [businessId, null] } }] 
       });
       if(managers.length === 0) return; // Silent explicit
       
       for(const m of managers) {
         await InternalNotifier.send({
           businessId, recipientUserId: m.userId, moduleKey: 'finance',
           type: 'finance_alert', title, message, entityType: null, entityId: null
         });
       }
    } catch(e) {}
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'finance', 'finance.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';
import { AuditLogService } from '../../services/auditLog.service';

export class FinanceController {
  private service = new FinanceService();

  createInvoice = async (req: Request, res: Response) => {
    try {
      const { items, ...data } = req.body;
      const inv = await this.service.createInvoice(req.user!.businessId, data, items);
      await AuditLogService.log('CREATE_INVOICE', 'finance_invoice', String(inv.id), null, inv, req);
      res.status(201).json({ invoice: inv });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  createInvoiceFromMilestone = async (req: Request, res: Response) => {
    try {
      const { projectId, milestoneId } = req.body;
      const inv = await this.service.generateInvoiceFromMilestone(req.user!.businessId, projectId, milestoneId);
      await AuditLogService.log('GENERATE_INVOICE_MILESTONE', 'finance_invoice', String(inv.id), null, { projectId, milestoneId }, req);
      res.status(201).json({ invoice: inv });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  listInvoices = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.getInvoices(req.user!.businessId, page, size));
  };

  logPayment = async (req: Request, res: Response) => {
    try {
      const p = await this.service.logPayment(req.user!.businessId, req.body);
      await AuditLogService.log('LOG_PAYMENT', 'finance_payment', String(p.id), null, p, req);
      res.status(201).json({ payment: p });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  submitExpense = async (req: Request, res: Response) => {
    try {
      const ex = await this.service.submitExpense(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('SUBMIT_EXPENSE', 'finance_expense', String(ex.id), null, ex, req);
      res.status(201).json({ expense: ex });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  listExpenses = async (req: Request, res: Response) => {
    const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('FINANCE_MANAGER'));
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.getExpenses(req.user!.businessId, req.user!.id, bypass, page, size));
  };

  createBudget = async (req: Request, res: Response) => {
    try {
      const b = await this.service.createBudget(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_BUDGET', 'finance_budget', String(b.id), null, b, req);
      res.status(201).json({ budget: b });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  listBudgets = async (req: Request, res: Response) => {
    // Dept heads would natively need bypass constraints if mapping department scopes explicitly, keeping simple for MVP.
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.getBudgets(req.user!.businessId, page, size));
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'finance', 'finance.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { FinanceController } from './finance.controller';

const router = Router();
const controller = new FinanceController();

router.use(authRequired, requireActiveModule('finance'));

router.post('/invoices', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createInvoice));
router.post('/invoices/from-milestone', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createInvoiceFromMilestone));
router.get('/invoices', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.listInvoices));

router.post('/payments', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.logPayment));

router.post('/expenses', asyncHandler(controller.submitExpense));
router.get('/expenses', asyncHandler(controller.listExpenses));

router.post('/budgets', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createBudget));
router.get('/budgets', requireRole('FINANCE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.listBudgets));

export const financeRoutes = router;
`);

console.log('Finance Scaffolding Created.');
