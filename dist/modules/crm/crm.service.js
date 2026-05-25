"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class CRMService {
    async provisionForms(businessId) {
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
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
                    businessId, name: t.title, key: t.key,
                    visibility: 'internal', version: 1,
                    schema: { type: 'object', properties: {} }
                });
            }
        }
    }
    // LEADS
    async createLead(businessId, data) {
        const l = await models_1.db.Lead.create({ ...data, businessId });
        if (l.assignedToUserId)
            await this.notifyAssignment(businessId, 'crm_lead', l.id, l.assignedToUserId);
        return l;
    }
    async publicCreateLead(businessId, data) {
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
        return models_1.db.Lead.create(safeData);
    }
    async updateLead(businessId, id, data) {
        const l = await models_1.db.Lead.findOne({ where: { id, businessId } });
        if (!l)
            throw new Error("Lead not found");
        // Ensure stage cannot be updated directly
        delete data.stage;
        return l.update(data);
    }
    async getLeads(businessId, userId, bypass, page, size) {
        const where = { businessId };
        if (!bypass)
            where.assignedToUserId = userId;
        return models_1.db.Lead.findAndCountAll({ where, offset: (page - 1) * size, limit: size });
    }
    async assignLead(businessId, id, assignedToUserId) {
        const l = await models_1.db.Lead.findOne({ where: { id, businessId } });
        if (!l)
            throw new Error("Lead not found");
        await l.update({ assignedToUserId });
        await this.notifyAssignment(businessId, 'crm_lead', id, assignedToUserId);
        return l;
    }
    async convertLeadToDeal(businessId, leadId, ownerUserId, title, value) {
        const l = await models_1.db.Lead.findOne({ where: { id: leadId, businessId } });
        if (!l)
            throw new Error("Lead not found");
        const d = await models_1.db.Deal.create({
            businessId, leadId, ownerUserId, title, value, stage: 'discovery'
        });
        await l.update({ status: 'converted' });
        return d;
    }
    async convertWonDealToClient(businessId, dealId, accountManagerUserId) {
        const d = await models_1.db.Deal.findOne({ where: { id: dealId, businessId, status: 'won' } });
        if (!d)
            throw new Error("Deal not found or not in won status");
        let lead = null;
        if (d.leadId)
            lead = await models_1.db.Lead.findOne({ where: { id: d.leadId } });
        const client = await models_1.db.Client.create({
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
    async createDeal(businessId, data) {
        const d = await models_1.db.Deal.create({ ...data, businessId });
        if (d.ownerUserId)
            await this.notifyAssignment(businessId, 'crm_deal', d.id, d.ownerUserId);
        return d;
    }
    async getDeals(businessId, userId, bypass, page, size) {
        const where = { businessId };
        if (!bypass)
            where.ownerUserId = userId;
        return models_1.db.Deal.findAndCountAll({ where, offset: (page - 1) * size, limit: size });
    }
    // INTERACTIONS
    async logInteraction(businessId, userId, data) {
        const i = await models_1.db.Interaction.create({ ...data, businessId, userId });
        // NATIVE HOOK: "Only Interaction form can update lead stage"
        if (data.leadId && data.stageAfterInteraction) {
            const l = await models_1.db.Lead.findOne({ where: { id: data.leadId, businessId } });
            if (l)
                await l.update({ stage: data.stageAfterInteraction });
        }
        return i;
    }
    async getInteractions(businessId, page, size) {
        return models_1.db.Interaction.findAndCountAll({ where: { businessId }, offset: (page - 1) * size, limit: size });
    }
    // PROPOSALS
    async createProposal(businessId, data) {
        return models_1.db.Proposal.create({ ...data, businessId });
    }
    async getProposals(businessId, page, size) {
        return models_1.db.Proposal.findAndCountAll({ where: { businessId }, offset: (page - 1) * size, limit: size });
    }
    // CLIENTS
    async createClient(businessId, data) {
        return models_1.db.Client.create({ ...data, businessId });
    }
    async getClients(businessId, userId, bypass, page, size) {
        const where = { businessId };
        if (!bypass)
            where.accountManagerUserId = userId;
        return models_1.db.Client.findAndCountAll({ where, offset: (page - 1) * size, limit: size });
    }
    async notifyAssignment(businessId, entityType, entityId, assignedUserId) {
        try {
            await notification_service_1.InternalNotifier.send({
                businessId, recipientUserId: assignedUserId, moduleKey: 'crm',
                type: 'assignment', title: `New ${entityType.replace('crm_', '')} Assigned`,
                message: 'A new record has been explicitly assigned to your pipeline.',
                entityType, entityId
            });
        }
        catch (e) { }
    }
}
exports.CRMService = CRMService;
