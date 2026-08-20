import type { Request, Response } from "express";
import { SubscriptionService } from "./subscription.service";
import { db } from "../../models";
import { AuditLogService } from "../../services/auditLog.service";
import { generateSubscriptionInvoicePdf, generateSubscriptionPaymentReceiptPdf } from "../../utils/subscriptionPdf";

const businessIdFor = (req: Request): string => {
  const businessId = req.user!.roles.includes("PLATFORM_SUPER_ADMIN") && req.query.businessId
    ? String(req.query.businessId)
    : req.user!.businessId;
  if (!businessId) throw Object.assign(new Error("A business context is required."), { statusCode: 400 });
  return businessId;
};

export class SubscriptionController {
  private service = new SubscriptionService();

  current = async (req: Request, res: Response) => {
    const businessId = businessIdFor(req);
    const subscription = await this.service.getSubscription(businessId);
    const policy = subscription ? await this.service.getPolicyLayers(businessId, subscription.planId) : null;
    res.json({ subscription, policy });
  };
  features = async (req: Request, res: Response) => res.json({ features: await this.service.getFeatures(businessIdFor(req)) });
  usage = async (req: Request, res: Response) => res.json({ usage: await this.service.getUsage(businessIdFor(req)) });
  invoices = async (req: Request, res: Response) => res.json({ invoices: await this.service.getInvoices(businessIdFor(req)) });
  payments = async (req: Request, res: Response) => res.json({ payments: await this.service.getPayments(businessIdFor(req)) });
  plans = async (_req: Request, res: Response) => res.json({
    plans: await db.Plan.findAll({
      where: { isActive: true },
      include: [
        { model: db.PlanModule, as: "modules", required: false },
        { model: db.PlanFeature, as: "features", required: false, include: [{ model: db.Feature, as: "feature" }] },
        { model: db.SubscriptionPolicy, as: "subscriptionPolicy", required: false },
      ],
      order: [["sortOrder", "ASC"], ["name", "ASC"]],
    }),
  });
  changePlan = async (req: Request, res: Response) => {
    const result = await this.service.changePlan(req.user!.businessId, req.body.planId, false);
    await AuditLogService.log("REQUEST_PLAN_CHANGE", "subscription", result.subscription.id, null, { planId: req.body.planId, adjustment: result.adjustment }, req);
    res.json(result);
  };
  cancel = async (req: Request, res: Response) => {
    const subscription = await this.service.cancel(req.user!.businessId);
    await AuditLogService.log("CANCEL_SUBSCRIPTION", "subscription", subscription.id, null, { cancelAtPeriodEnd: true }, req, "warning");
    res.json({ subscription });
  };
  reactivate = async (req: Request, res: Response) => {
    const subscription = await this.service.reactivate(req.user!.businessId);
    await AuditLogService.log("REACTIVATE_SUBSCRIPTION", "subscription", subscription.id, null, { cancelAtPeriodEnd: false }, req);
    res.json({ subscription });
  };
  recordUsage = async (req: Request, res: Response) => res.status(201).json({ usage: await this.service.recordUsage(businessIdFor(req), req.body.featureKey, req.body.quantity, req.body.metadata) });
  generateInvoice = async (req: Request, res: Response) => {
    const invoice = await this.service.generateInvoice(req.params.subscriptionId, req.body);
    await AuditLogService.log("GENERATE_SUBSCRIPTION_INVOICE", "subscription_invoice", invoice.id, null, invoice, req);
    res.status(201).json({ invoice });
  };

