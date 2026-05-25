const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- ClientPortalUser --
fs.writeFileSync(path.join(modelsPath, 'ClientPortalUser.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientPortalUserModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientPortalUserModel => {
  const ClientPortalUser = sequelize.define("ClientPortalUser", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: true }, // Linked system user if they log in via main auth
    fullName: { type: dataTypes.STRING(255), allowNull: false },
    email: { type: dataTypes.STRING(255), allowNull: false },
    phone: { type: dataTypes.STRING(50), allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive, invited
    lastLoginAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "client_portal_users", timestamps: true, paranoid: true }) as ClientPortalUserModel;

  ClientPortalUser.associate = (models: any) => {
    models.ClientPortalUser.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Client) models.ClientPortalUser.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.User) models.ClientPortalUser.belongsTo(models.User, { foreignKey: "userId" });
    models.ClientPortalUser.hasMany(models.ClientPortalAccess, { foreignKey: "clientPortalUserId" });
    models.ClientPortalUser.hasMany(models.ClientRequest, { foreignKey: "submittedByPortalUserId" });
    models.ClientPortalUser.hasMany(models.ClientFeedback, { foreignKey: "submittedByPortalUserId" });
  };
  return ClientPortalUser;
};
`);

// -- ClientPortalAccess --
fs.writeFileSync(path.join(modelsPath, 'ClientPortalAccess.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientPortalAccessModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientPortalAccessModel => {
  const ClientPortalAccess = sequelize.define("ClientPortalAccess", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientPortalUserId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: true },
    accessType: { type: dataTypes.STRING(50), defaultValue: "viewer" }, // viewer, editor, approver
    permissions: { type: dataTypes.JSONB, defaultValue: [] },
    expiresAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "client_portal_accesses", timestamps: true, paranoid: true }) as ClientPortalAccessModel;

  ClientPortalAccess.associate = (models: any) => {
    models.ClientPortalAccess.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ClientPortalAccess.belongsTo(models.ClientPortalUser, { foreignKey: "clientPortalUserId" });
    if(models.Client) models.ClientPortalAccess.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.ClientPortalAccess.belongsTo(models.Project, { foreignKey: "projectId" });
  };
  return ClientPortalAccess;
};
`);

// -- ClientRequest --
fs.writeFileSync(path.join(modelsPath, 'ClientRequest.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientRequestModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientRequestModel => {
  const ClientRequest = sequelize.define("ClientRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: true },
    submittedByPortalUserId: { type: dataTypes.UUID, allowNull: false },
    type: { type: dataTypes.STRING(50), allowNull: false }, // support, change_request, question
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "open" }, // open, in_progress, resolved, closed
    priority: { type: dataTypes.STRING(50), defaultValue: "medium" }, // low, medium, high, urgent
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "client_requests", timestamps: true, paranoid: true }) as ClientRequestModel;

  ClientRequest.associate = (models: any) => {
    models.ClientRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Client) models.ClientRequest.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.ClientRequest.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ClientRequest.belongsTo(models.ClientPortalUser, { foreignKey: "submittedByPortalUserId", as: "submitter" });
  };
  return ClientRequest;
};
`);

// -- ClientFeedback --
fs.writeFileSync(path.join(modelsPath, 'ClientFeedback.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientFeedbackModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientFeedbackModel => {
  const ClientFeedback = sequelize.define("ClientFeedback", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: true },
    submittedByPortalUserId: { type: dataTypes.UUID, allowNull: false },
    rating: { type: dataTypes.INTEGER, allowNull: false },
    npsScore: { type: dataTypes.INTEGER, allowNull: true },
    feedbackType: { type: dataTypes.STRING(50), defaultValue: "general" }, // deliverable, project, support, general
    comments: { type: dataTypes.TEXT, allowNull: true },
    consentForTestimonial: { type: dataTypes.BOOLEAN, defaultValue: false },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "client_feedbacks", timestamps: true, paranoid: true }) as ClientFeedbackModel;

  ClientFeedback.associate = (models: any) => {
    models.ClientFeedback.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Client) models.ClientFeedback.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.ClientFeedback.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ClientFeedback.belongsTo(models.ClientPortalUser, { foreignKey: "submittedByPortalUserId", as: "submitter" });
  };
  return ClientFeedback;
};
`);

ensureDir(path.join(src, 'modules', 'clientPortal'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'clientPortal', 'clientPortal.service.ts'), `
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
            message: \`\${data.title} submitted by client.\`,
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
            message: \`Feedback score \${data.rating} submitted by client.\`,
            entityType: 'client_feedback', entityId: fb.id
          });
        }
    } catch(e) {}

    return fb;
  }
}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'clientPortal', 'clientPortal.controller.ts'), `
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
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'clientPortal', 'clientPortal.routes.ts'), `
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { ClientPortalController } from './clientPortal.controller';
import { db } from '../../models';

const router = Router();
const controller = new ClientPortalController();

// Internal endpoints for setup (accessed by Account Managers, Admins)
router.post('/users', authRequired, requireRole('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createPortalUser));
router.post('/access', authRequired, requireRole('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createPortalAccess));

// Portal endpoints (accessed by the client)
// Requires a middleware to assert the logged in user is actually a ClientPortalUser
const requirePortalUser = async (req: Request, res: Response, next: NextFunction) => {
  const portalUser = await db.ClientPortalUser.findOne({ where: { userId: req.user!.id, businessId: req.user!.businessId, status: 'active' } });
  if (!portalUser) {
    return res.status(403).json({ message: 'Access denied: not a designated client portal user.' });
  }
  req.portalUser = portalUser;
  next();
};

router.get('/my-projects', authRequired, requirePortalUser, asyncHandler(controller.getClientProjects));
router.get('/my-invoices', authRequired, requirePortalUser, asyncHandler(controller.getClientInvoices));
router.post('/my-requests', authRequired, requirePortalUser, asyncHandler(controller.submitRequest));
router.post('/my-feedbacks', authRequired, requirePortalUser, asyncHandler(controller.submitFeedback));

export const clientPortalRoutes = router;
`);

console.log('Client Portal Scaffolding Created.');
