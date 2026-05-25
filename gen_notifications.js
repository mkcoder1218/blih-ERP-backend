const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// MODELS
fs.writeFileSync(path.join(modelsPath, 'Notification.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type NotificationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): NotificationModel => {
  const Notification = sequelize.define("Notification", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    recipientUserId: { type: dataTypes.UUID, allowNull: false },
    senderUserId: { type: dataTypes.UUID, allowNull: true },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    type: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    message: { type: dataTypes.TEXT, allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: true },
    entityId: { type: dataTypes.STRING(120), allowNull: true },
    priority: { type: dataTypes.STRING(50), defaultValue: "normal" }, // low, normal, high, urgent
    status: { type: dataTypes.STRING(50), defaultValue: "unread" }, // unread, read, archived
    readAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "notifications", timestamps: true, paranoid: true }) as NotificationModel;

  Notification.associate = (models: any) => {
    models.Notification.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Notification.belongsTo(models.User, { foreignKey: "recipientUserId", as: "recipient" });
    models.Notification.belongsTo(models.User, { foreignKey: "senderUserId", as: "sender" });
  };
  return Notification;
};`);

fs.writeFileSync(path.join(modelsPath, 'NotificationPreference.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type NotificationPreferenceModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): NotificationPreferenceModel => {
  const NotificationPreference = sequelize.define("NotificationPreference", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: false },
    channel: { type: dataTypes.STRING(50), allowNull: false }, // in_app, email, sms
    moduleKey: { type: dataTypes.STRING(120), allowNull: true },
    type: { type: dataTypes.STRING(120), allowNull: true },
    isEnabled: { type: dataTypes.BOOLEAN, defaultValue: true },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "notification_preferences", timestamps: true }) as NotificationPreferenceModel;

  NotificationPreference.associate = (models: any) => {
    models.NotificationPreference.belongsTo(models.Business, { foreignKey: "businessId" });
    models.NotificationPreference.belongsTo(models.User, { foreignKey: "userId" });
  };
  return NotificationPreference;
};`);


// VALIDATORS
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'notification.validator.ts'), `
import Joi from 'joi';
export const bulkNotificationSchema = Joi.object({
  recipientUserIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  moduleKey: Joi.string().max(120).required(),
  type: Joi.string().max(120).required(),
  title: Joi.string().max(255).required(),
  message: Joi.string().required(),
  entityType: Joi.string().max(120).allow(null, '').optional(),
  entityId: Joi.string().max(120).allow(null, '').optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional()
});

export const preferenceUpdateSchema = Joi.object({
  channel: Joi.string().valid('in_app', 'email', 'sms').required(),
  moduleKey: Joi.string().max(120).allow(null, '').optional(),
  type: Joi.string().max(120).allow(null, '').optional(),
  isEnabled: Joi.boolean().required(),
  settings: Joi.object().optional()
});
`);


// NOTIFICATION MODULE
ensureDir(path.join(src, 'modules', 'notification'));
fs.writeFileSync(path.join(src, 'modules', 'notification', 'notification.dal.ts'), `
import { db } from '../../models';
export class NotificationDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.Notification.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  countUnread(query: any) { return db.Notification.count({ where: { ...query, status: 'unread' } }); }
  findById(id: string, businessId: string) { return db.Notification.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.Notification.create(data); }
  bulkCreate(data: any[]) { return db.Notification.bulkCreate(data); }
  markAsRead(id: string, businessId: string, userId: string) {
    return db.Notification.update({ status: 'read', readAt: new Date() }, { where: { id, businessId, recipientUserId: userId } });
  }
  markAllAsRead(businessId: string, userId: string) {
    return db.Notification.update({ status: 'read', readAt: new Date() }, { where: { businessId, recipientUserId: userId, status: 'unread' } });
  }
  archive(id: string, businessId: string, userId: string) {
    return db.Notification.update({ status: 'archived' }, { where: { id, businessId, recipientUserId: userId } });
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'notification', 'notification.service.ts'), `
import { NotificationDAL } from './notification.dal';

export class NotificationService {
  private dal = new NotificationDAL();

  list(businessId: string, userId: string, queryOptions: any, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId, recipientUserId: userId };
    if (queryOptions.status) query.status = queryOptions.status;
    if (queryOptions.type) query.type = queryOptions.type;
    if (queryOptions.moduleKey) query.moduleKey = queryOptions.moduleKey;
    if (queryOptions.priority) query.priority = queryOptions.priority;
    
    // Admins can see all if they bypass recipientUserId. Controller dictates this.
    if (queryOptions.overrideUserId) {
        delete query.recipientUserId;
    }

    return this.dal.findAll(query, offset, size);
  }

  getUnreadCount(businessId: string, userId: string) {
    return this.dal.countUnread({ businessId, recipientUserId: userId });
  }

  // Generic internal Send mechanism
  async send(data: {
    businessId: string;
    recipientUserId: string;
    senderUserId?: string;
    moduleKey: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    priority?: string;
    metadata?: any;
  }) {
    // 1. In App Native Save
    const inApp = await this.dal.create(data);

    // 2. Email / SMS Placeholder (Real ERP would query NotificationPreferences here)
    // console.log(\`[Email Channel Placeholder]: Sending Email to \${data.recipientUserId}\`);
    // console.log(\`[SMS Channel Placeholder]: Sending SMS to \${data.recipientUserId}\`);

    return inApp;
  }

  async sendBulk(payload: any) {
    const records = payload.recipientUserIds.map((userId: string) => ({
      ...payload,
      recipientUserIds: undefined,
      recipientUserId: userId
    }));
    return this.dal.bulkCreate(records);
  }

  markAsRead(id: string, businessId: string, userId: string) { return this.dal.markAsRead(id, businessId, userId); }
  markAllAsRead(businessId: string, userId: string) { return this.dal.markAllAsRead(businessId, userId); }
  archive(id: string, businessId: string, userId: string) { return this.dal.archive(id, businessId, userId); }
}

