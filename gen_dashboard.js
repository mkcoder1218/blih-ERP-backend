const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const modelsPath = path.join(src, 'models');

// MODELS
fs.writeFileSync(path.join(modelsPath, 'ActivityLog.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ActivityLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ActivityLogModel => {
  const ActivityLog = sequelize.define("ActivityLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: true },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    action: { type: dataTypes.STRING(120), allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    entityId: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "activity_logs", timestamps: true, updatedAt: false }) as ActivityLogModel;

  ActivityLog.associate = (models: any) => {
    models.ActivityLog.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.ActivityLog.belongsTo(models.User, { foreignKey: "userId" });
  };
  return ActivityLog;
};`);

fs.writeFileSync(path.join(modelsPath, 'DashboardWidget.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type DashboardWidgetModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): DashboardWidgetModel => {
  const DashboardWidget = sequelize.define("DashboardWidget", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    ownerUserId: { type: dataTypes.UUID, allowNull: true },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    widgetType: { type: dataTypes.STRING(50), allowNull: false }, // count, chart, table, list, progress, alert
    config: { type: dataTypes.JSONB, defaultValue: {} },
    position: { type: dataTypes.JSONB, defaultValue: {} },
    visibility: { type: dataTypes.STRING(50), defaultValue: "private" }, // private, role, business
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "dashboard_widgets", timestamps: true, paranoid: true }) as DashboardWidgetModel;

  DashboardWidget.associate = (models: any) => {
    models.DashboardWidget.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) models.DashboardWidget.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
  };
  return DashboardWidget;
};`);

fs.writeFileSync(path.join(modelsPath, 'SavedView.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SavedViewModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SavedViewModel => {
  const SavedView = sequelize.define("SavedView", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    name: { type: dataTypes.STRING(255), allowNull: false },
    filters: { type: dataTypes.JSONB, defaultValue: {} },
    columns: { type: dataTypes.JSONB, defaultValue: [] },
    sort: { type: dataTypes.JSONB, defaultValue: {} },
    isDefault: { type: dataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: "saved_views", timestamps: true, paranoid: true }) as SavedViewModel;

  SavedView.associate = (models: any) => {
    models.SavedView.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SavedView.belongsTo(models.User, { foreignKey: "userId" });
  };
  return SavedView;
};`);

// VALIDATORS
ensureDir(path.join(src, 'validators'));
fs.writeFileSync(path.join(src, 'validators', 'dashboard.validator.ts'), `
import Joi from 'joi';
export const widgetSchema = Joi.object({
  moduleKey: Joi.string().max(120).required(),
  title: Joi.string().max(255).required(),
  key: Joi.string().max(120).required(),
  widgetType: Joi.string().valid('count', 'chart', 'table', 'list', 'progress', 'alert').required(),
  config: Joi.object().optional(),
  position: Joi.object().optional(),
  visibility: Joi.string().valid('private', 'role', 'business').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});

export const viewSchema = Joi.object({
  moduleKey: Joi.string().max(120).required(),
  entityType: Joi.string().max(120).required(),
  name: Joi.string().max(255).required(),
  filters: Joi.object().optional(),
  columns: Joi.array().optional(),
  sort: Joi.object().optional(),
  isDefault: Joi.boolean().optional()
});
`);

// ACTIVITY LOG MODULE
ensureDir(path.join(src, 'modules', 'activityLog'));
fs.writeFileSync(path.join(src, 'modules', 'activityLog', 'activity.dal.ts'), `
import { db } from '../../models';
export class ActivityDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ActivityLog.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  create(data: any) { return db.ActivityLog.create(data); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'activityLog', 'activity.service.ts'), `
import { ActivityDAL } from './activity.dal';
import { Op } from 'sequelize';

export class ActivityService {
  private dal = new ActivityDAL();

  list(businessId: string, queryOpts: any, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    
    if (queryOpts.moduleKey) query.moduleKey = queryOpts.moduleKey;
    if (queryOpts.entityType) query.entityType = queryOpts.entityType;
    if (queryOpts.entityId) query.entityId = queryOpts.entityId;
    if (queryOpts.userId) query.userId = queryOpts.userId;
    
    if (queryOpts.startDate && queryOpts.endDate) {
      query.createdAt = { [Op.between]: [new Date(queryOpts.startDate), new Date(queryOpts.endDate)] };
    }

    return this.dal.findAll(query, offset, size);
  }

  // Internal Reusable dispatch mechanism mapped heavily by auditLog logic hook
  async log(data: { businessId: string; userId?: string; moduleKey: string; action: string; entityType: string; entityId: string; title: string; description?: string; metadata?: any }) {
    return this.dal.create(data);
  }
}

export const ActivityLogger = new ActivityService();
`);

fs.writeFileSync(path.join(src, 'modules', 'activityLog', 'activity.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { ActivityLogger } from './activity.service';

export class ActivityController {
  list = async (req: Request, res: Response) => {
    // Basic isolation: If they are not admin, restrict the fetch parameters logically across a middleware checking modules,
    // but here we lock solely to businessId, restricting platform boundaries securely.
    const bypass = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
    
    // Strict scoping fallback: Normal users can only natively query feeds attached to their interactions if heavily gated.
    // Given requirements say "Normal users can view own activity and allowed module activity", 
    // real ERP implements robust ACL interceptors. Standard business abstraction boundary here:
    
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    const queryOpts = {
      moduleKey: req.query.moduleKey,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: bypass ? req.query.userId || undefined : req.user!.id,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    res.json(await ActivityLogger.list(req.user!.businessId, queryOpts, page, size));
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'activityLog', 'activity.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ActivityController } from './activity.controller';

const router = Router();
const controller = new ActivityController();
router.use(authRequired);
router.get('/', asyncHandler(controller.list));
export const activityRoutes = router;
`);

// DASHBOARD WIDGET MODULE
ensureDir(path.join(src, 'modules', 'dashboardWidget'));
fs.writeFileSync(path.join(src, 'modules', 'dashboardWidget', 'widget.dal.ts'), `
import { db } from '../../models';
export class WidgetDAL {
  findAll(query: any, offset: number, limit: number) { return db.DashboardWidget.findAndCountAll({ where: query, offset, limit }); }
  findById(id: string, businessId: string) { return db.DashboardWidget.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.DashboardWidget.create(data); }
  async update(id: string, businessId: string, data: any) {
    const w = await db.DashboardWidget.findOne({ where: { id, businessId } });
    if (w) return w.update(data); return null;
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'dashboardWidget', 'widget.service.ts'), `
import { WidgetDAL } from './widget.dal';
import { Op } from 'sequelize';

export class WidgetService {
  private dal = new WidgetDAL();

  listMine(businessId: string, userId: string, page: number, size: number) {
    const offset = (page - 1) * size;
    return this.dal.findAll({ businessId, [Op.or]: [{ ownerUserId: userId }, { visibility: 'business' }] }, offset, size);
  }

  getById(id: string, businessId: string) { return this.dal.findById(id, businessId); }
  create(businessId: string, userId: string, data: any) { return this.dal.create({ ...data, businessId, ownerUserId: userId }); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, businessId, data); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'dashboardWidget', 'widget.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { WidgetService } from './widget.service';
import { AuditLogService } from '../../services/auditLog.service';
export class WidgetController {
  private service = new WidgetService();

  list = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listMine(req.user!.businessId, req.user!.id, page, size));
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const doc = await this.service.getById(req.params.id, req.user!.businessId);
    if(!doc) return next({ statusCode: 404, message: 'Not found' });
    res.json({ widget: doc });
  };
  create = async (req: Request, res: Response) => {
    const doc = await this.service.create(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_WIDGET', 'dashboard_widget', doc.id, null, doc, req);
    res.status(201).json({ widget: doc });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const doc = await this.service.update(req.params.id, req.user!.businessId, req.body);
    if(!doc) return next({ statusCode: 404, message: 'Not found' });
    res.json({ widget: doc });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'dashboardWidget', 'widget.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { widgetSchema } from '../../validators/dashboard.validator';
import { WidgetController } from './widget.controller';

const router = Router();
const controller = new WidgetController();
router.use(authRequired);
router.get('/mine', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', validate(widgetSchema), asyncHandler(controller.create));
router.patch('/:id', asyncHandler(controller.update));
export const dashboardRoutes = router;
`);

// SAVED VIEW MODULE
ensureDir(path.join(src, 'modules', 'savedView'));
fs.writeFileSync(path.join(src, 'modules', 'savedView', 'view.dal.ts'), `
import { db } from '../../models';
export class ViewDAL {
  findAll(query: any, offset: number, limit: number) { return db.SavedView.findAndCountAll({ where: query, offset, limit }); }
  create(data: any) { return db.SavedView.create(data); }
  async deleteItem(id: string, businessId: string) {
    const v = await db.SavedView.findOne({ where: { id, businessId } });
    if(v) { await v.destroy(); return true; } return false;
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'savedView', 'view.service.ts'), `
import { ViewDAL } from './view.dal';
export class ViewService {
  private dal = new ViewDAL();
  listMine(businessId: string, userId: string, page: number, size: number) {
    return this.dal.findAll({ businessId, userId }, (page - 1) * size, size);
  }
  create(businessId: string, userId: string, data: any) { return this.dal.create({ ...data, businessId, userId }); }
  deleteItem(id: string, businessId: string) { return this.dal.deleteItem(id, businessId); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'savedView', 'view.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { ViewService } from './view.service';
import { AuditLogService } from '../../services/auditLog.service';
export class ViewController {
  private service = new ViewService();
  list = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listMine(req.user!.businessId, req.user!.id, page, size));
  };
  create = async (req: Request, res: Response) => {
    const doc = await this.service.create(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_SAVED_VIEW', 'saved_view', doc.id, null, doc, req);
    res.status(201).json({ view: doc });
  };
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const ok = await this.service.deleteItem(req.params.id, req.user!.businessId);
    if(!ok) return next({ statusCode: 404, message: 'Not found' });
    res.json({ ok: true });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'savedView', 'view.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { viewSchema } from '../../validators/dashboard.validator';
import { ViewController } from './view.controller';

const router = Router();
const controller = new ViewController();
router.use(authRequired);
router.get('/mine', asyncHandler(controller.list));
router.post('/', validate(viewSchema), asyncHandler(controller.create));
router.delete('/:id', asyncHandler(controller.remove));
export const savedViewRoutes = router;
`);

console.log('Dashboard Schema Configured.');
