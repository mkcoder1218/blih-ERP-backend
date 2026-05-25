
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
    
    let lead: any = null;
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
        type: 'assignment', title: `New ${entityType.replace('crm_','')} Assigned`,
        message: 'A new record has been explicitly assigned to your pipeline.',
        entityType, entityId
      });
    } catch(e) {}
  }
}
