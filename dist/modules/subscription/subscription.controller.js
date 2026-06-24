"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionAdminModels = exports.SubscriptionController = void 0;
const subscription_service_1 = require("./subscription.service");
const models_1 = require("../../models");
const businessId = (req) => req.user.roles.includes("PLATFORM_SUPER_ADMIN") && req.query.businessId
    ? String(req.query.businessId) : req.user.businessId;
class SubscriptionController {
    constructor() {
        this.service = new subscription_service_1.SubscriptionService();
        this.current = async (req, res) => res.json({ subscription: await this.service.getSubscription(businessId(req)) });
        this.features = async (req, res) => res.json({ features: await this.service.getFeatures(businessId(req)) });
        this.usage = async (req, res) => res.json({ usage: await this.service.getUsage(businessId(req)) });
        this.invoices = async (req, res) => res.json({ invoices: await this.service.getInvoices(businessId(req)) });
        this.plans = async (_req, res) => res.json({ plans: await models_1.db.Plan.findAll({ where: { isActive: true }, include: [{ model: models_1.db.PlanFeature, as: "features", include: [{ model: models_1.db.Feature, as: "feature" }] }], order: [["sortOrder", "ASC"]] }) });
        this.changePlan = async (req, res) => res.json({ subscription: await this.service.changePlan(req.user.businessId, req.body.planId) });
        this.cancel = async (req, res) => res.json({ subscription: await this.service.cancel(req.user.businessId) });
        this.reactivate = async (req, res) => res.json({ subscription: await this.service.reactivate(req.user.businessId) });
        this.generateInvoice = async (req, res) => res.status(201).json({ invoice: await this.service.generateInvoice(req.params.subscriptionId, req.body) });
        this.list = (model) => async (_req, res) => res.json({ data: await model.findAll({ order: [["createdAt", "DESC"]] }) });
        this.create = (model) => async (req, res) => res.status(201).json({ data: await model.create(req.body) });
        this.update = (model) => async (req, res) => {
            const row = await model.findByPk(req.params.id);
            if (!row)
                return res.status(404).json({ message: "Record not found." });
            res.json({ data: await row.update(req.body) });
        };
        this.remove = (model) => async (req, res) => {
            const row = await model.findByPk(req.params.id);
            if (!row)
                return res.status(404).json({ message: "Record not found." });
            await row.destroy();
            res.status(204).send();
        };
    }
}
exports.SubscriptionController = SubscriptionController;
exports.subscriptionAdminModels = {
    features: models_1.db.Feature, "plan-features": models_1.db.PlanFeature, subscriptions: models_1.db.Subscription,
    usage: models_1.db.UsageRecord, invoices: models_1.db.SubscriptionInvoice, payments: models_1.db.SubscriptionPayment
};
