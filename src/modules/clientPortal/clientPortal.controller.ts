import type { Request, Response } from "express";
import { ClientPortalService } from "./clientPortal.service";
import { AuditLogService } from "../../services/auditLog.service";

export class ClientPortalController {
  private readonly service = new ClientPortalService();

  // Internal CRM usage
  createPortalUser = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const user = await this.service.createPortalUser(
        req.user!.businessId,
        req.body,
      );

      await AuditLogService.log(
        "CREATE_PORTAL_USER",
        "client_portal_user",
        String(user.id),
        null,
        user,
        req,
      );

      res.status(201).json({
        portalUser: user,
      });
    } catch (error: any) {
      res.status(400).json({
        message:
          error?.message ?? "Unable to create portal user.",
      });
    }
  };

  createPortalAccess = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const access =
        await this.service.createPortalAccess(
          req.user!.businessId,
          req.body,
        );

      await AuditLogService.log(
        "CREATE_PORTAL_ACCESS",
        "client_portal_access",
        String(access.id),
        null,
        access,
        req,
      );

      res.status(201).json({
        portalAccess: access,
      });
    } catch (error: any) {
      res.status(400).json({
        message:
          error?.message ??
          "Unable to create portal access.",
      });
    }
  };

  // External portal usage
  getClientProjects = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const portalUser = requirePortalUser(req);

    const projects =
      await this.service.getClientProjects(
        req.user!.businessId,
        portalUser.clientId,
        portalUser.id,
      );

    res.json({
      projects,
    });
  };

  getClientInvoices = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    const portalUser = requirePortalUser(req);

    const invoices =
      await this.service.getClientInvoices(
        req.user!.businessId,
        portalUser.clientId,
      );

    res.json({
      invoices,
    });
  };

  submitRequest = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const portalUser = requirePortalUser(req);

      const request =
        await this.service.submitRequest(
          req.user!.businessId,
          portalUser.clientId,
          portalUser.id,
          req.body,
        );

      res.status(201).json({
        request,
      });
    } catch (error: any) {
      res.status(400).json({
        message:
          error?.message ??
          "Unable to submit client request.",
      });
    }
  };

  submitFeedback = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const portalUser = requirePortalUser(req);

      const feedback =
        await this.service.submitFeedback(
          req.user!.businessId,
          portalUser.clientId,
          portalUser.id,
          req.body,
        );

      res.status(201).json({
        feedback,
      });
    } catch (error: any) {
      res.status(400).json({
        message:
          error?.message ??
          "Unable to submit client feedback.",
      });
    }
  };
}

function requirePortalUser(req: Request) {
  if (!req.portalUser) {
    throw new Error(
      "Client portal user context is missing.",
    );
  }

  return req.portalUser;
}