  adminOverview = async (_req: Request, res: Response) => res.json({ overview: await this.service.getAdminOverview() });
  adminBusinesses = async (_req: Request, res: Response) => res.json({ subscriptions: await this.service.listAdminBusinesses() });
  adminBusinessDetail = async (req: Request, res: Response) => res.json({ detail: await this.service.getAdminBusinessDetail(req.params.businessId) });
  adminAssign = async (req: Request, res: Response) => {
    const subscription = await this.service.assignSubscription(req.params.businessId, req.body.planId, req.body);
    await AuditLogService.log("ASSIGN_SUBSCRIPTION", "subscription", subscription.id, null, req.body, req);
    res.status(201).json({ subscription });
  };
  adminChangePlan = async (req: Request, res: Response) => {
    const result = await this.service.changePlan(req.params.businessId, req.body.planId, Boolean(req.body.force));
    await AuditLogService.log("ADMIN_CHANGE_SUBSCRIPTION_PLAN", "subscription", result.subscription.id, null, { ...req.body, adjustment: result.adjustment }, req);
    res.json(result);
  };
  adminRecordPayment = async (req: Request, res: Response) => {
    const file = req.file ? { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype } : null;
    const result = await this.service.recordManualPayment(req.params.businessId, req.body.invoiceId, req.body, file);
    await AuditLogService.log("RECORD_SUBSCRIPTION_PAYMENT", "subscription_payment", result.payment.id, null, { invoiceId: req.body.invoiceId, amount: req.body.amount, providerReference: req.body.providerReference }, req);
    res.status(201).json(result);
  };
  adminExtend = async (req: Request, res: Response) => {
    const subscription = await this.service.extendSubscription(req.params.businessId, req.body.days);
    await AuditLogService.log("EXTEND_SUBSCRIPTION", "subscription", subscription.id, null, req.body, req);
    res.json({ subscription });
  };
  adminDiscount = async (req: Request, res: Response) => {
    const subscription = await this.service.setDiscount(req.params.businessId, req.body.discountPercent);
    await AuditLogService.log("SET_SUBSCRIPTION_DISCOUNT", "subscription", subscription.id, null, req.body, req);
    res.json({ subscription });
  };
  adminSuspend = async (req: Request, res: Response) => {
    const subscription = await this.service.suspend(req.params.businessId);
    await AuditLogService.log("SUSPEND_SUBSCRIPTION", "subscription", subscription.id, null, { status: "suspended" }, req, "warning");
    res.json({ subscription });
  };
  adminReactivate = async (req: Request, res: Response) => {
    const subscription = await this.service.adminReactivate(req.params.businessId);
    await AuditLogService.log("ADMIN_REACTIVATE_SUBSCRIPTION", "subscription", subscription.id, null, { status: "active" }, req);
    res.json({ subscription });
  };
  adminBusinessPolicy = async (req: Request, res: Response) => {
    const policy = await this.service.upsertPolicy("business", req.params.businessId, req.body);
    await AuditLogService.log("UPDATE_SUBSCRIPTION_POLICY", "subscription_policy", policy.id, null, req.body, req);
    res.json({ policy, effective: await this.service.resolvePolicy(req.params.businessId, (await db.Subscription.findOne({ where: { businessId: req.params.businessId } }))?.planId) });
  };
  adminPlatformPolicy = async (_req: Request, res: Response) => res.json({ policy: await this.service.getPolicyLayers() });
  adminUpdatePlatformPolicy = async (req: Request, res: Response) => {
    const policy = await this.service.upsertPolicy("platform", null, req.body);
    await AuditLogService.log("UPDATE_PLATFORM_SUBSCRIPTION_POLICY", "subscription_policy", policy.id, null, req.body, req);
    res.json({ policy });
  };
  adminFeatureOverride = async (req: Request, res: Response) => {
    const features = await this.service.setFeatureOverride(req.params.businessId, req.params.featureId, req.body);
    await AuditLogService.log("OVERRIDE_SUBSCRIPTION_FEATURE", "subscription", req.params.businessId, null, { featureId: req.params.featureId, ...req.body }, req);
    res.json({ features });
  };
  adminModuleOverride = async (req: Request, res: Response) => {
    const modules = await this.service.setModuleOverride(req.params.businessId, req.params.moduleKey, req.body);
    await AuditLogService.log("OVERRIDE_SUBSCRIPTION_MODULE", "subscription", req.params.businessId, null, { moduleKey: req.params.moduleKey, ...req.body }, req);
    res.json({ modules });
  };

  invoicePdf = async (req: Request, res: Response) => {
    const businessId = businessIdFor(req);
    const invoice = await db.SubscriptionInvoice.findOne({ where: { id: req.params.invoiceId, businessId } });
    if (!invoice) return res.status(404).json({ message: "Invoice not found." });
    const [business, subscription, payments] = await Promise.all([
      db.Business.findByPk(businessId),
      db.Subscription.findByPk(invoice.subscriptionId, { include: [{ model: db.Plan }] }),
      db.SubscriptionPayment.findAll({ where: { invoiceId: invoice.id } }),
    ]);
    const pdf = await generateSubscriptionInvoicePdf({ business: asJson(business), subscription: asJson(subscription), invoice: asJson(invoice), payments: payments.map(asJson) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdf);
  };

  paymentPdf = async (req: Request, res: Response) => {
    const businessId = businessIdFor(req);
    const payment = await db.SubscriptionPayment.findOne({ where: { id: req.params.paymentId, businessId } });
    if (!payment) return res.status(404).json({ message: "Payment not found." });
    const [business, invoice] = await Promise.all([db.Business.findByPk(businessId), db.SubscriptionInvoice.findByPk(payment.invoiceId)]);
    const pdf = await generateSubscriptionPaymentReceiptPdf({ business: asJson(business), invoice: asJson(invoice), payment: asJson(payment) });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${payment.id.slice(0, 8)}.pdf"`);
    res.send(pdf);
  };

  originalReceipt = async (req: Request, res: Response) => {
    const businessId = req.user!.isPlatformSuperAdmin ? undefined : req.user!.businessId;
    const file = await this.service.getReceiptFile(req.params.paymentId, businessId);
    if (!file) return res.status(404).json({ message: "Receipt attachment not found." });
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.sendFile(file.path);
  };

  list = (model: any) => async (_req: Request, res: Response) => res.json({ data: await model.findAll({ order: [["createdAt", "DESC"]] }) });
  create = (model: any) => async (req: Request, res: Response) => res.status(201).json({ data: await model.create(req.body) });
  update = (model: any) => async (req: Request, res: Response) => {
    const row = await model.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Record not found." });
    res.json({ data: await row.update(req.body) });
  };
  remove = (model: any) => async (req: Request, res: Response) => {
    const row = await model.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Record not found." });
    await row.destroy();
    res.status(204).send();
  };
}

const asJson = (value: any) => value?.toJSON ? value.toJSON() : value;

export const subscriptionAdminModels = {
  features: db.Feature,
  "plan-features": db.PlanFeature,
  subscriptions: db.Subscription,
  usage: db.UsageRecord,
  invoices: db.SubscriptionInvoice,
  payments: db.SubscriptionPayment,
  policies: db.SubscriptionPolicy,
};
