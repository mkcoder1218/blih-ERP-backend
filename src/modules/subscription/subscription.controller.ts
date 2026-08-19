import type { Request, Response } from "express";
import { SubscriptionService } from "./subscription.service";
import { db } from "../../models";

const businessId = (req: Request) => req.user!.roles.includes("PLATFORM_SUPER_ADMIN") && req.query.businessId
  ? String(req.query.businessId) : req.user!.businessId;

export class SubscriptionController {
  private service = new SubscriptionService();
  current = async (req: Request, res: Response) => res.json({ subscription: await this.service.getSubscription(businessId(req)) });
  features = async (req: Request, res: Response) => res.json({ features: await this.service.getFeatures(businessId(req)) });
  usage = async (req: Request, res: Response) => res.json({ usage: await this.service.getUsage(businessId(req)) });
  invoices = async (req: Request, res: Response) => res.json({ invoices: await this.service.getInvoices(businessId(req)) });
  plans = async (_req: Request, res: Response) => res.json({ plans: await db.Plan.findAll({ where: { isActive: true }, include: [{ model: db.PlanFeature, as: "features", include: [{ model: db.Feature, as: "feature" }] }], order: [["sortOrder", "ASC"]] }) });
  changePlan = async (req: Request, res: Response) => res.json({ subscription: await this.service.changePlan(req.user!.businessId, req.body.planId) });
  cancel = async (req: Request, res: Response) => res.json({ subscription: await this.service.cancel(req.user!.businessId) });
  reactivate = async (req: Request, res: Response) => res.json({ subscription: await this.service.reactivate(req.user!.businessId) });
  generateInvoice = async (req: Request, res: Response) => res.status(201).json({ invoice: await this.service.generateInvoice(req.params.subscriptionId, req.body) });

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

export const subscriptionAdminModels = {
  features: db.Feature, "plan-features": db.PlanFeature, subscriptions: db.Subscription,
  usage: db.UsageRecord, invoices: db.SubscriptionInvoice, payments: db.SubscriptionPayment
};
