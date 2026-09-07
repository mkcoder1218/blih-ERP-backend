
import bcrypt from 'bcrypt';
import { env } from '../../config/env';
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';
import { normalizeEmail } from '../../utils/normalizeEmail';

export class ClientPortalService {

  // -- Portal User Management (Internal API) --
  async createPortalUser(businessId: string, data: any) {
    const client = await db.Client.findOne({ where: { id: data.clientId, businessId } });
    if (!client) throw new Error("Client not found");

    const email = normalizeEmail(data.email || client.email);
    if (!email) throw new Error("Client portal email is required");

    let userId = data.userId || null;
    if (!userId) {
      const existingUser = await db.User.findOne({ where: { businessId, email } });
      if (existingUser) {
        if (data.password) {
          await existingUser.update({ password: await bcrypt.hash(data.password, env.bcryptSaltRounds), status: "active" });
        }
        userId = existingUser.id;
      } else {
        const password = data.password || this.generateTemporaryPassword();
        const user = await db.User.create({
          businessId,
          fullName: data.fullName || client.contactName || client.companyName,
          email,
          password: await bcrypt.hash(password, env.bcryptSaltRounds),
          phone: data.phone || client.phone || null,
          status: "active",
          isPlatformSuperAdmin: false
        });
        userId = user.id;
        data.metadata = { ...(data.metadata || {}), temporaryPassword: password, credentialsIssuedAt: new Date().toISOString() };
      }
    }

    const [portalUser] = await db.ClientPortalUser.findOrCreate({
      where: { businessId, clientId: data.clientId, email },
      defaults: {
        businessId,
        clientId: data.clientId,
        userId,
        fullName: data.fullName || client.contactName || client.companyName,
        email,
        phone: data.phone || client.phone || null,
        status: data.status || "active",
        metadata: data.metadata || {}
      }
    });

    if (portalUser.userId !== userId || portalUser.status !== (data.status || portalUser.status)) {
      await portalUser.update({
        userId,
        fullName: data.fullName || portalUser.fullName,
        phone: data.phone || portalUser.phone,
        status: data.status || portalUser.status,
        metadata: { ...(portalUser.metadata || {}), ...(data.metadata || {}) }
      });
    }

    if (portalUser.userId && data.password) {
      const linkedUser = await db.User.findOne({ where: { id: portalUser.userId, businessId } });
      if (linkedUser) await linkedUser.update({ password: await bcrypt.hash(data.password, env.bcryptSaltRounds), status: "active" });
    }

    return portalUser;
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
    const projects = await db.Project.findAll({
      where: { businessId, clientId },
      attributes: ['id', 'title', 'code', 'status', 'startDate', 'endDate', 'description', 'progressPercent', 'metadata'],
      include: [
        { model: db.ProjectTask, attributes: ['id', 'title', 'status', 'priority', 'dueDate'] },
        { model: db.ProjectMilestone, attributes: ['id', 'name', 'status', 'dueDate'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    return projects.map((project: any) => {
      const raw = project.toJSON ? project.toJSON() : project;
      const tasks = raw.ProjectTasks || raw.ProjectTask || raw.ProjectTasks || [];
      const milestones = raw.ProjectMilestones || raw.ProjectMilestone || [];
      const activeTasks = tasks.filter((task: any) => task.status !== "CANCELLED");
      const completedTasks = activeTasks.filter((task: any) => task.status === "DONE").length;
      return {
        id: raw.id,
        title: raw.title,
        code: raw.code,
        status: raw.status,
        startDate: raw.startDate,
        endDate: raw.endDate,
        description: raw.description,
        progressPercent: raw.progressPercent || raw.metadata?.progress?.progressPercent || 0,
        taskProgress: {
          totalTasks: activeTasks.length,
          completedTasks,
          openTasks: Math.max(activeTasks.length - completedTasks, 0)
        },
        tasks: activeTasks.slice(0, 8).map((task: any) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate
        })),
        milestones: milestones.slice(0, 8).map((milestone: any) => ({
          id: milestone.id,
          name: milestone.name,
          status: milestone.status,
          dueDate: milestone.dueDate,
          completedAt: null
        })),
        updates: (raw.metadata?.clientUpdates || raw.metadata?.updates || []).slice(0, 5)
      };
    });
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

  private generateTemporaryPassword() {
    return `Blih-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
