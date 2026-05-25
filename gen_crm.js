const fs = require('fs');
const path = require('path');

const root = process.cwd();
const src = path.join(root, 'src');
const modelsPath = path.join(src, 'models');
const ensureDir = (d) => fs.mkdirSync(d, { recursive: true });

// 1. Proposal Model
fs.writeFileSync(path.join(modelsPath, 'Proposal.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProposalModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProposalModel => {
  const Proposal = sequelize.define("Proposal", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    leadId: { type: dataTypes.UUID, allowNull: true },
    clientId: { type: dataTypes.UUID, allowNull: true },
    dealId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    value: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: 'USD' },
    status: { type: dataTypes.STRING(50), defaultValue: 'draft' }, // draft, sent, accepted, rejected
    proposalFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "crm_proposals", timestamps: true, paranoid: true }) as ProposalModel;

  Proposal.associate = (models: any) => {
    models.Proposal.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Proposal.belongsTo(models.Lead, { foreignKey: "leadId" });
    models.Proposal.belongsTo(models.Client, { foreignKey: "clientId" });
    models.Proposal.belongsTo(models.Deal, { foreignKey: "dealId" });
  };
  return Proposal;
};
`);

// 2. Full CRM Service Replacement to encompass all logic
fs.writeFileSync(path.join(src, 'modules', 'crm', 'crm.service.ts'), `
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';
import { Op } from 'sequelize';

export class CRMService {
  
