const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- Subscription --
fs.writeFileSync(path.join(modelsPath, 'Subscription.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionModel => {
  const Subscription = sequelize.define("Subscription", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
    planId: { type: dataTypes.UUID, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "trial" }, // trial, active, past_due, suspended, cancelled, expired
    billingCycle: { type: dataTypes.STRING(20), defaultValue: "monthly" }, // monthly, yearly, lifetime
    startDate: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    endDate: { type: dataTypes.DATE, allowNull: true },
    trialEndsAt: { type: dataTypes.DATE, allowNull: true },
    cancelledAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "subscriptions", timestamps: true, paranoid: true }) as SubscriptionModel;

  Subscription.associate = (models: any) => {
    models.Subscription.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.Plan) models.Subscription.belongsTo(models.Plan, { foreignKey: "planId" });
    models.Subscription.hasMany(models.SubscriptionInvoice, { foreignKey: "subscriptionId" });
  };
  return Subscription;
};
`);

// -- SubscriptionInvoice --
fs.writeFileSync(path.join(modelsPath, 'SubscriptionInvoice.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionInvoiceModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionInvoiceModel => {
  const SubscriptionInvoice = sequelize.define("SubscriptionInvoice", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    subscriptionId: { type: dataTypes.UUID, allowNull: false },
    invoiceNumber: { type: dataTypes.STRING(100), allowNull: false },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    dueDate: { type: dataTypes.DATE, allowNull: false },
    paidAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, issued, paid, overdue, cancelled
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "subscription_invoices", timestamps: true, paranoid: true }) as SubscriptionInvoiceModel;

  SubscriptionInvoice.associate = (models: any) => {
    models.SubscriptionInvoice.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SubscriptionInvoice.belongsTo(models.Subscription, { foreignKey: "subscriptionId" });
    models.SubscriptionInvoice.hasMany(models.SubscriptionPayment, { foreignKey: "subscriptionInvoiceId" });
  };
  return SubscriptionInvoice;
};
`);

// -- SubscriptionPayment --
fs.writeFileSync(path.join(modelsPath, 'SubscriptionPayment.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionPaymentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionPaymentModel => {
  const SubscriptionPayment = sequelize.define("SubscriptionPayment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    subscriptionInvoiceId: { type: dataTypes.UUID, allowNull: false },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    paymentMethod: { type: dataTypes.STRING(50), allowNull: false }, // credit_card, bank_transfer, stripe...
    reference: { type: dataTypes.STRING(255), allowNull: true },
    paidAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, confirmed, failed, refunded
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "subscription_payments", timestamps: true, paranoid: true }) as SubscriptionPaymentModel;

  SubscriptionPayment.associate = (models: any) => {
    models.SubscriptionPayment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SubscriptionPayment.belongsTo(models.SubscriptionInvoice, { foreignKey: "subscriptionInvoiceId" });
  };
  return SubscriptionPayment;
};
`);

// -- UsageLimit --
fs.writeFileSync(path.join(modelsPath, 'UsageLimit.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UsageLimitModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UsageLimitModel => {
  const UsageLimit = sequelize.define("UsageLimit", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    planId: { type: dataTypes.UUID, allowNull: true },
    key: { type: dataTypes.STRING(100), allowNull: false }, // users, storage_gb, API_calls
    limitValue: { type: dataTypes.INTEGER, allowNull: false }, // -1 implies unlimited
    currentValue: { type: dataTypes.INTEGER, defaultValue: 0 },
    resetPeriod: { type: dataTypes.STRING(50), defaultValue: "never" }, // monthly, yearly, never
    resetAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "usage_limits", timestamps: true }) as UsageLimitModel;

  UsageLimit.associate = (models: any) => {
    models.UsageLimit.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Plan) models.UsageLimit.belongsTo(models.Plan, { foreignKey: "planId" });
  };
  return UsageLimit;
};
`);

