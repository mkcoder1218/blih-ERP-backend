
import type { Request, Response } from 'express';
import { SubscriptionService } from './subscription.service';
import { AuditLogService } from '../../services/auditLog.service';

export class SubscriptionController {
  private service = new SubscriptionService();

  getSubscription = async (req: Request, res: Response) => {
     // Admin can read specific businessId, normal admins only read own
     const bId = req.query.businessId && req.user!.roles.includes('SUPER_ADMIN') ? String(req.query.businessId) : req.user!.businessId;
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
      const bId = req.user!.roles.includes('SUPER_ADMIN') && req.body.businessId ? req.body.businessId : req.user!.businessId;
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
    const bId = req.user!.roles.includes('SUPER_ADMIN') && req.query.businessId ? String(req.query.businessId) : req.user!.businessId;
    const invs = await this.service.getInvoices(bId);
    res.json({ invoices: invs });
  };
}