  async provisionForms(businessId: string) {
     const templates = [
        { key: 'new_lead_intake', title: 'New Lead Intake Form' },
        { key: 'lead_qualification', title: 'Lead Qualification Form' },
        { key: 'interaction', title: 'Interaction Form' },
        { key: 'lead_disqualification', title: 'Lead Disqualification Form' },
        { key: 'lead_assignment', title: 'Lead Assignment Form' },
        { key: 'proposal_request', title: 'Proposal Request Form' },
        { key: 'proposal_submission', title: 'Proposal Submission Record Form' },
        { key: 'pricing_discount_approval', title: 'Pricing / Discount Approval Form' },
        { key: 'negotiation_summary', title: 'Negotiation Summary Form' },
        { key: 'contract_approval', title: 'Contract / Agreement Approval Form' },
        { key: 'deal_win_loss', title: 'Deal Win / Loss Form' },
        { key: 'won_deal_handover', title: 'Won Deal Handover Form' },
        { key: 'client_onboarding', title: 'Client Onboarding Checklist Form' },
        { key: 'client_kyc', title: 'Client KYC & Tax Info Form' },
        { key: 'client_feedback', title: 'Client Feedback Form' },
        { key: 'client_satisfaction', title: 'Client Satisfaction Form' },
        { key: 'client_complaint', title: 'Client Complaint / Issue Report Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
              businessId, name: t.title, key: t.key,
              visibility: 'internal', version: 1,
              schema: { type: 'object', properties: {} }
           });
        }
     }
  }

  // LEADS
  async createLead(businessId: string, data: any) {
    const l = await db.Lead.create({ ...data, businessId });
    if (l.assignedToUserId) await this.notifyAssignment(businessId, 'crm_lead', l.id, l.assignedToUserId);
    return l;
  }
  
  async publicCreateLead(businessId: string, data: any) {
    // Only safe fields allowed
    const safeData = {
       businessId,
       companyName: data.companyName,
       contactName: data.contactName,
       email: data.email,
       phone: data.phone,
       industry: data.industry,
       source: 'public_form'
    };
    return db.Lead.create(safeData);
  }

  async updateLead(businessId: string, id: string, data: any) {
    const l = await db.Lead.findOne({ where: { id, businessId } });
    if(!l) throw new Error("Lead not found");
    // Ensure stage cannot be updated directly
    delete data.stage;
    return l.update(data);
  }

  async getLeads(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) where.assignedToUserId = userId;
    return db.Lead.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  async assignLead(businessId: string, id: string, assignedToUserId: string) {
    const l = await db.Lead.findOne({ where: { id, businessId } });
    if(!l) throw new Error("Lead not found");
    await l.update({ assignedToUserId });
    await this.notifyAssignment(businessId, 'crm_lead', id, assignedToUserId);
    return l;
  }

  async convertLeadToDeal(businessId: string, leadId: string, ownerUserId: string, title: string, value: number) {
    const l = await db.Lead.findOne({ where: { id: leadId, businessId } });
    if(!l) throw new Error("Lead not found");
    
    const d = await db.Deal.create({
      businessId, leadId, ownerUserId, title, value, stage: 'discovery'
    });
    await l.update({ status: 'converted' });
    return d;
  }

  async convertWonDealToClient(businessId: string, dealId: string, accountManagerUserId: string) {
    const d = await db.Deal.findOne({ where: { id: dealId, businessId, status: 'won' } });
    if(!d) throw new Error("Deal not found or not in won status");
    
    let lead = null;
    if (d.leadId) lead = await db.Lead.findOne({ where: { id: d.leadId } });
    
    const client = await db.Client.create({
      businessId, accountManagerUserId,
      companyName: lead ? lead.companyName : d.title,
      contactName: lead ? lead.contactName : null,
      email: lead ? lead.email : null,
      phone: lead ? lead.phone : null,
      industry: lead ? lead.industry : null
    });
    
    await d.update({ clientId: client.id });
    return client;
  }

  // DEALS
  async createDeal(businessId: string, data: any) {
    const d = await db.Deal.create({ ...data, businessId });
    if (d.ownerUserId) await this.notifyAssignment(businessId, 'crm_deal', d.id, d.ownerUserId);
    return d;
  }

  async getDeals(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) where.ownerUserId = userId; 
    return db.Deal.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  // INTERACTIONS
  async logInteraction(businessId: string, userId: string, data: any) {
    const i = await db.Interaction.create({ ...data, businessId, userId });
    
    // NATIVE HOOK: "Only Interaction form can update lead stage"
    if (data.leadId && data.stageAfterInteraction) {
      const l = await db.Lead.findOne({ where: { id: data.leadId, businessId } });
      if(l) await l.update({ stage: data.stageAfterInteraction });
    }
    return i;
  }

  async getInteractions(businessId: string, page: number, size: number) {
    return db.Interaction.findAndCountAll({ where: { businessId }, offset: (page-1)*size, limit: size });
  }

  // PROPOSALS
  async createProposal(businessId: string, data: any) {
    return db.Proposal.create({ ...data, businessId });
  }

  async getProposals(businessId: string, page: number, size: number) {
    return db.Proposal.findAndCountAll({ where: { businessId }, offset: (page-1)*size, limit: size });
  }

  // CLIENTS
  async createClient(businessId: string, data: any) {
    return db.Client.create({ ...data, businessId });
  }

  async getClients(businessId: string, userId: string, bypass: boolean, page: number, size: number) {
    const where: any = { businessId };
    if (!bypass) where.accountManagerUserId = userId;
    return db.Client.findAndCountAll({ where, offset: (page-1)*size, limit: size });
  }

  private async notifyAssignment(businessId: string, entityType: string, entityId: string, assignedUserId: string) {
    try {
      await InternalNotifier.send({
        businessId, recipientUserId: assignedUserId, moduleKey: 'crm',
        type: 'assignment', title: \`New \${entityType.replace('crm_','')} Assigned\`,
        message: 'A new record has been explicitly assigned to your pipeline.',
        entityType, entityId
      });
    } catch(e) {}
  }
}
`);

// 3. Update Controller logic
fs.writeFileSync(path.join(src, 'modules', 'crm', 'crm.controller.ts'), `
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
`);

// 4. CRM routes rewriting
fs.writeFileSync(path.join(src, 'modules', 'crm', 'crm.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/requireActiveModule';
import { asyncHandler } from '../../utils/asyncHandler';
import { CRMController } from './crm.controller';

const router = Router();
const controller = new CRMController();

// App boundary
router.use(requireActiveModule('crm'));

// Protected Routes
router.post('/templates', authRequired, requireRole('CRM_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.seedForms));

// Leads
router.post('/leads', authRequired, asyncHandler(controller.createLead));
router.get('/leads', authRequired, asyncHandler(controller.listLeads));
router.patch('/leads/:id', authRequired, asyncHandler(controller.updateLead));
router.patch('/leads/:id/assign', authRequired, requireRole('CRM_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.assignLead));
router.post('/leads/:id/convert-to-deal', authRequired, asyncHandler(controller.convertToDeal));

// Deals
router.post('/deals', authRequired, asyncHandler(controller.createDeal));
router.get('/deals', authRequired, asyncHandler(controller.listDeals));
router.post('/deals/:id/convert-to-client', authRequired, asyncHandler(controller.convertToClient));

// Interactions
router.post('/interactions', authRequired, asyncHandler(controller.createInteraction));
router.get('/interactions', authRequired, asyncHandler(controller.listInteractions));

// Proposals
router.post('/proposals', authRequired, asyncHandler(controller.createProposal));
router.get('/proposals', authRequired, asyncHandler(controller.listProposals));

// Clients
router.post('/clients', authRequired, asyncHandler(controller.createClient));
router.get('/clients', authRequired, asyncHandler(controller.listClients));

export const crmRoutes = router;

export const publicCRMRoutes = Router();
publicCRMRoutes.post('/leads', asyncHandler(controller.publicCreateLead));
`);

console.log("CRM Setup complete.");