ensureDir(path.join(src, 'modules', 'subscription'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'subscription', 'subscription.service.ts'), `
import { db } from '../../models';

export class SubscriptionService {

  async assignSubscription(businessId: string, planId: string) {
    const sub = await db.Subscription.upsert({
      businessId,
      planId,
      status: 'active',
      billingCycle: 'monthly',
      startDate: new Date()
    });

    // Initialize limits if plan exists
    if (db.Plan) {
      const plan = await db.Plan.findOne({ where: { id: planId } });
      if (plan && plan.features) {
         // mock extracting features user limit
         const maxUsers = plan.features.maxUsers || 5;
         await db.UsageLimit.upsert({
             businessId, planId, key: 'users', limitValue: maxUsers, currentValue: 1 // assuming 1 admin
         });
      }
    }

    return sub;
  }

  async getSubscription(businessId: string) {
    return db.Subscription.findOne({ where: { businessId }, include: [{ model: db.Plan }] });
  }

  async cancelSubscription(businessId: string) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if(!sub) throw new Error("No subscription");
    await sub.update({ status: 'cancelled', cancelledAt: new Date() });
    return sub;
  }

  async createInvoice(businessId: string, data: any) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) throw new Error("No subscription mapped.");
    return db.SubscriptionInvoice.create({ ...data, businessId, subscriptionId: sub.id });
  }

  async recordPayment(businessId: string, invoiceId: string, data: any) {
    const inv = await db.SubscriptionInvoice.findOne({ where: { id: invoiceId, businessId } });
    if (!inv) throw new Error("Invoice not found");
    const payment = await db.SubscriptionPayment.create({ ...data, businessId, subscriptionInvoiceId: inv.id });
    if (data.status === 'confirmed') {
      await inv.update({ status: 'paid', paidAt: new Date() });
      await db.Subscription.update({ status: 'active' }, { where: { id: inv.subscriptionId } });
    }
    return payment;
  }

  async getInvoices(businessId: string) {
    return db.SubscriptionInvoice.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] });
  }

  // --- Limits & Checks ---
  // A static helper designed for middlewares
  static async checkLimit(businessId: string, key: string): Promise<boolean> {
     const limit = await db.UsageLimit.findOne({ where: { businessId, key } });
     if (!limit) return true; // No explicit boundary mapped
     if (limit.limitValue === -1) return true; // Unlimited
     
     // Live mapping recalculation stub natively depending on key
     if (key === 'users') {
        const actualCount = await db.User.count({ where: { businessId, status: 'active' } });
        await limit.update({ currentValue: actualCount });
        return actualCount < limit.limitValue;
     }

     return limit.currentValue < limit.limitValue;
  }

  static async isActive(businessId: string): Promise<boolean> {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) return true; // Gracefully permit if subsystem completely inactive / legacy
    const blockedStatuses = ['suspended', 'expired', 'past_due', 'cancelled'];
    return !blockedStatuses.includes(sub.status);
  }
}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'subscription', 'subscription.controller.ts'), `
import type { Request, Response } from 'express';
import { SubscriptionService } from './subscription.service';
import { AuditLogService } from '../../services/auditLog.service';

export class SubscriptionController {
  private service = new SubscriptionService();

  getSubscription = async (req: Request, res: Response) => {
     // Admin can read specific businessId, normal admins only read own
     const bId = req.query.businessId && req.user!.role === 'SUPER_ADMIN' ? String(req.query.businessId) : req.user!.businessId;
     const sub = await this.service.getSubscription(bId);
     res.json({ subscription: sub });
  };

  assignSubscription = async (req: Request, res: Response) => {
    // SuperAdmin Only endpoint
    const subId = await this.service.assignSubscription(req.body.businessId, req.body.planId);
    res.json({ message: "Subscription linked/updated." });
  }

  cancelSubscription = async (req: Request, res: Response) => {
    // Assume businessId mapped from token, allow business admin to self-cancel
    try {
      const bId = req.user!.role === 'SUPER_ADMIN' && req.body.businessId ? req.body.businessId : req.user!.businessId;
      const sub = await this.service.cancelSubscription(bId);
      await AuditLogService.log('CANCEL_SUBSCRIPTION', 'subscription', String(sub.id), null, {}, req);
      res.json({ subscription: sub });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  createInvoice = async (req: Request, res: Response) => {
    // Setup by SuperAdmin or billing cron
    try {
      const inv = await this.service.createInvoice(req.body.businessId, req.body);
      res.json({ invoice: inv });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  recordPayment = async (req: Request, res: Response) => {
    // Invoked by webhook or super admin
    try {
      const pymt = await this.service.recordPayment(req.body.businessId, req.params.invoiceId, req.body);
      res.json({ payment: pymt });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  getInvoices = async (req: Request, res: Response) => {
    const bId = req.user!.role === 'SUPER_ADMIN' && req.query.businessId ? String(req.query.businessId) : req.user!.businessId;
    const invs = await this.service.getInvoices(bId);
    res.json({ invoices: invs });
  };
}
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'subscription', 'subscription.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { SubscriptionController } from './subscription.controller';

const router = Router();
const controller = new SubscriptionController();

// Business Admin Operations
router.get('/', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.getSubscription));
router.get('/invoices', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.getInvoices));
router.post('/cancel', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.cancelSubscription));

// Super Admin / System Operations
router.post('/assign', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.assignSubscription));
router.post('/invoices', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.createInvoice));
router.post('/invoices/:invoiceId/payments', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.recordPayment));

export const subscriptionRoutes = router;
`);

// -- Middleware --
ensureDir(path.join(src, 'middlewares'));
fs.writeFileSync(path.join(src, 'middlewares', 'subscription.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../modules/subscription/subscription.service';

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.businessId) return res.status(401).json({ message: 'Unauthorized' });
  const isActive = await SubscriptionService.isActive(req.user.businessId);
  if (!isActive) {
     return res.status(403).json({ message: 'Subscription is suspended, cancelled, or expired. Please renew.' });
  }
  next();
};

export const requireUsageLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.businessId) return res.status(401).json({ message: 'Unauthorized' });
    const isUnderLimit = await SubscriptionService.checkLimit(req.user.businessId, limitKey);
    if (!isUnderLimit) {
      return res.status(402).json({ message: \`Limit reached for metric: \${limitKey}. Please upgrade your plan.\` });
    }
    next();
  };
};
`);

console.log('Subscription Scaffolding Created.');