export const InternalNotifier = new NotificationService();
`);

fs.writeFileSync(path.join(src, 'modules', 'notification', 'notification.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
export class NotificationController {
  private service = new NotificationService();

  list = async (req: Request, res: Response) => {
    // Business Admin logs check: allow them to view all (but controller filters body if needed?)
    // Request explicitly stated: "Business Admin can view business notification logs, but not private message content unless allowed"
    const bypassUser = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));

    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const queryOptions: any = {
      status: req.query.status,
      type: req.query.type,
      moduleKey: req.query.moduleKey,
      priority: req.query.priority,
      overrideUserId: bypassUser && req.query.all === 'true'
    };

    const data = await this.service.list(req.user!.businessId, req.user!.id, queryOptions, page, size);

    // Filter message contents if seeing someone else's messages as Business Admin
    if (queryOptions.overrideUserId && !req.user!.isPlatformSuperAdmin) {
      data.rows = data.rows.map((r: any) => {
        const d = r.toJSON();
        d.message = "*** Filtered for Privacy ***";
        return d;
      });
    }

    res.json(data);
  };

  unreadCount = async (req: Request, res: Response) => {
    const count = await this.service.getUnreadCount(req.user!.businessId, req.user!.id);
    res.json({ unreadCount: count });
  };

  bulkCreate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.sendBulk({ ...req.body, businessId: req.user!.businessId, senderUserId: req.user!.id });
      res.status(201).json({ ok: true });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };

  markRead = async (req: Request, res: Response) => {
    await this.service.markAsRead(req.params.id, req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };

  markAllRead = async (req: Request, res: Response) => {
    await this.service.markAllAsRead(req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };

  archive = async (req: Request, res: Response) => {
    await this.service.archive(req.params.id, req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'notification', 'notification.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { bulkNotificationSchema } from '../../validators/notification.validator';
import { NotificationController } from './notification.controller';

const router = Router();
const controller = new NotificationController();

router.use(authRequired);
router.get('/', asyncHandler(controller.list));
router.get('/unread-count', asyncHandler(controller.unreadCount));
router.post('/bulk', requireRole('BUSINESS_ADMIN'), validate(bulkNotificationSchema), asyncHandler(controller.bulkCreate));
router.patch('/:id/read', asyncHandler(controller.markRead));
router.patch('/read-all', asyncHandler(controller.markAllRead));
router.delete('/:id', asyncHandler(controller.archive));

export const notificationRoutes = router;
`);

// NOTIFICATION PREFERENCE MODULE
ensureDir(path.join(src, 'modules', 'notificationPreference'));
fs.writeFileSync(path.join(src, 'modules', 'notificationPreference', 'preference.dal.ts'), `
import { db } from '../../models';
export class PreferenceDAL {
  findForUser(businessId: string, userId: string) { return db.NotificationPreference.findAll({ where: { businessId, userId }}); }
  async upsert(data: any) {
    // Basic match
    const existing = await db.NotificationPreference.findOne({ where: { businessId: data.businessId, userId: data.userId, channel: data.channel, moduleKey: data.moduleKey, type: data.type }});
    if (existing) return existing.update(data);
    return db.NotificationPreference.create(data);
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'notificationPreference', 'preference.service.ts'), `
import { PreferenceDAL } from './preference.dal';
export class PreferenceService {
  private dal = new PreferenceDAL();
  listMine(businessId: string, userId: string) { return this.dal.findForUser(businessId, userId); }
  updateMine(businessId: string, userId: string, data: any) { return this.dal.upsert({ ...data, businessId, userId }); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'notificationPreference', 'preference.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { PreferenceService } from './preference.service';
import { AuditLogService } from '../../services/auditLog.service';
export class PreferenceController {
  private service = new PreferenceService();

  listMine = async (req: Request, res: Response) => {
    res.json({ preferences: await this.service.listMine(req.user!.businessId, req.user!.id) });
  };
  
  updateMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pref = await this.service.updateMine(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('UPDATE_NOTIFICATION_PREF', 'notification_preference', pref.id, null, pref, req);
      res.json({ preference: pref });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'notificationPreference', 'preference.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { preferenceUpdateSchema } from '../../validators/notification.validator';
import { PreferenceController } from './preference.controller';

const router = Router();
const controller = new PreferenceController();

router.use(authRequired);
router.get('/', asyncHandler(controller.listMine));
router.post('/', validate(preferenceUpdateSchema), asyncHandler(controller.updateMine));
export const notificationPreferenceRoutes = router;
`);

console.log('Notifications Schema Configured.');
