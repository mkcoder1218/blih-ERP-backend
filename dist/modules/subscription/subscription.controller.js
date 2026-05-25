"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const subscription_service_1 = require("./subscription.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class SubscriptionController {
    constructor() {
        this.service = new subscription_service_1.SubscriptionService();
        this.getSubscription = async (req, res) => {
            // Admin can read specific businessId, normal admins only read own
            const bId = req.query.businessId && req.user.roles.includes('SUPER_ADMIN') ? String(req.query.businessId) : req.user.businessId;
            const sub = await this.service.getSubscription(bId);
            res.json({ subscription: sub });
        };
        this.assignSubscription = async (req, res) => {
            // SuperAdmin Only endpoint
            const subId = await this.service.assignSubscription(req.body.businessId, req.body.planId);
            res.json({ message: "Subscription linked/updated." });
        };
        this.cancelSubscription = async (req, res) => {
            // Assume businessId mapped from token, allow business admin to self-cancel
            try {
                const bId = req.user.roles.includes('SUPER_ADMIN') && req.body.businessId ? req.body.businessId : req.user.businessId;
                const sub = await this.service.cancelSubscription(bId);
                await auditLog_service_1.AuditLogService.log('CANCEL_SUBSCRIPTION', 'subscription', String(sub.id), null, {}, req);
                res.json({ subscription: sub });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.createInvoice = async (req, res) => {
            // Setup by SuperAdmin or billing cron
            try {
                const inv = await this.service.createInvoice(req.body.businessId, req.body);
                res.json({ invoice: inv });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.recordPayment = async (req, res) => {
            // Invoked by webhook or super admin
            try {
                const pymt = await this.service.recordPayment(req.body.businessId, req.params.invoiceId, req.body);
                res.json({ payment: pymt });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.getInvoices = async (req, res) => {
            const bId = req.user.roles.includes('SUPER_ADMIN') && req.query.businessId ? String(req.query.businessId) : req.user.businessId;
            const invs = await this.service.getInvoices(bId);
            res.json({ invoices: invs });
        };
    }
}
exports.SubscriptionController = SubscriptionController;
