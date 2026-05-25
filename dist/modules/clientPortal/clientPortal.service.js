"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientPortalService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class ClientPortalService {
    // -- Portal User Management (Internal API) --
    async createPortalUser(businessId, data) {
        return models_1.db.ClientPortalUser.create({ ...data, businessId });
    }
    async listPortalUsers(businessId, clientId) {
        const where = { businessId };
        if (clientId)
            where.clientId = clientId;
        return models_1.db.ClientPortalUser.findAll({ where });
    }
    async createPortalAccess(businessId, data) {
        return models_1.db.ClientPortalAccess.create({ ...data, businessId });
    }
    // -- Client Experience APIs (External/Portal API) --
    async getClientProjects(businessId, clientId, portalUserId) {
        // Basic isolation: Only projects belonging to this clientId
        // Optionally refine by ClientPortalAccess entries if project-level is gated
        const projects = await models_1.db.Project.findAll({
            where: { businessId, clientId },
            attributes: ['id', 'title', 'code', 'status', 'startDate', 'endDate', 'description'] // Avoid exposing budget if private
        });
        return projects;
    }
    async getClientInvoices(businessId, clientId) {
        return models_1.db.Invoice.findAll({
            where: { businessId, clientId },
            attributes: ['id', 'invoiceNumber', 'issueDate', 'dueDate', 'currency', 'grandTotal', 'status'] // Filtered attributes
        });
    }
    async submitRequest(businessId, clientId, portalUserId, data) {
        const req = await models_1.db.ClientRequest.create({
            ...data,
            businessId,
            clientId,
            submittedByPortalUserId: portalUserId
        });
        try {
            const client = await models_1.db.Client.findOne({ where: { id: clientId, businessId } });
            if (client && client.accountManagerUserId) {
                await notification_service_1.InternalNotifier.send({
                    businessId, recipientUserId: client.accountManagerUserId, moduleKey: 'crm',
                    type: 'client_request', title: 'New Client Request',
                    message: `${data.title} submitted by client.`,
                    entityType: 'client_request', entityId: req.id
                });
            }
        }
        catch (e) { }
        return req;
    }
    async submitFeedback(businessId, clientId, portalUserId, data) {
        const fb = await models_1.db.ClientFeedback.create({
            ...data,
            businessId,
            clientId,
            submittedByPortalUserId: portalUserId
        });
        try {
            const client = await models_1.db.Client.findOne({ where: { id: clientId, businessId } });
            if (client && client.accountManagerUserId) {
                await notification_service_1.InternalNotifier.send({
                    businessId, recipientUserId: client.accountManagerUserId, moduleKey: 'crm',
                    type: 'client_feedback', title: 'New Client Feedback',
                    message: `Feedback score ${data.rating} submitted by client.`,
                    entityType: 'client_feedback', entityId: fb.id
                });
            }
        }
        catch (e) { }
        return fb;
    }
}
exports.ClientPortalService = ClientPortalService;
