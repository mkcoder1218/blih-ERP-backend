"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRMController = void 0;
const crm_service_1 = require("./crm.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const response_1 = require("../../utils/response");
class CRMController {
    constructor() {
        this.service = new crm_service_1.CRMService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "CRM templates seeded successfully.");
        };
        this.createLead = async (req, res) => {
            try {
                const l = await this.service.createLead(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_LEAD', 'crm_lead', String(l.id), null, l, req);
                (0, response_1.successResponse)(res, l, "Lead created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.publicCreateLead = async (req, res) => {
            try {
                // businessId passed in param or body
                const bId = req.body.businessId || req.query.businessId;
                if (!bId)
                    return (0, response_1.errorResponse)(res, "businessId is required");
                const l = await this.service.publicCreateLead(bId, req.body);
                (0, response_1.successResponse)(res, { leadId: l.id }, "Lead created successfully", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateLead = async (req, res) => {
            try {
                const l = await this.service.updateLead(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_LEAD', 'crm_lead', String(l.id), null, req.body, req);
                (0, response_1.successResponse)(res, l);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listLeads = async (req, res) => {
            try {
                const bypass = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getLeads(req.user.businessId, req.user.id, bypass, page, size);
                // Filter out internal metadata/pricing notes if requested by non-internal
                // Here all requestors are internal users, but if client user could fetch this, we'd strip it.
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.assignLead = async (req, res) => {
            try {
                const l = await this.service.assignLead(req.user.businessId, req.params.id, req.body.assignedToUserId);
                await auditLog_service_1.AuditLogService.log('ASSIGN_LEAD', 'crm_lead', String(l.id), null, { assignedToUserId: req.body.assignedToUserId }, req);
                (0, response_1.successResponse)(res, l);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.convertToDeal = async (req, res) => {
            try {
                const d = await this.service.convertLeadToDeal(req.user.businessId, req.params.id, req.user.id, req.body.title, req.body.value);
                await auditLog_service_1.AuditLogService.log('CONVERT_LEAD_TO_DEAL', 'crm_lead', req.params.id, null, { newDealId: d.id }, req);
                (0, response_1.successResponse)(res, d, "Converted to Deal", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createDeal = async (req, res) => {
            try {
                const d = await this.service.createDeal(req.user.businessId, { ...req.body, ownerUserId: req.user.id });
                await auditLog_service_1.AuditLogService.log('CREATE_DEAL', 'crm_deal', String(d.id), null, d, req);
                (0, response_1.successResponse)(res, d, "Deal created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listDeals = async (req, res) => {
            try {
                const bypass = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getDeals(req.user.businessId, req.user.id, bypass, page, size);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.convertToClient = async (req, res) => {
            try {
                const c = await this.service.convertWonDealToClient(req.user.businessId, req.params.id, req.user.id);
                await auditLog_service_1.AuditLogService.log('CONVERT_DEAL_TO_CLIENT', 'crm_deal', req.params.id, null, { newClientId: c.id }, req);
                (0, response_1.successResponse)(res, c, "Converted Won Deal to Client", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createInteraction = async (req, res) => {
            try {
                const i = await this.service.logInteraction(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_INTERACTION', 'crm_interaction', String(i.id), null, i, req);
                (0, response_1.successResponse)(res, i, "Interaction logged", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listInteractions = async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getInteractions(req.user.businessId, page, size);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createProposal = async (req, res) => {
            try {
                const p = await this.service.createProposal(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_PROPOSAL', 'crm_proposal', String(p.id), null, p, req);
                (0, response_1.successResponse)(res, p, "Proposal created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listProposals = async (req, res) => {
            try {
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getProposals(req.user.businessId, page, size);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createClient = async (req, res) => {
            try {
                const c = await this.service.createClient(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_CLIENT', 'crm_client', String(c.id), null, c, req);
                (0, response_1.successResponse)(res, c, "Client created", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listClients = async (req, res) => {
            try {
                const bypass = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('CRM_MANAGER')) || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
                const page = parseInt(req.query.page) || 1;
                const size = parseInt(req.query.size) || 20;
                const data = await this.service.getClients(req.user.businessId, req.user.id, bypass, page, size);
                (0, response_1.paginationResponse)(res, data.rows, data.count, page, size);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
}
exports.CRMController = CRMController;
