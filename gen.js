const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

// PLAN
ensureDir(path.join(src, 'modules', 'plan'));
fs.writeFileSync(path.join(src, 'validators', 'plan.validator.ts'), `
import Joi from 'joi';
export const createPlanSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(50).required(),
  priceMonthly: Joi.number().min(0).required(),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});
export const updatePlanSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(50).optional(),
  priceMonthly: Joi.number().min(0).optional(),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
`);

fs.writeFileSync(path.join(src, 'modules', 'plan', 'plan.dal.ts'), `
import { db } from '../../models';
export class PlanDAL {
  findAll() { return db.Plan.findAll(); }
  findById(id: string) { return db.Plan.findByPk(id); }
  create(data: any) { return db.Plan.create(data); }
  async update(id: string, data: any) {
    const plan = await db.Plan.findByPk(id);
    if (!plan) return null;
    return plan.update(data);
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'plan', 'plan.service.ts'), `
import { PlanDAL } from './plan.dal';
export class PlanService {
  private dal = new PlanDAL();
  list() { return this.dal.findAll(); }
  getById(id: string) { return this.dal.findById(id); }
  create(data: any) { return this.dal.create(data); }
  update(id: string, data: any) { return this.dal.update(id, data); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'plan', 'plan.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { PlanService } from './plan.service';
import { AuditLogService } from '../../services/auditLog.service';
export class PlanController {
  private service = new PlanService();
  list = async (req: Request, res: Response) => res.json({ plans: await this.service.list() });
  get = async (req: Request, res: Response, next: NextFunction) => {
    const plan = await this.service.getById(req.params.id);
    if (!plan) return next({ statusCode: 404, message: 'Not found' });
    res.json({ plan });
  };
  create = async (req: Request, res: Response) => {
    const plan = await this.service.create(req.body);
    await AuditLogService.log('CREATE', 'plan', plan.id, null, plan, req);
    res.status(201).json({ plan });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const plan = await this.service.update(req.params.id, req.body);
    if (!plan) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'plan', plan.id, beforeData, plan, req);
    res.json({ plan });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'plan', 'plan.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createPlanSchema, updatePlanSchema } from '../../validators/plan.validator';
import { PlanController } from './plan.controller';
const router = Router();
const controller = new PlanController();
router.use(authRequired);
router.get('/', requireRole('PLATFORM_SUPER_ADMIN'), asyncHandler(controller.list));
router.get('/:id', requireRole('PLATFORM_SUPER_ADMIN'), asyncHandler(controller.get));
router.post('/', requireRole('PLATFORM_SUPER_ADMIN'), validate(createPlanSchema), asyncHandler(controller.create));
router.patch('/:id', requireRole('PLATFORM_SUPER_ADMIN'), validate(updatePlanSchema), asyncHandler(controller.update));
export const planRoutes = router;
`);

// BUSINESS MODULE
ensureDir(path.join(src, 'modules', 'businessModule'));
fs.writeFileSync(path.join(src, 'validators', 'businessModule.validator.ts'), `
import Joi from 'joi';
export const updateBusinessModuleSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
`);

fs.writeFileSync(path.join(src, 'modules', 'businessModule', 'businessModule.dal.ts'), `
import { db } from '../../models';
export class BusinessModuleDAL {
  findAll(query: any) { return db.BusinessModule.findAll({ where: query }); }
  findById(id: string) { return db.BusinessModule.findByPk(id); }
  async update(id: string, data: any) {
    const mod = await db.BusinessModule.findByPk(id);
    if (!mod) return null;
    return mod.update(data);
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'businessModule', 'businessModule.service.ts'), `
import { BusinessModuleDAL } from './businessModule.dal';
export class BusinessModuleService {
  private dal = new BusinessModuleDAL();
  list(businessId: string) { return this.dal.findAll({ businessId }); }
  getById(id: string, businessId: string) { return this.dal.findAll({ id, businessId }).then((res: any[]) => res[0]); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, data); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'businessModule', 'businessModule.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { BusinessModuleService } from './businessModule.service';
import { AuditLogService } from '../../services/auditLog.service';
export class BusinessModuleController {
  private service = new BusinessModuleService();
  list = async (req: Request, res: Response) => {
    // If PLATFORM_SUPER_ADMIN and passed ?businessId=..., use that. Else use req.user.businessId.
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.query.businessId) businessId = req.query.businessId as string;
    res.json({ modules: await this.service.list(businessId) });
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.query.businessId) businessId = req.query.businessId as string;
    const mod = await this.service.getById(req.params.id, businessId);
    if (!mod) return next({ statusCode: 404, message: 'Not found' });
    res.json({ module: mod });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    // Only PLATFORM_SUPER_ADMIN can update. Business Admin cannot update status directly via this API.
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.body.businessId) businessId = req.body.businessId;
    
    // Safety: ensure it genuinely belongs to that business
    const beforeData = await this.service.getById(req.params.id, businessId);
    if (!beforeData) return next({ statusCode: 404, message: 'Not found' });

    const mod = await this.service.update(req.params.id, businessId, req.body);
    await AuditLogService.log('UPDATE', 'businessModule', mod.id, beforeData, mod, req);
    res.json({ module: mod });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'businessModule', 'businessModule.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { updateBusinessModuleSchema } from '../../validators/businessModule.validator';
import { BusinessModuleController } from './businessModule.controller';
const router = Router();
const controller = new BusinessModuleController();
router.use(authRequired);
// Business admins can view enabled modules 
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
router.get('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.get));
// Only Platform Admin can edit (enable/disable modules)
router.patch('/:id', requireRole('PLATFORM_SUPER_ADMIN'), validate(updateBusinessModuleSchema), asyncHandler(controller.update));
export const businessModuleRoutes = router;
`);

// AUDIT LOG
ensureDir(path.join(src, 'modules', 'auditLog'));
fs.writeFileSync(path.join(src, 'modules', 'auditLog', 'auditLog.dal.ts'), `
import { db } from '../../models';
export class AuditLogDAL {
  findAll(query: any) { return db.AuditLog.findAll({ where: query, order: [['createdAt', 'DESC']] }); }
  findById(id: string) { return db.AuditLog.findByPk(id); }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'auditLog', 'auditLog.service.ts'), `
import { AuditLogDAL } from './auditLog.dal';
export class AuditLogServiceRead {
  private dal = new AuditLogDAL();
  list(businessId?: string) { 
    return businessId ? this.dal.findAll({ businessId }) : this.dal.findAll({});
  }
  getById(id: string, businessId?: string) {
    if(businessId) return this.dal.findAll({ id, businessId }).then((res: any[]) => res[0]);
    return this.dal.findById(id);
  }
}
`);

fs.writeFileSync(path.join(src, 'modules', 'auditLog', 'auditLog.controller.ts'), `
import type { Request, Response, NextFunction } from 'express';
import { AuditLogServiceRead } from './auditLog.service';
export class AuditLogController {
  private service = new AuditLogServiceRead();
  list = async (req: Request, res: Response) => {
    const businessId = req.user!.isPlatformSuperAdmin && !req.query.businessId ? undefined : (req.user!.isPlatformSuperAdmin ? (req.query.businessId as string) : req.user!.businessId);
    res.json({ logs: await this.service.list(businessId) });
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.isPlatformSuperAdmin ? undefined : req.user!.businessId;
    const log = await this.service.getById(req.params.id, businessId);
    if (!log) return next({ statusCode: 404, message: 'Not found' });
    res.json({ log });
  };
}
`);

fs.writeFileSync(path.join(src, 'modules', 'auditLog', 'auditLog.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { AuditLogController } from './auditLog.controller';
const router = Router();
const controller = new AuditLogController();
router.use(authRequired);
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
router.get('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.get));
export const auditLogRoutes = router;
`);

console.log('Done!');
