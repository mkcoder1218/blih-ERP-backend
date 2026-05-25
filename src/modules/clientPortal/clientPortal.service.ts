
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class ClientPortalService {

  // -- Portal User Management (Internal API) --
  async createPortalUser(businessId: string, data: any) {
    return db.ClientPortalUser.create({ ...data, businessId });
  }

  async listPortalUsers(businessId: string, clientId?: string) {
    const where: any = { businessId };
    if (clientId) where.clientId = clientId;
    return db.ClientPortalUser.findAll({ where });
  }

  async createPortalAccess(businessId: string, data: any) {
    return db.ClientPortalAccess.create({ ...data, businessId });
  }

  // -- Client Experience APIs (External/Portal API) --
  async getClientProjects(businessId: string, clientId: string, portalUserId: string) {
    // Basic isolation: Only projects belonging to this clientId
    // Optionally refine by ClientPortalAccess entries if project-level is gated
    const projects = await db.Project.findAll({
      where: { businessId, clientId },
      attributes: ['id', 'title', 'code', 'status', 'startDate', 'endDate', 'description'] // Avoid exposing budget if private
    });
    return projects;
  }

  async getClientInvoices(businessId: string, clientId: string) {
    return db.Invoice.findAll({
      where: { businessId, clientId },
      attributes: ['id', 'invoiceNumber', 'issueDate', 'dueDate', 'currency', 'grandTotal', 'status'] // Filtered attributes
    });
  }

  async submitRequest(businessId: string, clientId: string, portalUserId: string, data: any) {
    const req = await db.ClientRequest.create({
      ...data,
      businessId,
      clientId,
      submittedByPortalUserId: portalUserId
    });

    try {
        const client = await db.Client.findOne({ where: { id: clientId, businessId } });
        if (client && client.accountManagerUserId) {
          await InternalNotifier.send({
            businessId, recipientUserId: client.accountManagerUserId, moduleKey: 'crm',
            type: 'client_request', title: 'New Client Request',
            message: `${data.title} submitted by client.`,
            entityType: 'client_request', entityId: req.id
          });
        }
    } catch(e) {}

    return req;
  }

  async submitFeedback(businessId: string, clientId: string, portalUserId: string, data: any) {
    const fb = await db.ClientFeedback.create({
      ...data,
      businessId,
      clientId,
      submittedByPortalUserId: portalUserId
    });

    try {
        const client = await db.Client.findOne({ where: { id: clientId, businessId } });
        if (client && client.accountManagerUserId) {
          await InternalNotifier.send({
            businessId, recipientUserId: client.accountManagerUserId, moduleKey: 'crm',
            type: 'client_feedback', title: 'New Client Feedback',
            message: `Feedback score ${data.rating} submitted by client.`,
            entityType: 'client_feedback', entityId: fb.id
          });
        }
    } catch(e) {}

    return fb;
  }
}
