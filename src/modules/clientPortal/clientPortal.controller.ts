
import type { Request, Response } from 'express';
import { ClientPortalService } from './clientPortal.service';
import { AuditLogService } from '../../services/auditLog.service';

declare module 'express-serve-static-core' {
  interface Request {
    portalUser?: any;
  }
}

export class ClientPortalController {
  private service = new ClientPortalService();

  // Internal CRM usage
  createPortalUser = async (req: Request, res: Response) => {
    try {
      const user = await this.service.createPortalUser(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_PORTAL_USER', 'client_portal_user', String(user.id), null, user, req);
      res.status(201).json({ portalUser: user });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  createPortalAccess = async (req: Request, res: Response) => {
    try {
      const access = await this.service.createPortalAccess(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_PORTAL_ACCESS', 'client_portal_access', String(access.id), null, access, req);
      res.status(201).json({ portalAccess: access });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  // External Portal usage
  getClientProjects = async (req: Request, res: Response) => {
    const data = await this.service.getClientProjects(req.user!.businessId, req.portalUser!.clientId, req.portalUser!.id);
    res.json({ projects: data });
  };

  getClientInvoices = async (req: Request, res: Response) => {
    const data = await this.service.getClientInvoices(req.user!.businessId, req.portalUser!.clientId);
    res.json({ invoices: data });
  };

  submitRequest = async (req: Request, res: Response) => {
    try {
      const requestObj = await this.service.submitRequest(req.user!.businessId, req.portalUser!.clientId, req.portalUser!.id, req.body);
      res.status(201).json({ request: requestObj });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  submitFeedback = async (req: Request, res: Response) => {
    try {
      const fb = await this.service.submitFeedback(req.user!.businessId, req.portalUser!.clientId, req.portalUser!.id, req.body);
      res.status(201).json({ feedback: fb });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };
}
