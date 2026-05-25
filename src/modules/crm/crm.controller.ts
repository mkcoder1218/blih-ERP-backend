
import type { Request, Response, NextFunction } from 'express';
import { CRMService } from './crm.service';
import { AuditLogService } from '../../services/auditLog.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';

export class CRMController {
  private service = new CRMService();

  seedForms = async (req: Request, res: Response) => {
    await this.service.provisionForms(req.user!.businessId);
    successResponse(res, null, "CRM templates seeded successfully.");
  };

  createLead = async (req: Request, res: Response) => {
    try {
      const l = await this.service.createLead(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_LEAD', 'crm_lead', String(l.id), null, l, req);
      successResponse(res, l, "Lead created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  publicCreateLead = async (req: Request, res: Response) => {
    try {
      // businessId passed in param or body
      const bId = req.body.businessId || req.query.businessId; 
      if(!bId) return errorResponse(res, "businessId is required");
      const l = await this.service.publicCreateLead(bId, req.body);
      successResponse(res, { leadId: l.id }, "Lead created successfully", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  updateLead = async (req: Request, res: Response) => {
    try {
      const l = await this.service.updateLead(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_LEAD', 'crm_lead', String(l.id), null, req.body, req);
      successResponse(res, l);
    } catch(e: any) { errorResponse(res, e.message); }
  }
  
  listLeads = async (req: Request, res: Response) => {
    try {
      const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getLeads(req.user!.businessId, req.user!.id, bypass, page, size);
      
      // Filter out internal metadata/pricing notes if requested by non-internal
      // Here all requestors are internal users, but if client user could fetch this, we'd strip it.
      
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };
  
  assignLead = async (req: Request, res: Response) => {
    try {
      const l = await this.service.assignLead(req.user!.businessId, req.params.id, req.body.assignedToUserId);
      await AuditLogService.log('ASSIGN_LEAD', 'crm_lead', String(l.id), null, { assignedToUserId: req.body.assignedToUserId }, req);
      successResponse(res, l);
    } catch(e: any) { errorResponse(res, e.message); }
  };
  
  convertToDeal = async (req: Request, res: Response) => {
    try {
      const d = await this.service.convertLeadToDeal(req.user!.businessId, req.params.id, req.user!.id, req.body.title, req.body.value);
      await AuditLogService.log('CONVERT_LEAD_TO_DEAL', 'crm_lead', req.params.id, null, { newDealId: d.id }, req);
      successResponse(res, d, "Converted to Deal", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createDeal = async (req: Request, res: Response) => {
    try {
      const d = await this.service.createDeal(req.user!.businessId, { ...req.body, ownerUserId: req.user!.id });
      await AuditLogService.log('CREATE_DEAL', 'crm_deal', String(d.id), null, d, req);
      successResponse(res, d, "Deal created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };
  
  listDeals = async (req: Request, res: Response) => {
    try {
      const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getDeals(req.user!.businessId, req.user!.id, bypass, page, size);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  convertToClient = async (req: Request, res: Response) => {
    try {
      const c = await this.service.convertWonDealToClient(req.user!.businessId, req.params.id, req.user!.id);
      await AuditLogService.log('CONVERT_DEAL_TO_CLIENT', 'crm_deal', req.params.id, null, { newClientId: c.id }, req);
      successResponse(res, c, "Converted Won Deal to Client", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createInteraction = async (req: Request, res: Response) => {
    try {
      const i = await this.service.logInteraction(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_INTERACTION', 'crm_interaction', String(i.id), null, i, req);
      successResponse(res, i, "Interaction logged", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listInteractions = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getInteractions(req.user!.businessId, page, size);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createProposal = async (req: Request, res: Response) => {
    try {
      const p = await this.service.createProposal(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_PROPOSAL', 'crm_proposal', String(p.id), null, p, req);
      successResponse(res, p, "Proposal created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listProposals = async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getProposals(req.user!.businessId, page, size);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  createClient = async (req: Request, res: Response) => {
    try {
      const c = await this.service.createClient(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_CLIENT', 'crm_client', String(c.id), null, c, req);
      successResponse(res, c, "Client created", 201);
    } catch(e: any) { errorResponse(res, e.message); }
  };

  listClients = async (req: Request, res: Response) => {
    try {
      const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const data = await this.service.getClients(req.user!.businessId, req.user!.id, bypass, page, size);
      paginationResponse(res, data.rows, data.count, page, size);
    } catch(e: any) { errorResponse(res, e.message); }
  };
}
